#!/usr/bin/env bash

# Start docker services if not already running
echo "=================================================="
echo " Starting AegisOps Local Infrastructure (Docker)"
echo "=================================================="
docker compose up -d

# Check health of Docker Compose services
echo "Waiting for Docker containers to be healthy..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-aegisops}" -d "${POSTGRES_DB:-aegisops}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Applying database migrations..."
(cd "/Users/abuzar/Desktop/AegisOps/services/core-api" && npm run migrate)
(cd "/Users/abuzar/Desktop/AegisOps/services/deployment-tracker" && npm run migrate)

# Command helper to launch a new tab with a command in Terminal.app
run_in_new_tab() {
  local dir="$1"
  local cmd="$2"
  local title="$3"
  echo "Launching $title in a new Terminal tab..."
  osascript <<EOF
    tell application "Terminal"
      activate
      tell application "System Events" to keystroke "t" using command down
      delay 0.3
      do script "cd '$dir' && $cmd" in window 1
    end tell
EOF
  sleep 0.5
}

# The first service will open in a new window/tab
echo "=================================================="
echo " Launching Host Application Services in Terminal"
echo "=================================================="

echo "Launching Core API..."
osascript <<EOF
  tell application "Terminal"
    activate
    do script "cd '/Users/abuzar/Desktop/AegisOps/services/core-api' && npm run dev"
  end tell
EOF
sleep 1.0

# Open other services in subsequent tabs
run_in_new_tab "/Users/abuzar/Desktop/AegisOps/services/worker-service" "npm run dev" "Worker Service"
run_in_new_tab "/Users/abuzar/Desktop/AegisOps/services/deployment-tracker" "npm run dev" "Deployment Tracker"
run_in_new_tab "/Users/abuzar/Desktop/AegisOps/services/log-ingester" "go run ./cmd/log-ingester" "Log Ingester"
run_in_new_tab "/Users/abuzar/Desktop/AegisOps/services/metrics-service" "go run ./cmd/metrics-service" "Metrics Service"
run_in_new_tab "/Users/abuzar/Desktop/AegisOps/services/ai-rca-service" "source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000" "AI RCA Service"
run_in_new_tab "/Users/abuzar/Desktop/AegisOps/services/notification-service" "mvn spring-boot:run" "Notification Service"

echo "=================================================="
echo " All services have been launched in Terminal tabs!"
echo "=================================================="
