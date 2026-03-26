# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/

# Install all dependencies
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source
COPY apps/web/ apps/web/
COPY tsconfig.json ./

# Build the web app
RUN cd apps/web && bun run build

# Stage 2: Runtime
FROM oven/bun:1-alpine

WORKDIR /app

# Install conversion tools
RUN apk add --no-cache pandoc

# Install kepubify (detect architecture)
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      wget -O /usr/local/bin/kepubify https://github.com/pgaskin/kepubify/releases/latest/download/kepubify-linux-arm64; \
    else \
      wget -O /usr/local/bin/kepubify https://github.com/pgaskin/kepubify/releases/latest/download/kepubify-linux-64bit; \
    fi && chmod +x /usr/local/bin/kepubify

# Copy Nitro server output
COPY --from=builder /app/apps/web/.output ./.output

# Copy package files for production deps
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
RUN bun install --production --ignore-scripts

# Copy DB config, migrations, and migrate script
COPY --from=builder /app/apps/web/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/apps/web/src/db ./src/db
COPY --from=builder /app/apps/web/drizzle ./drizzle

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /app/scripts/
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Create directories
RUN mkdir -p /app/excalibre /app/data

ENV DATABASE_URL=/app/excalibre/sqlite.db
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
