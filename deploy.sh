

#!/bin/bash

# --- Configuration ---
PROJECT_ROOT="/data/nmrxiv-nodejs-microservice"
IMAGE="nfdi4chem/nodejs-microservice:latest"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
LOG_FILE="/data/nmrxiv-nodejs-deploy.log"
LOG_DIR=$(dirname "$LOG_FILE")

# --- Helper Functions ---
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

fatal() {
  log "ERROR: $1"
  exit 1
}

# --- Environment Setup ---
cd "$PROJECT_ROOT" || fatal "Could not change to project root directory $PROJECT_ROOT"

if [ ! -d "$LOG_DIR" ]; then
  mkdir -p "$LOG_DIR" || fatal "Could not create log directory $LOG_DIR"
  chmod 755 "$LOG_DIR"
fi

if [ ! -f "$LOG_FILE" ]; then
  touch "$LOG_FILE" || fatal "Could not create log file $LOG_FILE"
  chmod 644 "$LOG_FILE"
fi

START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
log "Script started at: $START_TIME"

# --- Pre-checks ---
[ -f ".env" ] || fatal ".env file not found in $PROJECT_ROOT. Exiting."
[ -f "$COMPOSE_FILE" ] || fatal "Docker compose file not found at $COMPOSE_FILE. Exiting."

# --- Main Logic ---
log "Checking for updates to Docker image: $IMAGE"
PULL_OUTPUT=$(docker pull "$IMAGE")
log "$PULL_OUTPUT"

if [ "$(echo "$PULL_OUTPUT" | grep -c "Status: Image is up to date")" -eq 0 ]; then
  log "New image detected. Redeploying service..."
  docker compose -f "$COMPOSE_FILE" down | tee -a "$LOG_FILE"
  docker compose -f "$COMPOSE_FILE" pull | tee -a "$LOG_FILE"
  docker compose -f "$COMPOSE_FILE" up -d | tee -a "$LOG_FILE"
  log "Deployment complete."
else
  log "Image is up to date. No redeployment needed."
fi

log "Cleaning up unused Docker images..."
docker image prune -f | tee -a "$LOG_FILE"

END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
log "Script finished at: $END_TIME"