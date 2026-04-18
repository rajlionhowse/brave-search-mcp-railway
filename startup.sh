#!/bin/sh
set -e

INTERNAL_PORT=3000

mcp-proxy \
  --port "$INTERNAL_PORT" \
  --stateless \
  --server stream \
  --server sse \
  -- npx -y @brave/brave-search-mcp-server &

echo "Waiting for mcp-proxy to start on port $INTERNAL_PORT..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$INTERNAL_PORT/ping" > /dev/null 2>&1; then
    echo "mcp-proxy is ready"
    break
  fi
  sleep 1
done

exec node src/wrapper.js
