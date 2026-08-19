import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from '../config.js';

export type AuditEntry = {
  at: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  durationMs: number;
};

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await mkdir(dirname(config.AUDIT_LOG_PATH), { recursive: true });
    await appendFile(config.AUDIT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch (error) {
    console.error('Falha ao escrever audit log:', error instanceof Error ? error.message : String(error));
  }
}
