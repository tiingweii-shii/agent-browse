import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sweepOldTaskLogs, maybeSweepOldTaskLogs } from './log-retention.js';
import { TASK_LOG_RETENTION } from '../modules/constants.js';

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n) {
  return new Date(Date.now() - n * DAY).toISOString();
}

/** Install a chrome.downloads + chrome.storage.local mock over the base test mock. */
function installDownloadsMock(items, store = {}) {
  const removeFile = vi.fn(async (id) => {
    if (!items.some((i) => i.id === id)) throw new Error('no such download');
  });
  const erase = vi.fn(async () => []);
  const search = vi.fn(async (query) => {
    let out = items;
    if (query.startedBefore) {
      const before = Date.parse(query.startedBefore);
      out = out.filter((i) => Date.parse(i.startTime) < before);
    }
    return out;
  });
  globalThis.chrome.downloads = { search, removeFile, erase };
  globalThis.chrome.storage.local.get = vi.fn(async (keys) => {
    const wanted = Array.isArray(keys) ? keys : [keys];
    const res = {};
    for (const k of wanted) if (k in store) res[k] = store[k];
    return res;
  });
  globalThis.chrome.storage.local.set = vi.fn(async (obj) => Object.assign(store, obj));
  return { search, removeFile, erase, store };
}

describe('sweepOldTaskLogs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes task-log files older than the retention window and keeps recent ones', async () => {
    const items = [
      { id: 1, startTime: daysAgo(40) },
      { id: 2, startTime: daysAgo(20) },
      { id: 3, startTime: daysAgo(3) },
    ];
    const { removeFile, erase } = installDownloadsMock(items, { taskLogRetentionDays: 14 });

    const res = await sweepOldTaskLogs({ reason: 'test' });

    expect(res.filesRemoved).toBe(2);
    expect(removeFile).toHaveBeenCalledWith(1);
    expect(removeFile).toHaveBeenCalledWith(2);
    expect(removeFile).not.toHaveBeenCalledWith(3);
    expect(erase).toHaveBeenCalledTimes(2);
  });

  it('is disabled when taskLogRetentionDays is 0 (keep forever)', async () => {
    const { removeFile } = installDownloadsMock(
      [{ id: 1, startTime: daysAgo(999) }],
      { taskLogRetentionDays: 0 }
    );
    const res = await sweepOldTaskLogs({ reason: 'test' });
    expect(res).toEqual({ disabled: true });
    expect(removeFile).not.toHaveBeenCalled();
  });

  it('falls back to the default window when the setting is unset or invalid', async () => {
    const cutoff = TASK_LOG_RETENTION.DEFAULT_DAYS;
    const items = [
      { id: 1, startTime: daysAgo(cutoff + 5) },
      { id: 2, startTime: daysAgo(cutoff - 5) },
    ];
    const { removeFile } = installDownloadsMock(items, { taskLogRetentionDays: 'nonsense' });
    const res = await sweepOldTaskLogs({ reason: 'test' });
    expect(res.retentionDays).toBe(cutoff);
    expect(removeFile).toHaveBeenCalledWith(1);
    expect(removeFile).not.toHaveBeenCalledWith(2);
  });

  it('never deletes an item whose startTime is inside the window, even if search returns it', async () => {
    // search mock returns everything regardless of the query
    const items = [{ id: 1, startTime: daysAgo(2) }];
    globalThis.chrome.downloads = {
      search: vi.fn(async () => items),
      removeFile: vi.fn(async () => {}),
      erase: vi.fn(async () => []),
    };
    globalThis.chrome.storage.local.get = vi.fn(async () => ({ taskLogRetentionDays: 14 }));
    globalThis.chrome.storage.local.set = vi.fn(async () => {});

    const res = await sweepOldTaskLogs({ reason: 'test' });
    expect(res.filesRemoved).toBe(0);
    expect(globalThis.chrome.downloads.removeFile).not.toHaveBeenCalled();
  });

  it('tolerates removeFile failures (file already gone) without aborting the sweep', async () => {
    const items = [
      { id: 1, startTime: daysAgo(40) },
      { id: 2, startTime: daysAgo(40) },
    ];
    installDownloadsMock(items, { taskLogRetentionDays: 14 });
    globalThis.chrome.downloads.removeFile = vi.fn(async (id) => {
      if (id === 1) throw new Error('file missing');
    });

    const res = await sweepOldTaskLogs({ reason: 'test' });
    expect(res.filesRemoved).toBe(1);
    expect(res.errors).toBe(1);
  });
});

describe('maybeSweepOldTaskLogs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips when a sweep ran within the throttle window', async () => {
    const { search } = installDownloadsMock([], {
      taskLogLastSweepAt: Date.now() - 60 * 1000, // 1 min ago
    });
    await maybeSweepOldTaskLogs('test');
    expect(search).not.toHaveBeenCalled();
  });

  it('runs and records the timestamp when the throttle window has passed', async () => {
    const { search, store } = installDownloadsMock([], {
      taskLogLastSweepAt: Date.now() - (TASK_LOG_RETENTION.MIN_SWEEP_INTERVAL_MS + 1000),
    });
    await maybeSweepOldTaskLogs('test');
    expect(search).toHaveBeenCalledTimes(1);
    expect(typeof store.taskLogLastSweepAt).toBe('number');
    expect(store.taskLogLastSweepAt).toBeGreaterThan(Date.now() - 5000);
  });
});
