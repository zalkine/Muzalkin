#!/usr/bin/env bash
# ── MuZalkin: auto-start backend when Codespace opens ──────────────────────
# Runs automatically via devcontainer "postStartCommand".
# Logs go to /tmp/muzalkin-backend.log

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
LOG="/tmp/muzalkin-backend.log"

echo "=== MuZalkin backend startup ==="

# Install deps if node_modules is absent
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "[backend] Installing dependencies..."
  (cd "$BACKEND_DIR" && npm install --silent)
fi

# Copy .env if it doesn't exist yet
if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "[backend] Created .env from .env.example — fill in Supabase keys!"
fi

# Kill any existing backend process on port 3001
fuser -k 3001/tcp 2>/dev/null || true

# Start backend in background
echo "[backend] Starting on port 3001..."
nohup node "$BACKEND_DIR/server.js" > "$LOG" 2>&1 &

echo "[backend] Started (PID $!). Logs: $LOG"
echo "=== Backend ready ==="
