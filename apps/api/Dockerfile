FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/agent-runtime packages/agent-runtime
RUN pnpm --filter @tourist/api build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 TOURIST_RUNS_DIR=/data/runs TOURIST_MEMORY_FILE=/data/memory.json TOURIST_WORKER_BUNDLE=/app/dist/worker.cjs
COPY --from=build /app/apps/api/dist /app/dist
RUN mkdir -p /data/runs && chown -R node:node /data
USER node
EXPOSE 8787
CMD ["node", "dist/server.cjs"]
