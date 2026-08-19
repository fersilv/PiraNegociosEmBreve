import type { McpServer } from '@modelcontextprotocol/server';
import { registerJobTools } from './jobs/tools.js';
import { registerSystemTools } from './system/tools.js';

export function registerModules(server: McpServer): void {
  registerSystemTools(server);
  registerJobTools(server);

  // Extensoes futuras:
  // registerCompanyTools(server);
  // registerEventTools(server);
  // registerAdTools(server);
}
