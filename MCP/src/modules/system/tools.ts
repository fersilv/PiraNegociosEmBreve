import type { McpServer } from '@modelcontextprotocol/server';
import { config } from '../../config.js';
import { piraApi } from '../../lib/api-client.js';

export function registerSystemTools(server: McpServer): void {
  server.registerTool('system_capabilities', {
    title: 'Ver capacidades do Pira MCP',
    description: 'Mostra quais operacoes do MCP estao configuradas sem revelar chaves ou tokens.',
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async () => {
    const payload = {
      service: 'pira-mcp',
      apiBaseUrl: new URL(config.PIRA_API_BASE_URL).origin,
      rateLimitPerMinute: config.PIRA_API_RPM,
      jobs: {
        checkDuplicate: true,
        create: true,
        list: Boolean(config.PIRA_JOBS_LIST_PATH?.trim()),
        get: Boolean(config.PIRA_JOBS_GET_PATH?.trim()),
        update: Boolean(config.PIRA_JOBS_UPDATE_PATH?.trim()),
        delete: Boolean(config.PIRA_JOBS_DELETE_PATH?.trim()),
      },
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  server.registerTool('system_ping_api', {
    title: 'Testar API do Pira Negocios',
    description: 'Testa conectividade HTTP com a API usando a rota de checagem. Uma resposta HTTP 4xx ainda significa que o servidor foi alcancado.',
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async () => {
    const result = await piraApi.request('POST', config.PIRA_JOBS_CHECK_PATH, {});
    const payload = {
      reachable: result.status > 0,
      status: result.status,
      statusText: result.statusText,
      response: result.data,
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
      isError: result.status === 0,
    };
  });
}
