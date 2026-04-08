FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_HOST=0.0.0.0
ENV WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_PORT=8081
ENV WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_STORAGE_DIR=/data/research-executor

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8081
VOLUME ["/data/research-executor"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_PORT || '8081') + '/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "dist/research/remote-http-server.js"]
