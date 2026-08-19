import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { config } from './config.js';
import { buildMcpServer } from './server.js';

const mcpHandler = createMcpHandler(buildMcpServer);
const nodeMcpHandler = toNodeHandler(mcpHandler);

function safeTokenEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(authorization: string | undefined): boolean {
  if (config.MCP_AUTH_MODE === 'none') return true;
  const expected = config.MCP_ACCESS_TOKEN!;
  const prefix = 'Bearer ';
  if (!authorization?.startsWith(prefix)) return false;
  return safeTokenEqual(authorization.slice(prefix.length), expected);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, service: 'pira-mcp', version: '0.1.0' }));
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ service: 'pira-mcp', mcp: '/mcp', health: '/health' }));
    return;
  }

  if (url.pathname !== '/mcp') {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (!authorized(req.headers.authorization)) {
    res.writeHead(401, {
      'content-type': 'application/json; charset=utf-8',
      'www-authenticate': 'Bearer realm="pira-mcp"',
    });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  void nodeMcpHandler(req, res);
});

server.listen(config.PORT, config.HOST, () => {
  console.log(`Pira MCP ouvindo em http://${config.HOST}:${config.PORT}/mcp`);
});

async function shutdown(signal: string) {
  console.log(`Recebido ${signal}. Encerrando...`);
  server.close();
  await mcpHandler.close?.();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
