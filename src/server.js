import { startHTTPServer } from 'mcp-proxy';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || '8080';
const MCP_API_KEY = process.env.MCP_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

if (!MCP_API_KEY) {
  console.error('Error: MCP_API_KEY environment variable is required');
  process.exit(1);
}

if (!BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is required');
  process.exit(1);
}

const braveMcpPath = join(__dirname, '..', 'node_modules', '@brave', 'brave-search-mcp-server', 'dist', 'index.js');
console.log('Brave MCP server path:', braveMcpPath);

await startHTTPServer({
  port: parseInt(PORT, 10),
  host: '0.0.0.0',
  stateless: true,
  apiKey: MCP_API_KEY,
  sseEndpoint: '/sse',
  streamEndpoint: '/mcp',
  createServer: async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [braveMcpPath],
      env: {
        BRAVE_API_KEY,
        BRAVE_MCP_TRANSPORT: 'stdio',
        NODE_ENV: 'production',
      },
    });

    const server = new Server(
      { name: 'brave-search-mcp-railway', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} } }
    );

    await server.connect(transport);
    return server;
  },
});

console.log(`Brave Search MCP running on port ${PORT}`);
console.log(`Streamable HTTP: http://0.0.0.0:${PORT}/mcp`);
console.log(`SSE: http://0.0.0.0:${PORT}/sse`);
