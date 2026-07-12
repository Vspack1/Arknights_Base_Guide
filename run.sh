#!/usr/bin/env bash
# Build (nếu cần) và chạy AK Base Optimizer.
set -e
cd "$(dirname "$0")/backend"

if [ ! -d out ] || [ -z "$(ls -A out 2>/dev/null)" ]; then
  echo "[build] Compiling Java backend..."
  mkdir -p out
  javac -d out src/main/java/ak/base/*.java
fi

PORT="${1:-8080}"
echo "[run] Starting server on http://localhost:${PORT}"
java -cp out ak.base.Server "$PORT"
