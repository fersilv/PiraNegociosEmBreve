import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { config } from '../../config.js';
import { piraApi } from '../../lib/api-client.js';
import { apiResultToTool, configError } from '../../lib/mcp-result.js';
import { jobPayloadSchema } from './schema.js';

function requireRoute(route: string | undefined, envName: string): string | null {
  if (!route?.trim()) return null;
  return route.trim();
}

export function registerJobTools(server: McpServer): void {
  server.registerTool('jobs_check_duplicate', {
    title: 'Checar duplicidade de vaga',
    description: 'Consulta a API do Pira Negocios antes de cadastrar uma vaga. Use sempre antes de jobs_create.',
    inputSchema: jobPayloadSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async (payload) => apiResultToTool(
    await piraApi.request('POST', config.PIRA_JOBS_CHECK_PATH, payload),
    'jobs_check_duplicate',
  ));

  server.registerTool('jobs_create', {
    title: 'Cadastrar vaga',
    description: 'Cadastra uma vaga no Pira Negocios. Deve ser chamado somente depois de jobs_check_duplicate confirmar que nao e duplicada.',
    inputSchema: jobPayloadSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (payload) => apiResultToTool(
    await piraApi.request('POST', config.PIRA_JOBS_CREATE_PATH, payload),
    'jobs_create',
  ));

  server.registerTool('jobs_list', {
    title: 'Listar vagas',
    description: 'Lista vagas existentes. Requer PIRA_JOBS_LIST_PATH configurado com a rota real do backend.',
    inputSchema: z.object({
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async ({ query }) => {
    const route = requireRoute(config.PIRA_JOBS_LIST_PATH, 'PIRA_JOBS_LIST_PATH');
    if (!route) return configError('PIRA_JOBS_LIST_PATH ainda nao foi configurado com a rota real da API.');
    const url = new URL(route, config.PIRA_API_BASE_URL);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));
    return apiResultToTool(await piraApi.request('GET', url.pathname + url.search), 'jobs_list');
  });

  server.registerTool('jobs_get', {
    title: 'Consultar vaga',
    description: 'Busca uma vaga por ID/codigo. Requer PIRA_JOBS_GET_PATH com {id}.',
    inputSchema: z.object({ id: z.string().min(1) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async ({ id }) => {
    const route = requireRoute(config.PIRA_JOBS_GET_PATH, 'PIRA_JOBS_GET_PATH');
    if (!route) return configError('PIRA_JOBS_GET_PATH ainda nao foi configurado. Ex.: /api/v1/jobs/{id}, somente se essa for a rota real.');
    return apiResultToTool(await piraApi.request('GET', piraApi.withId(route, id)), 'jobs_get');
  });

  server.registerTool('jobs_update', {
    title: 'Atualizar vaga',
    description: 'Atualiza parcialmente ou integralmente uma vaga. Requer PIRA_JOBS_UPDATE_PATH com {id}.',
    inputSchema: z.object({
      id: z.string().min(1),
      changes: z.record(z.string(), z.unknown()).refine(v => Object.keys(v).length > 0, 'Informe pelo menos uma alteracao'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ id, changes }) => {
    const route = requireRoute(config.PIRA_JOBS_UPDATE_PATH, 'PIRA_JOBS_UPDATE_PATH');
    if (!route) return configError('PIRA_JOBS_UPDATE_PATH ainda nao foi configurado com a rota real da API.');
    return apiResultToTool(
      await piraApi.request(config.PIRA_JOBS_UPDATE_METHOD, piraApi.withId(route, id), changes),
      'jobs_update',
    );
  });

  server.registerTool('jobs_delete', {
    title: 'Excluir vaga',
    description: 'Exclui uma vaga por ID. Acao destrutiva. Requer PIRA_JOBS_DELETE_PATH com {id}.',
    inputSchema: z.object({
      id: z.string().min(1),
      reason: z.string().min(3).describe('Motivo da exclusao para auditoria'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async ({ id, reason }) => {
    const route = requireRoute(config.PIRA_JOBS_DELETE_PATH, 'PIRA_JOBS_DELETE_PATH');
    if (!route) return configError('PIRA_JOBS_DELETE_PATH ainda nao foi configurado com a rota real da API.');
    const body = config.PIRA_JOBS_DELETE_METHOD === 'POST' ? { reason } : undefined;
    return apiResultToTool(
      await piraApi.request(config.PIRA_JOBS_DELETE_METHOD, piraApi.withId(route, id), body),
      'jobs_delete',
    );
  });
}
