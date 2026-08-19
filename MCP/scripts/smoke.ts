import 'dotenv/config';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = process.env.MCP_SMOKE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}/mcp`;
const token = process.env.MCP_ACCESS_TOKEN;

const client = new Client({ name: 'pira-mcp-smoke', version: '0.1.0' });
const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
});

await client.connect(transport);
const tools = await client.listTools();
console.log('Tools:', tools.tools.map(t => t.name).join(', '));
await client.close();
