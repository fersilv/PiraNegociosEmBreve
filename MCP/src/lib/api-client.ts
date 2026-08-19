import { config } from '../config.js';
import { SerialRateLimiter } from './rate-limiter.js';
import { writeAudit } from './audit.js';

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  statusText: string;
  data: T | string | null;
};

const limiter = new SerialRateLimiter(config.PIRA_API_RPM);

function pathWithId(template: string, id: string): string {
  return template.replaceAll('{id}', encodeURIComponent(id));
}

export class PiraApiClient {
  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    await limiter.wait();

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.PIRA_API_TIMEOUT_MS);

    try {
      const url = new URL(path, config.PIRA_API_BASE_URL);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        [config.PIRA_API_KEY_HEADER]: config.PIRA_API_KEY,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: T | string | null = null;
      if (text) {
        try { data = JSON.parse(text) as T; }
        catch { data = text; }
      }

      const result = { ok: response.ok, status: response.status, statusText: response.statusText, data };
      await writeAudit({ at: new Date().toISOString(), method, path: url.pathname, status: response.status, ok: response.ok, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeAudit({ at: new Date().toISOString(), method, path, status: 0, ok: false, durationMs: Date.now() - startedAt });
      return { ok: false, status: 0, statusText: message, data: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  withId(template: string, id: string): string {
    return pathWithId(template, id);
  }
}

export const piraApi = new PiraApiClient();
