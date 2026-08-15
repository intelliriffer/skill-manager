#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "→ npm install"
  npm install
fi

echo "→ vite build"
npm run build

echo "→ starting on http://127.0.0.1:4217"
node server/index.js &
SERVER_PID=$!

sleep 1
open "http://127.0.0.1:4217" 2>/dev/null || xdg-open "http://127.0.0.1:4217" 2>/dev/null || true

wait $SERVER_PID
