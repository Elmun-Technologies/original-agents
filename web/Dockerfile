# Yeppo web (Next.js standalone + Payload). Database migrations run when the server starts (prodMigrations).
# Build needs ~2 GB RAM; the running server stays under ~400 MB.
FROM node:22.23.5-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable pnpm && corepack prepare pnpm@10.28.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# no database during the build: pages render on first request (generateStaticParams = [])
RUN SKIP_TYPECHECK=1 NODE_OPTIONS="--no-deprecation --max-old-space-size=2048" pnpm exec next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Tashkent
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# uploads (Payload media) live on a volume mounted here
RUN mkdir -p media .next/cache && chown -R nextjs:nodejs media .next
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/robots.txt || exit 1
CMD ["node", "server.js"]
