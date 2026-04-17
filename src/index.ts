import express from 'express';
import cors from 'cors';

process.env.BRAVE_MCP_TRANSPORT = 'http';
process.env.BRAVE_MCP_PORT = process.env.PORT || '8080';
process.env.BRAVE_MCP_HOST = '0.0.0.0';
process.env.BRAVE_MCP_STATELESS = 'true';

import { getOptions } from '@brave/brave-search-mcp-server/dist/config.js';
import httpServer from '@brave/brave-search-mcp-server/dist/protocols/http.js';

const mcpApiKey = process.env.MCP_API_KEY;
if (!mcpApiKey) {
  console.error('Error: MCP_API_KEY environment variable is required');
  process.exit(1);
}

const options = getOptions();
if (!options) {
  console.error('Error: Failed to initialize Brave MCP configuration');
  process.exit(1);
}

const braveApp = httpServer.createApp();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true,
  exposedHeaders: ['Mcp-Session-Id'],
}));

app.use('/mcp', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      id: null,
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized: Bearer token required' },
    });
  }

  const token = authHeader.slice(7);
  if (token !== mcpApiKey) {
    return res.status(401).json({
      id: null,
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized: Invalid token' },
    });
  }

  next();
});

app.use(braveApp);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'brave-search-mcp' });
});

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`Brave Search MCP server running on port ${port}`);
  console.log(`MCP endpoint: http://0.0.0.0:${port}/mcp`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
});
