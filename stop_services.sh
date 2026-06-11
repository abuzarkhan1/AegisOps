#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STOP_INFRA=false

usage() {
  cat <<'EOF'
Usage: ./stop_services.sh [--with-infra]

Stops host-run AegisOps application services.

Options:
  --with-infra   Also run docker compose down for shared infrastructure.
  -h, --help     Show this help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --with-infra|--infra)
      STOP_INFRA=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

terminate_port() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "$label port $port is free."
    return 0
  fi

  echo "Stopping $label on port $port:"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
  kill $pids 2>/dev/null || true

  for _ in $(seq 1 10); do
    if ! lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$label stopped."
      return 0
    fi
    sleep 1
  done

  echo "$label did not stop gracefully; forcing termination."
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
  fi
}

echo "=================================================="
echo " Stopping AegisOps Host Services"
echo "=================================================="

terminate_port 5173 "Web Dashboard"
terminate_port 4000 "Core API"
terminate_port 4010 "Deployment Tracker"
terminate_port 4020 "Worker Service"
terminate_port 5001 "Log Ingester"
terminate_port 5002 "Metrics Service"
terminate_port 8000 "AI RCA Service"
terminate_port 8085 "Notification Service"

if [ "$STOP_INFRA" = true ]; then
  echo "Stopping Docker infrastructure..."
  (cd "$ROOT_DIR" && docker compose down)
  echo "Docker infrastructure stopped."
else
  echo "Docker infrastructure left running. Use --with-infra to stop it too."
fi

echo "All cleanup operations completed."
