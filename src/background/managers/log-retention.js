/**
 * Task-log retention sweep (Store 3).
 *
 * saveTaskLogs() in logging-manager.js writes one folder per task run to the
 * browser's Downloads directory:
 *
 *   Downloads/browser-agent/<timestamp>-<sessionId>/log.json
 *   Downloads/browser-agent/<timestamp>-<sessionId>/screenshot_N.png
 *
 * It uses chrome.downloads.download, and nothing else in the codebase ever
 * deletes those files, so they accumulate forever. This module removes the
 * files older than a retention window.
 *
 * Configuration (chrome.storage.local):
 *   taskLogRetentionDays  number   days to keep. 0 = keep forever (disabled).
 *                                  unset/invalid → TASK_LOG_RETENTION.DEFAULT_DAYS.
 *   taskLogLastSweepAt    number   internal; epoch ms of the last completed sweep.
 *
 * Limitations of the chrome.downloads API:
 *   - removeFile() deletes a file permanently (it does NOT go to the Trash).
 *   - It can delete files, not directories, so the now-empty
 *     browser-agent/<folder>/ dirs are left behind. hardened/prune-task-logs.sh
 *     clears those (and is a full filesystem-side backstop if the download
 *     history records are ever cleared, which would hide old files from search).
 */

import { TASK_LOG_RETENTION } from '../modules/constants.js';

const ALARM_NAME = 'task-log-retention-sweep';

// Match ONLY our own task-log files, on either path separator. Deliberately
// strict (folder + exact file names) so an over-broad regex can never remove an
// unrelated download.
const TASK_LOG_FILENAME_REGEX =
  'browser-agent[\\\\/][^\\\\/]+[\\\\/](log\\.json|screenshot_\\d+\\.(?:png|jpe?g))$';

let sweepInFlight = false;

/**
 * Resolve the retention window in days.
 * @returns {Promise<number>} days to keep, or 0 for "keep forever".
 */
async function getRetentionDays() {
  try {
    const { taskLogRetentionDays } = await chrome.storage.local.get('taskLogRetentionDays');
    if (taskLogRetentionDays === 0 || taskLogRetentionDays === '0') return 0;
    const n = Math.floor(Number(taskLogRetentionDays));
    if (!Number.isFinite(n) || n < TASK_LOG_RETENTION.MIN_DAYS) {
      return TASK_LOG_RETENTION.DEFAULT_DAYS;
    }
    return n;
  } catch {
    return TASK_LOG_RETENTION.DEFAULT_DAYS;
  }
}

/**
 * Delete task-log files older than the retention window.
 * Safe to call concurrently — overlapping calls no-op.
 * @param {{ reason?: string }} [opts]
 * @returns {Promise<object>} summary for logging/tests
 */
export async function sweepOldTaskLogs({ reason = 'manual' } = {}) {
  if (sweepInFlight) return { skipped: 'in-flight' };
  sweepInFlight = true;
  try {
    const retentionDays = await getRetentionDays();
    if (retentionDays === 0) return { disabled: true };

    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    let items;
    try {
      items = await chrome.downloads.search({
        filenameRegex: TASK_LOG_FILENAME_REGEX,
        startedBefore: new Date(cutoffMs).toISOString(),
        state: 'complete',
        exists: true,
        limit: 0, // all matches
      });
    } catch (e) {
      console.warn('[LogRetention] downloads.search failed:', e?.message || e);
      return { error: 'search-failed' };
    }

    let filesRemoved = 0;
    let errors = 0;
    for (const item of items) {
      // startTime is authoritative — never delete anything inside the window.
      if (!item?.startTime || Date.parse(item.startTime) >= cutoffMs) continue;
      try {
        await chrome.downloads.removeFile(item.id);
        filesRemoved++;
      } catch {
        errors++;
        continue; // file already gone / on a detached volume — leave the record
      }
      try {
        await chrome.downloads.erase({ id: item.id });
      } catch {
        /* history record already gone — not fatal */
      }
    }

    if (filesRemoved > 0 || errors > 0) {
      console.log(
        `[LogRetention] ${reason}: removed ${filesRemoved} task-log file(s) older than ` +
        `${retentionDays}d (${errors} skipped, ${items.length} scanned)`
      );
    }
    return { filesRemoved, errors, scanned: items.length, retentionDays };
  } finally {
    sweepInFlight = false;
  }
}

/**
 * Throttled entry point for opportunistic callers (e.g. after a task finishes).
 * Runs at most once per TASK_LOG_RETENTION.MIN_SWEEP_INTERVAL_MS.
 * @param {string} reason
 */
export async function maybeSweepOldTaskLogs(reason = 'opportunistic') {
  try {
    const { taskLogLastSweepAt } = await chrome.storage.local.get('taskLogLastSweepAt');
    if (
      typeof taskLogLastSweepAt === 'number' &&
      Date.now() - taskLogLastSweepAt < TASK_LOG_RETENTION.MIN_SWEEP_INTERVAL_MS
    ) {
      return;
    }
  } catch {
    /* fall through and sweep */
  }
  const result = await sweepOldTaskLogs({ reason });
  if (!result?.skipped) {
    try {
      await chrome.storage.local.set({ taskLogLastSweepAt: Date.now() });
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Register the recurring sweep. Call once, synchronously, at service-worker load
 * so the chrome.alarms listener is in place across worker restarts.
 */
export function initTaskLogRetention() {
  // Guard: if the `alarms` or `downloads` permission was stripped from the
  // manifest (see HARDENING.md "least-privilege"), degrade quietly rather than
  // throwing at service-worker load. Opportunistic post-task sweeps still run.
  if (!chrome?.alarms?.onAlarm || !chrome?.downloads?.search) {
    console.warn('[LogRetention] alarms/downloads unavailable — recurring sweep disabled');
    return;
  }
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) void maybeSweepOldTaskLogs('alarm');
  });
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: TASK_LOG_RETENTION.STARTUP_DELAY_MINUTES,
    periodInMinutes: TASK_LOG_RETENTION.SWEEP_PERIOD_MINUTES,
  });
}
