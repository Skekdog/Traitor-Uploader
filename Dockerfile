FROM ghcr.io/pnpm/pnpm:12 AS base
LABEL org.opencontainers.image.source="https://github.com/Skekdog/Traitor-Uploader"
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
ENV CI=1
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm build

FROM node:26-slim AS runner
WORKDIR /app

ENV DATA_DIR="/app/data"
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json

VOLUME ["/app/data"]

CMD ["node", ".output/server/index.mjs"]
