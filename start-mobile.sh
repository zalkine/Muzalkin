#!/usr/bin/env bash
# ── MuZalkin: start Expo for mobile testing ────────────────────────────────
#
# Usage:  ./start-mobile.sh
#
# What it does:
#   1. Auto-detects the Codespace backend URL and writes it to mobile/.env
#   2. Makes sure backend is running (starts it if not)
#   3. Launches Expo with --tunnel so your Android phone can connect
#      from anywhere — no need to be on the same WiFi.
#
# Prerequisites:
#   • Expo Go installed on your Android phone
#   • mobile/.env must have EXPO_PUBLIC_SUPABASE_URL and
#     EXPO_PUBLIC_SUPABASE_ANON_KEY filled in

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
MOBILE_DIR="$REPO_ROOT/mobile"
BACKEND_LOG="/tmp/muzalkin-backend.log"

echo ""
echo "╔══════════════════════════════════╗"
echo "║   MuZalkin — Mobile Dev Start   ║"
echo "╚══════════════════════════════════╝"
echo ""

# ── 1. Detect or prompt for backend URL ────────────────────────────────────
if [ -n "$CODESPACE_NAME" ] && [ -n "$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" ]; then
  BACKEND_URL="https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  echo "✔  Codespace detected"
  echo "   Backend URL: $BACKEND_URL"
else
  BACKEND_URL="http://localhost:3001"
  echo "ℹ  Running locally — backend URL: $BACKEND_URL"
fi

# ── 2. Write EXPO_PUBLIC_API_URL to mobile/.env ────────────────────────────
ENV_FILE="$MOBILE_DIR/.env"

if [ ! -f "$ENV_FILE" ] && [ -f "$MOBILE_DIR/.env.example" ]; then
  cp "$MOBILE_DIR/.env.example" "$ENV_FILE"
fi

if [ -f "$ENV_FILE" ]; then
  # Update or append EXPO_PUBLIC_API_URL
  if grep -q "EXPO_PUBLIC_API_URL" "$ENV_FILE"; then
    sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$BACKEND_URL|" "$ENV_FILE"
  else
    echo "EXPO_PUBLIC_API_URL=$BACKEND_URL" >> "$ENV_FILE"
  fi
else
  # Create minimal .env
  echo "EXPO_PUBLIC_API_URL=$BACKEND_URL" > "$ENV_FILE"
fi

echo "✔  mobile/.env updated (EXPO_PUBLIC_API_URL=$BACKEND_URL)"

# ── 3. Check Supabase keys ──────────────────────────────────────────────────
if ! grep -q "EXPO_PUBLIC_SUPABASE_URL=https://" "$ENV_FILE" 2>/dev/null; then
  echo ""
  echo "⚠️  WARNING: EXPO_PUBLIC_SUPABASE_URL is not set in mobile/.env"
  echo "   The app will not work without Supabase credentials."
  echo "   Edit mobile/.env and add:"
  echo "     EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co"
  echo "     EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY"
  echo ""
fi

# ── 4. Make sure backend is running ────────────────────────────────────────
if ! curl -sf http://localhost:3001/health > /dev/null 2>&1; then
  echo "▶  Backend not running — starting it..."

  if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "   Installing backend dependencies..."
    (cd "$BACKEND_DIR" && npm install --silent)
  fi

  if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "   Created backend/.env from .env.example"
  fi

  fuser -k 3001/tcp 2>/dev/null || true
  nohup node "$BACKEND_DIR/server.js" > "$BACKEND_LOG" 2>&1 &
  echo "   Waiting for backend..."
  sleep 2

  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "✔  Backend is up"
  else
    echo "⚠️  Backend may have failed. Check: $BACKEND_LOG"
  fi
else
  echo "✔  Backend already running"
fi

# ── 5. Install mobile deps if needed ───────────────────────────────────────
if [ ! -d "$MOBILE_DIR/node_modules" ]; then
  echo "▶  Installing mobile dependencies (first time, may take a minute)..."
  (cd "$MOBILE_DIR" && npm install --silent)
fi

# ── 6. Start Expo with tunnel ───────────────────────────────────────────────
echo ""
echo "▶  Starting Expo (tunnel mode)..."
echo "   Scan the QR code with Expo Go on your Android phone."
echo ""

cd "$MOBILE_DIR"
npx expo start --tunnel
