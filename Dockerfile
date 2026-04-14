LABEL org.opencontainers.image.source="https://github.com/Skekdog/Traitor-Uploader"

FROM oven/bun AS build

WORKDIR /app

COPY package.json package.json
COPY bun.lock bun.lock

RUN bun install

COPY ./Source ./Source

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	Source/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/server server
COPY drizzle drizzle

ENV NODE_ENV=production
ENV PORT=3000

CMD ["./server"]

EXPOSE 3000