# syntax=docker/dockerfile:1
# Produção: Next.js output standalone + Prisma Client (sem Prisma CLI no runtime)
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
# Evita confundir com DATABASE_URL do build; use sempre `environment` do Compose na VPS.
RUN rm -f /app/.env
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R nextjs:nodejs /app

# Server actions de provisionamento chamam `ssh` (ver admin-master/camaras/actions.ts).
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssh-client \
  && rm -rf /var/lib/apt/lists/*

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
