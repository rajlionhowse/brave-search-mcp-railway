import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  LoggingMessageNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { randomUUID } from 'node:crypto';
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

const transports = new Map();

const braveMcpPath = join(__dirname, '..', 'node_modules', '@brave', 'brave-search-mcp-server', 'dist', 'index.js');
console.log('Brave MCP server path:', braveMcpPath);

const stdioTransport = new StdioClientTransport({
  command: 'node',
  args: [braveMcpPath],
  env: {
    BRAVE_API_KEY,
    BRAVE_MCP_TRANSPORT: 'stdio',
    NODE_ENV: 'production',
  },
  stderr: 'pipe',
});

stdioTransport.stderr?.on('data', (data) => {
  console.error('[Brave MCP stderr]:', data.toString().trim());
});

const braveClient = new Client(
  { name: 'brave-search-proxy', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

console.log('Connecting to Brave MCP server via stdio...');
try {
  await braveClient.connect(stdioTransport);
  console.log('Connected to Brave MCP server');

  const toolsResult = await braveClient.listTools();
  console.log('Available tools:', toolsResult.tools.map(t => t.name).join(', '));
} catch (err) {
  console.error('Failed to connect to Brave MCP server:', err);
  process.exit(1);
}

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

app.all('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'];
    let transport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId);
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
        },
      });
    }

    const server = new Server(
      { name: 'brave-search-mcp-railway', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await braveClient.listTools();
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return await braveClient.listResources();
    });

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return await braveClient.listPrompts();
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await braveClient.callTool(request.params);
    });

    braveClient.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      server.sendLoggingMessage(notification.params);
    });

    braveClient.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      server.sendResourceUpdated(notification.params);
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Streamable HTTP error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal server error' },
      });
    }
  }
});

app.get('/sse', async (req, res) => {
  try {
    const transport = new SSEServerTransport('/message', res);
    const server = new Server(
      { name: 'brave-search-mcp-railway', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await braveClient.listTools();
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return await braveClient.listResources();
    });

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return await braveClient.listPrompts();
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await braveClient.callTool(request.params);
    });

    braveClient.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      server.sendLoggingMessage(notification.params);
    });

    braveClient.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      server.sendResourceUpdated(notification.params);
    });

    await server.connect(transport);
  } catch (error) {
    console.error('SSE error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.post('/message', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    const transport = transports.get(sessionId);
    if (!transport) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('SSE message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'brave-search-mcp' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Brave Search MCP running on port ${PORT}`);
  console.log(`Streamable HTTP: http://0.0.0.0:${PORT}/mcp`);
  console.log(`SSE: http://0.0.0.0:${PORT}/sse`);
});
