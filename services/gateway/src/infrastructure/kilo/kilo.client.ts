import { getDb } from '../database/db.js';
import { CryptoService } from '../../application/services/crypto.service.js';
import { ExternalServiceError, ValidationError } from '../../domain/errors.js';
import type { KiloConfig, KiloRequest, KiloResponse, KiloConnectionStatus, KiloUsage } from '@peanut/shared-types';

// Exported for use in routes
export type KiloCompleteRequest = KiloRequest;

const ENCRYPTION_KEY_ENV = 'KILO_ENCRYPTION_KEY';

interface KiloConfigRow {
  id: number;
  api_key_encrypted: string | null;
  base_url: string;
  model: string;
  max_tokens_per_request: number;
  updated_at: string;
}

// Kilo Code Bridge: Secure proxy/tunnel for Kilo Code API
// Credentials are stored encrypted at rest, never exposed to clients
export class KiloClient {
  constructor(private readonly crypto: CryptoService) {}

  private getEncryptionKey(): string {
    const key = process.env[ENCRYPTION_KEY_ENV];
    if (!key) throw new ValidationError('KILO_ENCRYPTION_KEY environment variable not set');
    return key;
  }

  async saveConfig(config: Omit<KiloConfig, 'apiKey'> & { apiKey?: string }): Promise<void> {
    const db = getDb();
    const encKey = this.getEncryptionKey();

    const existing = db.prepare('SELECT api_key_encrypted FROM kilo_config WHERE id = 1').get() as KiloConfigRow | undefined;
    const apiKeyEncrypted = config.apiKey
      ? this.crypto.encryptAES256(config.apiKey, encKey)
      : existing?.api_key_encrypted ?? null;

    db.prepare(`
      INSERT INTO kilo_config (id, api_key_encrypted, base_url, model, max_tokens_per_request, updated_at)
      VALUES (1, @apiKeyEncrypted, @baseUrl, @model, @maxTokens, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        api_key_encrypted = COALESCE(@apiKeyEncrypted, api_key_encrypted),
        base_url = @baseUrl, model = @model,
        max_tokens_per_request = @maxTokens, updated_at = datetime('now')
    `).run({
      apiKeyEncrypted,
      baseUrl: config.baseUrl,
      model: config.model,
      maxTokens: config.maxTokensPerRequest,
    });
  }

  async getConfig(): Promise<Omit<KiloConfig, 'apiKey'> & { hasApiKey: boolean }> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM kilo_config WHERE id = 1').get() as KiloConfigRow | undefined;
    if (!row) {
      return { baseUrl: 'https://api.kilo.codes', model: 'claude-3-5-sonnet', maxTokensPerRequest: 8192, hasApiKey: false };
    }
    return {
      baseUrl: row.base_url,
      model: row.model,
      maxTokensPerRequest: row.max_tokens_per_request,
      hasApiKey: !!row.api_key_encrypted,
    };
  }

  private async getApiKey(): Promise<string> {
    const db = getDb();
    const row = db.prepare('SELECT api_key_encrypted FROM kilo_config WHERE id = 1').get() as KiloConfigRow | undefined;
    if (!row?.api_key_encrypted) throw new ValidationError('Kilo Code API key not configured');
    return this.crypto.decryptAES256(row.api_key_encrypted, this.getEncryptionKey());
  }

  async complete(req: KiloRequest): Promise<KiloResponse> {
    const apiKey = await this.getApiKey();
    const config = await this.getConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const resp = await fetch(`${config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'anthropic-version': '2023-06-01',
          'x-source': 'peanut-agent-enterprise',
        },
        body: JSON.stringify({
          model: req.model ?? config.model,
          messages: req.messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: Math.min(req.maxTokens ?? config.maxTokensPerRequest, config.maxTokensPerRequest),
          temperature: req.temperature ?? 0.0,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new ExternalServiceError('Kilo Code', `HTTP ${resp.status}: ${text}`);
      }

      const data = await resp.json() as {
        id: string;
        model: string;
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string;
      };

      const content = data.content.find(c => c.type === 'text')?.text ?? '';
      return {
        id: data.id,
        model: data.model,
        content,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        finishReason: data.stop_reason,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getUsage(): Promise<KiloUsage> {
    const apiKey = await this.getApiKey();
    const config = await this.getConfig();

    const resp = await fetch(`${config.baseUrl}/v1/usage`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      throw new ExternalServiceError('Kilo Code', `Failed to fetch usage: HTTP ${resp.status}`);
    }

    const data = await resp.json() as { used: number; limit: number; reset_at: string };
    return {
      used: data.used,
      limit: data.limit,
      resetAt: data.reset_at,
      percentage: data.limit > 0 ? Math.round((data.used / data.limit) * 100) : 0,
    };
  }

  async checkConnection(): Promise<KiloConnectionStatus> {
    const config = await this.getConfig();
    if (!config.hasApiKey) {
      return { connected: false, model: config.model, lastCheckedAt: new Date().toISOString() };
    }

    try {
      const usage = await this.getUsage();
      return { connected: true, model: config.model, usage, lastCheckedAt: new Date().toISOString() };
    } catch {
      return { connected: false, model: config.model, lastCheckedAt: new Date().toISOString() };
    }
  }
}
