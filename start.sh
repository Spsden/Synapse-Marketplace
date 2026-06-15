#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Starting API server (NestJS)..."
(cd "$ROOT_DIR" && npm run start:dev) &
API_PID=$!

echo "==> Starting frontend (Vite)..."
(cd "$ROOT_DIR/web" && npm run dev) &
WEB_PID=$!

cleanup() {
  echo ""
  echo "==> Shutting down..."
  kill $API_PID $WEB_PID 2>/dev/null
  wait $API_PID $WEB_PID 2>/dev/null
  echo "==> Done."
}
trap cleanup EXIT INT TERM

echo "==> Both servers running. Press Ctrl+C to stop."
wait
