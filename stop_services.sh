#!/usr/bin/env bash

# Enable error handling
set -e

echo "=================================================="
echo " Stopping AegisOps Host Services"
echo "=================================================="

# Ports used by local host services:
# 4000: Core API
# 4010: Deployment Tracker
# 4020: Worker Service
# 5001: Log Ingester
# 5002: Metrics Service
# 8000: AI RCA Service
# 8085: Notification Service
PORTS=(4000 4010 4020 5001 5002 8000 8085)

for port in "${PORTS[@]}"; do
  # Get all PIDs listening on the port
  pids=$(lsof -t -i :$port -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Port $port is in use. Stopping process(es):"
    # Print process details
    lsof -i :$port -sTCP:LISTEN
    # Kill the processes
    echo "Killing PIDs: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    echo "Port $port freed."
  else
    echo "Port $port is free."
  fi
done

echo "=================================================="
echo " Host services stopped."
echo "=================================================="

# Prompt or default to stopping docker container infrastructure
read -p "Do you also want to stop the Docker infrastructure? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Stopping Docker containers..."
  docker compose down
  echo "Docker infrastructure stopped."
fi

echo "All cleanup operations completed!"
