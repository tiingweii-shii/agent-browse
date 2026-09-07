#!/usr/bin/env bash
#
# Filesystem-side retention sweep for Store 3 — the per-task log folders that
# saveTaskLogs() drops into the browser's Downloads directory:
#
#   ~/Downloads/browser-agent/<timestamp>-<sessionId>/log.json
#   ~/Downloads/browser-agent/<timestamp>-<sessionId>/screenshot_N.png
#
# The extension already sweeps these via chrome.downloads (managers/log-retention.js),
# but that path can only delete FILES it still has a download-history record for,
# and it leaves the now-empty folders behind. This script is the backstop:
#   - removes whole task-log folders older than the retention window (by mtime)
#   - removes any leftover empty folders
#
# It is safe to run by hand or from cron/launchd. It only ever touches paths under
# <Downloads>/browser-agent.
#
# Usage:
#   hardened/prune-task-logs.sh [DAYS]
#   RETENTION_DAYS=30 hardened/prune-task-logs.sh
#   TASK_LOG_DIR="$HOME/Downloads/browser-agent" hardened/prune-task-logs.sh 7 --dry-run
#
# Args / env:
#   DAYS (positional) or RETENTION_DAYS   days to keep       (default: 14)
#   TASK_LOG_DIR                          folder to prune     (default: ~/Downloads/browser-agent)
#   --dry-run                             print, don't delete

set -euo pipefail

RETENTION_DAYS="${1:-${RETENTION_DAYS:-14}}"
[[ "${RETENTION_DAYS}" == "--dry-run" ]] && RETENTION_DAYS=14   # allow `script --dry-run`
TASK_LOG_DIR="${TASK_LOG_DIR:-$HOME/Downloads/browser-agent}"
DRY_RUN=0
for a in "$@"; do [[ "$a" == "--dry-run" ]] && DRY_RUN=1; done

if ! [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
  echo "error: retention days must be a non-negative integer (got '${RETENTION_DAYS}')" >&2
  exit 2
fi

if [[ ! -d "${TASK_LOG_DIR}" ]]; then
  echo "nothing to do: ${TASK_LOG_DIR} does not exist"
  exit 0
fi

# Guard: never operate on a path that isn't the task-log dir.
case "${TASK_LOG_DIR}" in
  */browser-agent) : ;;
  *) echo "refusing to prune '${TASK_LOG_DIR}' — path must end in /browser-agent" >&2; exit 2 ;;
esac

if [[ "${RETENTION_DAYS}" -eq 0 ]]; then
  echo "RETENTION_DAYS=0 (keep forever) — only clearing empty folders"
else
  echo "Pruning task-log folders older than ${RETENTION_DAYS} day(s) in ${TASK_LOG_DIR}"
  while IFS= read -r -d '' dir; do
    if [[ "${DRY_RUN}" -eq 1 ]]; then
      echo "  would remove  ${dir}"
    else
      rm -rf -- "${dir}"
      echo "  removed       ${dir}"
    fi
  done < <(find "${TASK_LOG_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print0)
fi

# Sweep any empty folders the extension's file-only deletes left behind.
while IFS= read -r -d '' dir; do
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "  would remove  ${dir} (empty)"
  else
    rmdir -- "${dir}" 2>/dev/null && echo "  removed       ${dir} (empty)" || true
  fi
done < <(find "${TASK_LOG_DIR}" -mindepth 1 -maxdepth 1 -type d -empty -print0)

echo "done."
