# Dockerfile para Monitor Imobiliário
# Deploy: Oracle Cloud Free Tier (VM ARM — aarch64)
# Node.js 20 LTS + Playwright Chromium

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# ── Dependências do sistema para Playwright + Sharp ──────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Instalar dependências Node ────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Build da aplicação ────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Imagem final ──────────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dependências do sistema necessárias em runtime
# (Playwright Chromium + Sharp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chromium deps
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    # Sharp / vips
    libvips42 \
    # Fontes mínimas
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copia artefatos do build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/src/instrumentation.ts ./src/instrumentation.ts

# Instala Playwright Chromium (após copiar node_modules)
RUN npx playwright install --with-deps chromium

# Volume para banco + fotos (dados persistentes)
VOLUME /app/data

# Pasta de fotos
RUN mkdir -p /app/data/photos

EXPOSE 3000

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && chown -R nextjs:nodejs /app
USER nextjs

CMD ["npm", "start"]
