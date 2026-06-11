#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

port_in_use() {
  local port="$1"
  lsof -t -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for() {
  local label="$1"
  local command_text="$2"
  local max_attempts="${3:-30}"

  echo "Waiting for $label..."
  for _ in $(seq 1 "$max_attempts"); do
    if eval "$command_text" >/dev/null 2>&1; then
      echo "$label is ready."
      return 0
    fi
    sleep 2
  done

  echo "Timed out waiting for $label." >&2
  return 1
}

launch_terminal_tab() {
  local dir="$1"
  local command_text="$2"
  local title="$3"
  local port="$4"

  if port_in_use "$port"; then
    echo "Skipping $title; port $port is already in use."
    return 0
  fi

  echo "Launching $title on port $port..."
  osascript - "$dir" "$command_text" <<'APPLESCRIPT'
on run argv
  set targetDir to item 1 of argv
  set targetCommand to item 2 of argv

  tell application "Terminal"
    activate
    if (count of windows) = 0 then
      do script "cd " & quoted form of targetDir & " && " & targetCommand
    else
      tell application "System Events" to keystroke "t" using command down
      delay 0.3
      do script "cd " & quoted form of targetDir & " && " & targetCommand in window 1
    end if
  end tell
end run
APPLESCRIPT
  sleep 0.5
}

require_command docker
require_command npm
require_command go
require_command python3
require_command mvn
require_command osascript

echo "=================================================="
echo " Starting AegisOps Local Infrastructure (Docker)"
echo "=================================================="
cd "$ROOT_DIR"
docker compose up -d

wait_for "PostgreSQL" "docker compose exec -T postgres pg_isready -U '${POSTGRES_USER:-aegisops}' -d '${POSTGRES_DB:-aegisops}'"
wait_for "Redis" "docker compose exec -T redis redis-cli ping"
wait_for "RabbitMQ" "docker compose exec -T rabbitmq rabbitmq-diagnostics -q ping"
wait_for "Kafka" "docker compose exec -T kafka kafka-topics --bootstrap-server localhost:9092 --list"

echo "Applying database migrations..."
(cd "$ROOT_DIR/services/core-api" && npm run migrate)
(cd "$ROOT_DIR/services/deployment-tracker" && npm run migrate)

echo "=================================================="
echo " Launching Host Application Services in Terminal"
echo "=================================================="

launch_terminal_tab "$ROOT_DIR/services/core-api" "npm run dev" "Core API" 4000
launch_terminal_tab "$ROOT_DIR/services/worker-service" "npm run dev" "Worker Service" 4020
launch_terminal_tab "$ROOT_DIR/services/deployment-tracker" "npm run dev" "Deployment Tracker" 4010
launch_terminal_tab "$ROOT_DIR/apps/web-dashboard" "npm run dev" "Web Dashboard" 5173
launch_terminal_tab "$ROOT_DIR/services/log-ingester" "go run ./cmd/log-ingester" "Log Ingester" 5001
launch_terminal_tab "$ROOT_DIR/services/metrics-service" "go run ./cmd/metrics-service" "Metrics Service" 5002
launch_terminal_tab "$ROOT_DIR/services/ai-rca-service" "if [ ! -x .venv/bin/uvicorn ]; then python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt; else . .venv/bin/activate; fi && uvicorn app.main:app --host 0.0.0.0 --port 8000" "AI RCA Service" 8000
launch_terminal_tab "$ROOT_DIR/services/notification-service" "mvn spring-boot:run" "Notification Service" 8085

echo "=================================================="
echo " Application services launched or already running."
echo " Run ./scripts/smoke-test.sh after health checks pass."
echo "=================================================="
