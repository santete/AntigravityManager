import { ProxyToken } from './types';
import { logger } from '../../utils/logger';
import { GoogleAPIService } from '../../services/GoogleAPIService';
import { CloudAccountRepo } from '../database/cloudHandler';
import { CloudAccount } from '../../types/cloudAccount';

export class TokenManager {
  private tokens: Map<string, ProxyToken> = new Map();
  private currentIndex: number = 0;

  constructor() {}

  async loadAccounts(): Promise<number> {
    // Load from SQLite DB
    // Fix: Use getAccounts() instead of list()
    const accounts = await CloudAccountRepo.getAccounts();
    let count = 0;

    for (const account of accounts) {
      try {
        const token = this.convertAccountToToken(account);
        if (token) {
          this.tokens.set(token.account_id, token);
          count++;
        }
      } catch (e) {
        logger.warn(`Gateway: Failed to load account ${account.email}`, e);
      }
    }
    return count;
  }

  private convertAccountToToken(account: CloudAccount): ProxyToken | null {
    // Fix: account.token instead of account.token_data
    if (!account.token) return null;

    return {
      account_id: account.id,
      email: account.email,
      access_token: account.token.access_token,
      refresh_token: account.token.refresh_token,
      expires_in: account.token.expires_in,
      timestamp: account.token.expiry_timestamp,
      account_path: '', // Not used with DB
      project_id: account.token.project_id || undefined,
      session_id: account.token.session_id || this.generateSessionId(),
    };
  }

  generateSessionId(): string {
    const min = 1_000_000_000_000_000_000n;
    const max = 9_000_000_000_000_000_000n;
    const range = max - min;
    const rand = BigInt(Math.floor(Math.random() * Number(range)));
    return (-(min + rand)).toString();
  }

  async getToken(): Promise<ProxyToken | null> {
    if (this.tokens.size === 0) {
      await this.loadAccounts();
    }
    if (this.tokens.size === 0) return null;

    const keys = Array.from(this.tokens.keys());
    this.currentIndex = (this.currentIndex + 1) % keys.length;
    const key = keys[this.currentIndex];
    const token = this.tokens.get(key);

    if (!token) return null;

    const now = Math.floor(Date.now() / 1000);
    if (now >= token.timestamp - 300) {
      logger.info(`Gateway: Token for ${token.email} expiring, refreshing...`);
      try {
        const newTokens = await GoogleAPIService.refreshAccessToken(token.refresh_token);

        // Update Token Object
        token.access_token = newTokens.access_token;
        token.expires_in = newTokens.expires_in;
        token.timestamp = Math.floor(Date.now() / 1000) + newTokens.expires_in;

        // Update DB
        await this.saveRefreshedToken(token.account_id, token);

        this.tokens.set(token.account_id, token);
        logger.info(`Gateway: Token refreshed for ${token.email}`);
      } catch (e) {
        logger.error(`Gateway: Failed to refresh token for ${token.email}`, e);
      }
    }

    if (!token.project_id) {
      try {
        const mockId = `cloud-code-${Math.floor(Math.random() * 100000)}`;
        token.project_id = mockId;
        await this.saveProjectId(token.account_id, mockId);
      } catch (e) {
        logger.warn('Gateway: Failed to resolve project ID', e);
      }
    }

    return token;
  }

  async saveRefreshedToken(accountId: string, token: ProxyToken) {
    try {
      const acc = await CloudAccountRepo.getAccount(accountId);
      if (acc && acc.token) {
        // Update token fields
        const newToken = {
          ...acc.token,
          access_token: token.access_token,
          expires_in: token.expires_in,
          expiry_timestamp: token.timestamp,
        };

        // Use updateToken which expects the whole token object (or partial?)
        // CloudHandler.updateToken expects JSON object that it stringifies.
        await CloudAccountRepo.updateToken(accountId, newToken);
      }
    } catch (e) {
      logger.error(`Gateway: Failed to save refreshed token to DB`, e);
    }
  }

  async saveProjectId(accountId: string, projectId: string) {
    try {
      // CloudAccountRepo.getAccount is async
      const acc = await CloudAccountRepo.getAccount(accountId);
      if (acc && acc.token) {
        const newToken = {
          ...acc.token,
          project_id: projectId,
        };
        await CloudAccountRepo.updateToken(accountId, newToken);
      }
    } catch (e) {
      logger.error(`Gateway: Failed to save project ID to DB`, e);
    }
  }
}
