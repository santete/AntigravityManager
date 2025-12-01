import http from 'http';
import { TokenManager } from './tokenManager';
import { GeminiClient } from './geminiClient';
import { ClaudeStreamConverter } from './claudeConverter';
import { logger } from '../../utils/logger';
import { Readable } from 'stream';
import { ConfigManager } from '../config/manager';
import { v4 as uuidv4 } from 'uuid';

const PORT = 3000; // Default, make configurable?

export class GatewayServer {
  private server: http.Server | null = null;
  private tokenManager: TokenManager;
  private client: GeminiClient;
  private signatureMap: Map<string, string> = new Map();
  private currentPort: number = 0;

  constructor() {
    this.tokenManager = new TokenManager();
    this.client = new GeminiClient(60);
  }

  async start(port: number = PORT) {
    // Load config and accounts
    const config = ConfigManager.loadConfig();
    await this.tokenManager.loadAccounts();
    logger.info(`Gateway: Loaded ${await this.tokenManager.loadAccounts()} accounts`);

    // Initialize Client with config
    // Default to 60s if not set, pass upstream proxy config
    this.client = new GeminiClient(
      config.proxy?.request_timeout || 60,
      config.proxy?.upstream_proxy,
    );

    this.server = http.createServer(async (req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      try {
        if (url.pathname === '/v1/messages' && req.method === 'POST') {
          await this.handleAnthropicMessages(req, res);
        } else if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
          // await this.handleChatCompletions(req, res);
          res.writeHead(501);
          res.end('Not Implemented Yet');
        } else if (url.pathname === '/healthz') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (e) {
        logger.error('Gateway: Request Error', e);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e) }));
        }
      }
    });

    this.server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        logger.error(`Gateway: Port ${port} is already in use.`);
      } else {
        logger.error('Gateway: Server error', e);
      }
    });

    this.server.listen(port, () => {
      this.currentPort = port;
      logger.info(`Gateway: Server listening on http://127.0.0.1:${port}`);
    });
  }

  private async handleAnthropicMessages(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.readBody(req);
    const request = JSON.parse(body);

    logger.info(`(Anthropic) Request ${request.model}`);

    // Retry Loop
    const maxRetries = 3; // or tokenManager count
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;
      const token = await this.tokenManager.getToken();

      if (!token) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: { type: 'overloaded_error', message: 'No accounts available' } }),
        );
        return;
      }

      logger.info(`(Anthropic) Using account ${token.email} (Attempt ${attempts})`);

      try {
        const config = ConfigManager.loadConfig();
        const mapping = config.proxy?.anthropic_mapping || {};

        const stream = await this.client.streamGenerateAnthropic(
          request,
          token.access_token,
          token.project_id || 'unknown-project',
          token.session_id,
          this.signatureMap,
          mapping,
        );

        // Handle SSE
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const msgId = `msg_${uuidv4()}`;
        const startEvent = ClaudeStreamConverter.createMessageStart(msgId, request.model);
        res.write(`event: ${startEvent.event}\ndata: ${startEvent.data}\n\n`);

        const converter = new ClaudeStreamConverter();

        // Read the stream
        // Node fetch response.body is a ReadableStream (web stream) or IncomingMessage (Node stream) depending on fetch polyfill
        // Assuming it's an async iterable or we can get a reader.
        // In Node 18+ native fetch, body is a Web stream.

        for await (const chunk of stream) {
          // chunk is Buffer or Uint8Array
          const text = Buffer.from(chunk).toString('utf-8');
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                // Logic from server.rs: process_chunk -> get events
                const events = converter.processChunk(json);
                for (const event of events) {
                  res.write(`event: ${event.event}\ndata: ${event.data}\n\n`);
                }
              } catch (e) {
                logger.warn('Gateway: Failed to parse Gemini chunk', e);
              }
            }
          }
        }

        res.end();
        return; // Success
      } catch (e: any) {
        logger.error(`(Anthropic) Request failed: ${e.message}`);
        // Check retry
        if (this.shouldRetry(e.message) && attempts < maxRetries) {
          logger.warn(`(Anthropic) Retrying...`);
          continue;
        }

        // Final error
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { type: 'api_error', message: e.message } }));
        }
        return;
      }
    }
  }

  private shouldRetry(errorMsg: string): boolean {
    // Simple heuristic
    if (
      errorMsg.includes('429') ||
      errorMsg.includes('503') ||
      errorMsg.includes('500') ||
      errorMsg.includes('403')
    )
      return true;
    return false;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  // ===== Lifecycle & Status Methods =====

  /**
   * Stop the gateway server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) {
          logger.error('Gateway: Failed to stop server', err);
          reject(err);
        } else {
          logger.info('Gateway: Server stopped');
          this.server = null;
          this.currentPort = 0;
          resolve();
        }
      });
    });
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Get current gateway status
   */
  async getStatus(): Promise<{
    running: boolean;
    port: number;
    base_url: string;
    active_accounts: number;
  }> {
    const accountCount = await this.getAccountCount();
    return {
      running: this.isRunning(),
      port: this.currentPort,
      base_url: this.isRunning() ? `http://localhost:${this.currentPort}` : '',
      active_accounts: accountCount,
    };
  }

  /**
   * Get the number of loaded accounts
   */
  async getAccountCount(): Promise<number> {
    return this.tokenManager.loadAccounts();
  }
}

// Singleton instance for global access
export const gatewayInstance = new GatewayServer();
