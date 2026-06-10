#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/workspace/azure-simple-mon}"
DEPLOY_REF="${DEPLOY_REF:?DEPLOY_REF is required}"
SERVICE_NAME="${SERVICE_NAME:-delivery-kpi-dashboard.service}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:5762/api/test}"
NODE_PATH_PREFIX="${NODE_PATH_PREFIX:-/home/ubuntu/.local/bin:/home/ubuntu/.hermes/node-v24.11.1-linux-x64/bin}"
export PATH="$NODE_PATH_PREFIX:$PATH"
export NODE_ENV=production

log() {
  printf '[deploy] %s\n' "$*"
}

run() {
  log "+ $*"
  "$@"
}

wait_for_healthcheck() {
  local url="$1"
  local attempts="${2:-30}"
  local delay="${3:-2}"

  for i in $(seq 1 "$attempts"); do
    if curl --fail --silent --show-error --max-time 10 "$url" >/dev/null; then
      log "healthcheck ok: $url"
      return 0
    fi
    log "healthcheck pending ($i/$attempts): $url"
    sleep "$delay"
  done

  log "healthcheck failed: $url"
  return 1
}

restart_service() {
  local service="$1"

  if timeout 20 systemctl restart "$service"; then
    log "service restarted via systemctl: $service"
    return 0
  fi

  log "systemctl restart failed or requires authorization; falling back to TERM MainPID"
  local pid
  pid="$(systemctl show -p MainPID --value "$service" 2>/dev/null || true)"

  if [[ "$pid" =~ ^[0-9]+$ ]] && [ "$pid" -gt 1 ]; then
    run kill -TERM "$pid"
  else
    log "no valid MainPID found for $service"
    return 1
  fi

  for i in $(seq 1 30); do
    local active new_pid
    active="$(systemctl show -p ActiveState --value "$service" 2>/dev/null || true)"
    new_pid="$(systemctl show -p MainPID --value "$service" 2>/dev/null || true)"
    if [ "$active" = "active" ] && [[ "$new_pid" =~ ^[0-9]+$ ]] && [ "$new_pid" -gt 1 ] && [ "$new_pid" != "$pid" ]; then
      log "service restarted by systemd: $service pid=$new_pid"
      return 0
    fi
    sleep 1
  done

  log "service did not restart cleanly: $service"
  systemctl status "$service" --no-pager || true
  return 1
}

log "deploy ref: $DEPLOY_REF"
log "app dir: $APP_DIR"

cd "$APP_DIR"
run git fetch --tags --prune origin
run git checkout --detach "$DEPLOY_REF"
run git reset --hard "$DEPLOY_REF"

run node --version
run npm --version
run npm ci
run npm run build

restart_service "$SERVICE_NAME"
wait_for_healthcheck "$HEALTHCHECK_URL"

log "deployed $DEPLOY_REF successfully"
