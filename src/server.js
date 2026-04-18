import express from 'express';
import cors from 'cors';
import { startHTTPServer } from 'mcp-proxy';
import createMcpServer from '@brave/brave-search-mcp-server/dist/server.js';
import { setOptions } from '@brave/brave-search-mcp-server/dist/config.js';
import http from 'node:http';

const PORT = process.env.PORT || '8080';
const INTERNAL_PORT = 3001;
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

setOptions({ braveApiKey: BRAVE_API_KEY });

const { close } = await startHTTPServer({
  port: INTERNAL_PORT,
  host: '127.0.0.1',
  stateless: true,
  sseEndpoint: '/sse',
  streamEndpoint: '/mcp',
  cors: false,
  createServer: async () => {
    return createMcpServer();
  },
});

console.log(`mcp-proxy running on internal port ${INTERNAL_PORT}`);

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true,
  exposedHeaders: ['Mcp-Session-Id'],
}));

app.use(express.json());

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

function proxyToInternal(req, res) {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: '127.0.0.1',
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    if (!res.headersSent) res.status(502).json({ error: 'Proxy error' });
  });
  req.pipe(proxyReq);
}

app.all('/mcp', proxyToInternal);
app.all('/sse', proxyToInternal);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'brave-search-mcp' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Brave Search MCP wrapper running on port ${PORT}`);
  console.log(`Streamable HTTP: http://0.0.0.0:${PORT}/mcp`);
  console.log(`SSE: http://0.0.0.0:${PORT}/sse`);
});

process.on('SIGTERM', () => {
  close();
  process.exit(0);
});
