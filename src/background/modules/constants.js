// Timing delays (milliseconds)
export const DELAYS = {
  RETRY: 200,
  SCREENSHOT_IDLE_MIN: 30,
  SCREENSHOT_IDLE_MAX: 80,
  CLICK_BEFORE: 20,
  CLICK_AFTER: 100,
  NEW_TAB_DETECTION: 300,
  NAVIGATE_WAIT: 2000,
  TYPE_CHAR_MIN: 30,
  TYPE_CHAR_MAX: 80,
};

export const RETRIES = {
  MAX_TAB_GROUP: 5,
  MAX_SCREENSHOT: 3,
};

export const LIMITS = {
  LOG_DATA_CHARS: 2000, // Keep debug entries small - screenshots saved as separate files
  LOG_ENTRIES: 200,
  CLEAN_TURN_CONTENT: 2000,
  PAGE_TEXT_CHARS: 50000,
  CONSOLE_MESSAGES: 500,
  NETWORK_REQUESTS: 1000,
};

// Task-log retention (Store 3: saveTaskLogs → Downloads/browser-agent/<folder>/)
export const TASK_LOG_RETENTION = {
  DEFAULT_DAYS: 14,     // used when `taskLogRetentionDays` is unset or invalid
  MIN_DAYS: 1,          // floor for a positive setting; 0 means "keep forever"
  SWEEP_PERIOD_MINUTES: 24 * 60,   // chrome.alarms cadence
  STARTUP_DELAY_MINUTES: 1,        // first sweep after a service-worker start
  MIN_SWEEP_INTERVAL_MS: 6 * 60 * 60 * 1000, // throttle for opportunistic calls
};

export const VIEWPORT = {
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
};

export const MOUSE = {
  MIN_STEPS: 10,
  STEPS_PER_PIXEL: 50,
  DURATION_MIN: 200,
  DURATION_MAX: 600,
  JITTER_AMOUNT: 1,
  IDLE_DISTANCE_MIN: 10,
  IDLE_DISTANCE_MAX: 50,
};
