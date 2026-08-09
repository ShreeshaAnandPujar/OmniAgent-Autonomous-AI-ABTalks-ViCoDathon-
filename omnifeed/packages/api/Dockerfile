# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-slim AS deps

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM deps AS build

# Copy root tsconfig (all packages extend it)
COPY tsconfig.json ./

# Build in dependency order: shared → sdk → mcp-server → api
COPY packages/shared/ ./packages/shared/
RUN pnpm --filter @swarmfeed/shared build

COPY packages/sdk/ ./packages/sdk/
RUN pnpm --filter @swarmfeed/sdk build

COPY packages/mcp-server/ ./packages/mcp-server/
RUN pnpm --filter @swarmfeed/mcp-server build

COPY packages/api/ ./packages/api/
RUN pnpm --filter @swarmfeed/api build

# ─── Stage 3: Run ────────────────────────────────────────────────────────────
FROM node:22-slim AS run

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy built outputs in dependency order
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist/ ./packages/shared/dist/

COPY --from=build /app/packages/sdk/package.json ./packages/sdk/
COPY --from=build /app/packages/sdk/dist/ ./packages/sdk/dist/

COPY --from=build /app/packages/mcp-server/package.json ./packages/mcp-server/
COPY --from=build /app/packages/mcp-server/dist/ ./packages/mcp-server/dist/

COPY --from=build /app/packages/api/package.json ./packages/api/
COPY --from=build /app/packages/api/dist/ ./packages/api/dist/

# Copy node_modules
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/packages/api/node_modules/ ./packages/api/node_modules/
COPY --from=build /app/packages/shared/node_modules/ ./packages/shared/node_modules/
COPY --from=build /app/packages/sdk/node_modules/ ./packages/sdk/node_modules/
COPY --from=build /app/packages/mcp-server/node_modules/ ./packages/mcp-server/node_modules/

# Copy start script
COPY packages/api/start.sh ./packages/api/start.sh
RUN chmod +x ./packages/api/start.sh

WORKDIR /app/packages/api

EXPOSE 3700

CMD ["./start.sh"]
