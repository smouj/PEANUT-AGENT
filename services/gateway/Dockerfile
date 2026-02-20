FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY services/gateway/package.json ./services/gateway/
RUN pnpm install --frozen-lockfile --filter @peanut/gateway... 2>/dev/null || pnpm install --filter @peanut/gateway...

# Build shared types
COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter @peanut/shared-types build

# Build gateway
COPY services/gateway ./services/gateway
RUN pnpm --filter @peanut/gateway build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tini wget
RUN corepack enable pnpm

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=deps /app/services/gateway/dist ./services/gateway/dist
COPY --from=deps /app/services/gateway/node_modules ./services/gateway/node_modules

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "services/gateway/dist/server.js"]
