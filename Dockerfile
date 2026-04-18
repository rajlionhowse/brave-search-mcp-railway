FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

FROM node:22-alpine AS release

WORKDIR /app

RUN npm install -g mcp-proxy

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

COPY src ./src
COPY startup.sh ./startup.sh

RUN chmod +x startup.sh

ENV NODE_ENV=production

EXPOSE 8080

CMD ["sh", "startup.sh"]
