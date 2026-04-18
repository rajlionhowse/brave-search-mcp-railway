import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const INTERNAL_PORT = process.env.INTERNAL_PROXY_PORT || '3000';
const PORT = process.env.PORT || '8080';
const MCP_API_KEY = process.env.MCP_API_KEY;

if (!MCP_API_KEY) {
  console.error('Error: MCP_API_KEY environment variable is required');
  process.exit(1);
}

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/mcp', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Unauthorized: Bearer token required' },
    });
  }
  const token = authHeader.slice(7);
  if (token !== MCP_API_KEY) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Unauthorized: Invalid token' },
    });
  }
  next();
});

app.use(
  ['/mcp', '/sse'],
  createProxyMiddleware({
    target: `http://localhost:${INTERNAL_PORT}`,
    changeOrigin: true,
    proxyTimeout: 300000,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
    },
  }),
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'brave-search-mcp' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Brave Search MCP wrapper running on port ${PORT}`);
  console.log(`Streamable HTTP: http://0.0.0.0:${PORT}/mcp`);
  console.log(`SSE: http://0.0.0.0:${PORT}/sse`);
});
