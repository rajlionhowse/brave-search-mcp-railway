import { spawn } from 'node:child_process';
import http from 'node:http';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const INTERNAL_PORT = process.env.INTERNAL_PROXY_PORT || '3000';
const PORT = process.env.PORT || '8080';
const MCP_API_KEY = process.env.MCP_API_KEY;

if (!MCP_API_KEY) {
  console.error('Error: MCP_API_KEY environment variable is required');
  process.exit(1);
}

const mcpProxy = spawn(
  'npx',
  [
    '--yes', 'mcp-proxy',
    '--port', INTERNAL_PORT,
    '--stateless',
    '--',
    'npx', '--yes', '@brave/brave-search-mcp-server',
  ],
  { stdio: 'inherit' },
);

mcpProxy.on('error', (err) => {
  console.error('mcp-proxy failed to start:', err);
  process.exit(1);
});

function waitForMcpProxy() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      attempts++;
      if (attempts > 60) {
        reject(new Error('mcp-proxy failed to start after 30 seconds'));
        return;
      }
      const req = http.get(`http://localhost:${INTERNAL_PORT}/ping`, (res) => {
        if (res.statusCode === 200) resolve();
        else setTimeout(check, 500);
      });
      req.on('error', () => setTimeout(check, 500));
    }
    check();
  });
}

waitForMcpProxy()
  .then(() => {
    console.log('mcp-proxy is ready');

    const app = express();

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
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

    mcpProxy.on('exit', (code) => {
      console.log(`mcp-proxy exited with code ${code}`);
      process.exit(code || 1);
    });

    process.on('SIGTERM', () => {
      mcpProxy.kill('SIGTERM');
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
