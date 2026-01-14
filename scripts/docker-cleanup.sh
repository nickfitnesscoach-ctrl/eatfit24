#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/var/log/docker-cleanup.log"

{
  echo "==== $(date -Is) docker cleanup start ===="
  /usr/bin/docker builder prune -af --filter "until=168h"
  /usr/bin/docker image prune -af --filter "until=168h"
  echo "==== $(date -Is) docker cleanup end ===="
  echo
} >> "$LOG_FILE" 2>&1
