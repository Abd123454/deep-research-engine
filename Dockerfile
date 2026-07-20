# Dockerfile for Deep Research Engine — multi-stage build using Next.js standalone output.
#
# Build:  docker build -t deep-research-engine .
# Run:    docker run -p 3000:3000 --env-file .env deep-research-engine
#
# The standalone output (next.config.ts: output: "standalone") produces a
# self-contained server.js that doesn't need node_modules at runtime.

# ---------- Stage 1: deps ----------
FROM node:22-slim AS deps
WORKDIR /app

# Install bun for faster installs (matches the dev workflow).
RUN npm install -g bun

# Copy lockfile + package.json only (cache layer).
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g bun

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build.
ENV NEXT_TELEMETRY_DISABLED=1

# Build the standalone output.
RUN bun run build

# ---------- Stage 3: runner ----------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs

# Copy the standalone build + static assets + public.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
