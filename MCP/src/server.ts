import { McpServer } from '@modelcontextprotocol/server';
import { registerModules } from './modules/index.js';

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'pira-negocios-admin', version: '0.1.0' },
    {
      instructions: [
        'Este servidor administra recursos do Pira Negocios.',
        'Para vagas, sempre chame jobs_check_duplicate antes de jobs_create.',
        'Nunca force duplicidade exata genuina.',
        'Acoes destrutivas devem ser usadas somente quando o usuario pedir explicitamente.',
        'Rotas administrativas nao confirmadas ficam desativadas ate serem configuradas no ambiente.',
      ].join(' '),
    },
  );

  registerModules(server);

  return server;
}
