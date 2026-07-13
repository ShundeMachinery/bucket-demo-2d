# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_DIRECTUS_URL=/directus
ARG VITE_BASE_PATH=/
ENV VITE_DIRECTUS_URL=$VITE_DIRECTUS_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN bun run build

FROM caddy:2-alpine AS runtime

ENV DIRECTUS_UPSTREAM=http://124.223.157.37:8055

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1/ || exit 1
