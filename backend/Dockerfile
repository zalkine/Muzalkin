FROM node:20-slim AS web-builder

# Build the React web app
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── Main image ──────────────────────────────────────────────────────────────
FROM node:20-slim

# Install Python for the Tab4U / Ultimate Guitar scrapers
RUN apt-get update && apt-get install -y python3 python3-venv && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a Python venv and install scraper dependencies
COPY backend/requirements.txt ./
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --upgrade pip && /opt/venv/bin/pip install -r requirements.txt

# Make venv python the default
ENV PATH="/opt/venv/bin:$PATH"

# Install Node dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built web app to public/ so Express can serve it
COPY --from=web-builder /web/dist ./public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
