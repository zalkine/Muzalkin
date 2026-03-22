# ── Stage 1: Node dependencies ────────────────────────────────────────────────
FROM node:20-slim AS node-deps

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Final image ───────────────────────────────────────────────────────
FROM node:20-slim

# Install Python 3 + pip (slim base has neither)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps in a venv so pip doesn't complain about system packages
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir cloudscraper beautifulsoup4 requests

# Copy Node app + pre-built node_modules
WORKDIR /app
COPY --from=node-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Copy Python scrapers
COPY scraper/ ./scraper/

# Cloud Run injects PORT; default to 3001 for local runs
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/backend
CMD ["node", "server.js"]
