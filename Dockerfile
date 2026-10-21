# =======================================================
# Stage 1: Build Frontend (Vite SPA)
# =======================================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Copy package manifests & install frontend dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build static production bundle
COPY frontend/ ./
RUN npm run build

# =======================================================
# Stage 2: Production Server (Node.js + Express API)
# =======================================================
FROM node:20-slim AS runner
WORKDIR /app

# Install openssl (required by Prisma engine) and ca-certificates
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy backend dependencies & Prisma schema first for layer caching
COPY backend/package*.json ./
COPY backend/prisma/ ./prisma/

# Install production dependencies & generate Prisma client
RUN npm ci
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy backend source code & scripts
COPY backend/ ./

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create persistent storage folder for SQLite fallback
RUN mkdir -p /app/backend/data
ENV DB_PATH=/app/backend/data/database.sqlite
ENV PORT=3000
ENV NODE_ENV=production

# Copy initial SQLite database if available as starting template
RUN if [ -f /app/backend/database.sqlite ]; then cp /app/backend/database.sqlite /app/backend/data/database.sqlite; fi

# Expose server port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start Express server
CMD ["npm", "start"]
