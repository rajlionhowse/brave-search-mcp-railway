# Brave Search MCP - Railway Deployment

Brave Search MCP server with **SSE** and **Streamable HTTP** support via [mcp-proxy](https://github.com/punkpeye/mcp-proxy), optimized for Railway deployment.

## Overview

This deployment wraps [@brave/brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server) with [mcp-proxy](https://github.com/punkpeye/mcp-proxy) to expose both transport protocols from a single endpoint:

- **Streamable HTTP** at `/mcp` — for Lobe Chat PWA and other Streamable HTTP clients
- **SSE** at `/sse` — for Bolt AI iOS and other SSE-only clients

## Architecture

```
Client → Railway → Express wrapper (auth + CORS + proxy)
                    ├── /mcp → Bearer token auth → mcp-proxy → Brave MCP (stdio)
                    └── /sse → No auth → mcp-proxy → Brave MCP (stdio)
                                          ↓
                                    Brave Search API
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BRAVE_API_KEY` | Yes | Your Brave Search API key from [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/app/keys) |
| `MCP_API_KEY` | Yes | Your custom auth key — used as Bearer token for `/mcp` endpoint |
| `PORT` | No | Port to listen on (Railway auto-injects this, default: `8080`) |

## Endpoints

| Endpoint | Auth | Transport | Client |
|---|---|---|---|
| `/mcp` | Bearer token (`MCP_API_KEY`) | Streamable HTTP | Lobe Chat PWA |
| `/sse` | None | SSE | Bolt AI iOS |
| `/ping` | None | — | Health check (mcp-proxy internal) |
| `/health` | None | — | Health check (wrapper) |

## Configure Lobe Chat PWA

1. Go to **Settings → Skills → Custom tab → Add custom skill**
2. Select **Streamable HTTP**
3. **MCP name**: `brave-search`
4. **Streamable HTTP Endpoint URL**: `https://your-app.railway.app/mcp`
5. **Auth type**: API Key
6. **API Key**: paste your `MCP_API_KEY` value
7. Click **Test connection** → you should see Brave search tools listed
8. Click **Install**

## Configure Bolt AI iOS

1. Go to **Settings → MCP Servers → Add**
2. **Server Name**: `brave-search`
3. **Server URL**: `https://your-app.railway.app/sse`
4. Tap **Add Server**

## Deploy to Railway

1. Connect this GitHub repo to your Railway project
2. Set environment variables:
   - `BRAVE_API_KEY` — your Brave Search API key
   - `MCP_API_KEY` — generate a strong secret key
3. Railway auto-detects the Dockerfile and deploys

## Updating

Dependabot automatically creates PRs when new versions of `@brave/brave-search-mcp-server` are released. Just merge the PR and Railway auto-redeploys.

## Security Note

The `/sse` endpoint has no authentication (Bolt AI iOS does not support custom headers). Since the MCP only performs read-only Brave Search queries, the risk is limited to API quota consumption. Monitor your Brave API usage in the dashboard and rotate `BRAVE_API_KEY` if needed.

## License

MIT
