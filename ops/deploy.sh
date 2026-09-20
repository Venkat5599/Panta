#!/usr/bin/env bash
#
# Deploy the factory to the VPS.
#
# Release-directory pattern: each deploy lands in its own directory and the
# `current` symlink is swapped only after a health check passes. A failed
# deploy leaves the previous release running and untouched, so the rollback
# path is the same as the deploy path minus the upload.
#
# Usage:  ops/deploy.sh <git-sha>
set -euo pipefail

SHA="${1:?usage: deploy.sh <git-sha>}"
APP_DIR=/opt/premium
RELEASE="$APP_DIR/releases/$SHA"
CURRENT="$APP_DIR/current"
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT:-8787}/health"
KEEP_RELEASES=5

echo "==> Installing dependencies in $RELEASE"
cd "$RELEASE"
bun install --frozen-lockfile --production

echo "==> Recording the release currently live, for rollback"
PREVIOUS=""
if [ -L "$CURRENT" ]; then PREVIOUS="$(readlink -f "$CURRENT")"; fi

echo "==> Switching the symlink"
ln -sfn "$RELEASE" "$CURRENT"

echo "==> Restarting"
sudo systemctl restart premium-factory

echo "==> Waiting for health"
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "==> Healthy after ${attempt}s"

    # Prune old releases, keeping enough history to roll back more than once.
    cd "$APP_DIR/releases"
    ls -1t | tail -n "+$((KEEP_RELEASES + 1))" | xargs -r rm -rf
    echo "==> Deployed $SHA"
    exit 0
  fi
  sleep 1
done

echo "!! Health check failed after 30s"
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
  echo "!! Rolling back to $PREVIOUS"
  ln -sfn "$PREVIOUS" "$CURRENT"
  sudo systemctl restart premium-factory
  echo "!! Rolled back. The new release was NOT activated."
else
  echo "!! No previous release to roll back to. The service may be down."
fi
exit 1
