FROM oven/bun:alpine AS build

LABEL org.opencontainers.image.source="https://github.com/Skekdog/Traitor-Uploader"

WORKDIR /app

COPY package.json package.json
COPY bun.lock bun.lock

RUN bun install

COPY ./Source ./Source

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--external @libsql/linux-x64-musl \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	Source/index.ts

FROM oven/bun:alpine

WORKDIR /app

RUN apk --no-cache add libstdc++ libgcc

COPY --from=build /app/server server
COPY drizzle drizzle
COPY package.json package.json
COPY bun.lock bun.lock

RUN bun install --frozen --production

RUN chmod +x ./server

ENV DATA_DIR="/app/data"
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

VOLUME ["/app/data"]

CMD ["./server"]