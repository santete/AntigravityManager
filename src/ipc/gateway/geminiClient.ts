import { v4 as uuidv4 } from 'uuid';
import { OpenAIChatRequest, AnthropicChatRequest, GeminiContent } from './types';
import { Converter } from './converter';
import { logger } from '../../utils/logger';
import { ProxyAgent } from 'undici';
import { UpstreamProxyConfig } from '../../types/config';

// Type definitions for fetch (since we are in Node)
// Electron main process has 'fetch' globally available in newer versions (Node 18+),
// but we might need to handle types.
declare const fetch: any;

export class GeminiClient {
  private timeoutMs: number;
  private upstreamProxy?: UpstreamProxyConfig;

  constructor(timeoutSeconds: number = 60, upstreamProxy?: UpstreamProxyConfig) {
    this.timeoutMs = timeoutSeconds * 1000;
    this.upstreamProxy = upstreamProxy;
  }

  private getFetchOptions() {
    if (this.upstreamProxy?.enabled && this.upstreamProxy.url) {
      return {
        dispatcher: new ProxyAgent(this.upstreamProxy.url),
      };
    }
    return {};
  }

  async streamGenerateAnthropic(
    request: AnthropicChatRequest,
    accessToken: string,
    projectId: string,
    sessionId: string,
    signatureMap?: Map<string, string>,
    modelMapping?: Record<string, string>,
  ): Promise<any> {
    // Returns a ReadableStream or similar
    const url =
      'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse';

    const contents = Converter.convertAnthropicToGeminiContents(request, signatureMap);

    // ... (System prompt handling remains same)
    const systemInstruction = request.system
      ? {
          role: 'user',
          parts: [
            {
              text:
                typeof request.system === 'string'
                  ? request.system
                  : JSON.stringify(request.system),
            },
          ],
        }
      : { role: 'user', parts: [{ text: '' }] };

    const generationConfig: any = {
      temperature: request.temperature ?? 1.0,
      topP: request.top_p ?? 0.95,
      maxOutputTokens: request.max_tokens ?? 16384,
      candidateCount: 1,
    };

    if (request.model.includes('sonnet') || request.model.includes('thinking')) {
      generationConfig.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget: 8191,
      };
    }

    let upstreamModel = request.model;

    // 1. User Custom Mapping (Fuzzy match)
    if (modelMapping) {
      for (const [key, value] of Object.entries(modelMapping)) {
        if (request.model.includes(key)) {
          upstreamModel = value;
          break;
        }
      }
    }

    // 2. Built-in Fallback Logic
    const lowerName = upstreamModel.toLowerCase();
    if (!upstreamModel.startsWith('gemini')) {
      // Only map if not already a gemini model (roughly)
      if (lowerName.includes('sonnet') || lowerName.includes('thinking')) {
        upstreamModel = 'gemini-3-pro-preview';
      } else if (lowerName.includes('haiku')) {
        upstreamModel = 'gemini-2.0-flash-exp';
      } else if (lowerName.includes('opus')) {
        upstreamModel = 'gemini-3-pro-preview';
      } else if (lowerName.includes('claude')) {
        upstreamModel = 'gemini-2.5-flash-thinking';
      } else if (lowerName === 'gemini-3-pro-high' || lowerName === 'gemini-3-pro-low') {
        upstreamModel = 'gemini-3-pro-preview';
      } else if (lowerName === 'gemini-3-flash') {
        upstreamModel = 'gemini-3-flash-preview';
      }
    }

    const requestBody = {
      project: projectId,
      requestId: uuidv4(),
      model: upstreamModel,
      userAgent: 'antigravity',
      request: {
        contents,
        systemInstruction,
        generationConfig,
        sessionId,
      },
    };

    logger.debug(
      `(Gateway) Anthropic Request: ${request.model} -> ${upstreamModel} | Proj: ${projectId}`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Host: 'daily-cloudcode-pa.sandbox.googleapis.com',
          'User-Agent': 'claude-cli/1.0.83 (external, cli)',
          'X-App': 'cli',
          'Anthropic-Beta': 'claude-code-20250219,interleaved-thinking-2025-05-14',
          'X-Stainless-Lang': 'js',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        ...this.getFetchOptions(),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upstream Error ${response.status}: ${text}`);
      }

      return response.body; // Node.js Readable Web Stream
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async generate(
    request: OpenAIChatRequest,
    accessToken: string,
    projectId: string,
    sessionId: string,
  ): Promise<any> {
    const url = 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent';

    // Split System
    const systemMessages = request.messages.filter((m) => m.role === 'system');
    const chatMessages = request.messages.filter((m) => m.role !== 'system');

    const systemText = systemMessages
      .map((m) => {
        if (typeof m.content === 'string') return m.content;
        return '';
      })
      .join('\n');

    const contents = Converter.convertOpenAIToGeminiContents(chatMessages);

    const generationConfig = {
      temperature: request.temperature ?? 1.0,
      topP: request.top_p ?? 0.95,
      maxOutputTokens: request.max_tokens ?? 8096,
      candidateCount: 1,
    };

    const requestBody = {
      project: projectId,
      requestId: uuidv4(),
      model: request.model,
      userAgent: 'antigravity',
      request: {
        contents,
        systemInstruction: {
          role: 'user',
          parts: [{ text: systemText }],
        },
        generationConfig,
        toolConfig: { functionCallingConfig: { mode: 'VALIDATED' } },
        sessionId,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Host: 'daily-cloudcode-pa.sandbox.googleapis.com',
          'User-Agent': 'antigravity/1.11.3 windows/amd64',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        ...this.getFetchOptions(),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upstream Error ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }
}
