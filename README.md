# Brave Search MCP - Railway Deployment

Brave Search MCP server wrapped with Bearer token authentication, optimized for Railway deployment and Lobe Chat PWA integration.

## Overview

This is a thin wrapper around [@brave/brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server) that adds:

- **Bearer token authentication** via `Authorization: Bearer <token>` header
- **CORS headers** for browser-based clients (Lobe Chat PWA)
- **Streamable HTTP** endpoint at `/mcp`
- **Health check** endpoint at `/health`
- **Railway-ready** Dockerfile

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BRAVE_API_KEY` | Yes | Your Brave Search API key from [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/app/keys) |
| `MCP_API_KEY` | Yes | Your custom auth key — used as the Bearer token for API access |
| `PORT` | No | Port to listen on (Railway auto-injects this, default: `8080`) |

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

## Deploy to Railway

1. Push this repo to GitHub
2. In Railway, create a new service from your GitHub repo
3. Set environment variables:
   - `BRAVE_API_KEY` — your Brave Search API key
   - `MCP_API_KEY` — generate a strong secret key
4. Railway will auto-detect the Dockerfile and deploy

## Configure Lobe Chat PWA

1. Go to **Settings → Skills → Custom tab → Add custom skill**
2. Select **Streamable HTTP**
3. **MCP name**: `brave-search`
4. **Streamable HTTP Endpoint URL**: `https://your-app.railway.app/mcp`
5. **Auth type**: API Key
6. **API Key**: paste your `MCP_API_KEY` value
7. Click **Test connection** → you should see Brave search tools listed
8. Click **Install**
9. Enable the skill on any agent you want to use it with

## Endpoints

| Endpoint | Auth Required | Description |
|---|---|---|
| `/mcp` | Yes (Bearer token) | Streamable HTTP MCP endpoint |
| `/ping` | No | Health check (used by Brave MCP internally) |
| `/health` | No | Simple health check for Railway monitoring |

## Updating

When a new version of `@brave/brave-search-mcp-server` is released:

```bash
npm update @brave/brave-search-mcp-server
git add package.json package-lock.json
git commit -m "chore: update brave-search-mcp-server"
git push
```

Railway will auto-redeploy.

## License

MIT
