import 'dotenv/config';
import { z } from 'zod/v4';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().default('0.0.0.0'),
  MCP_AUTH_MODE: z.enum(['bearer', 'none']).default('bearer'),
  MCP_ACCESS_TOKEN: z.string().optional(),

  PIRA_API_BASE_URL: z.string().url(),
  PIRA_API_KEY: z.string().min(1),
  PIRA_API_KEY_HEADER: z.string().min(1).default('X-API-Key'),
  PIRA_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  PIRA_API_RPM: z.coerce.number().int().min(1).max(60).default(60),
  AUDIT_LOG_PATH: z.string().default('./data/audit.log'),

  PIRA_JOBS_CHECK_PATH: z.string().min(1).default('/api/v1/jobs/check'),
  PIRA_JOBS_CREATE_PATH: z.string().min(1).default('/api/v1/jobs'),
  PIRA_JOBS_LIST_PATH: z.string().optional(),
  PIRA_JOBS_GET_PATH: z.string().optional(),
  PIRA_JOBS_UPDATE_PATH: z.string().optional(),
  PIRA_JOBS_UPDATE_METHOD: z.enum(['PUT', 'PATCH']).default('PATCH'),
  PIRA_JOBS_DELETE_PATH: z.string().optional(),
  PIRA_JOBS_DELETE_METHOD: z.enum(['DELETE', 'POST']).default('DELETE'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuracao invalida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.MCP_AUTH_MODE === 'bearer' && !parsed.data.MCP_ACCESS_TOKEN) {
  console.error('MCP_ACCESS_TOKEN e obrigatorio quando MCP_AUTH_MODE=bearer');
  process.exit(1);
}

export const config = parsed.data;
