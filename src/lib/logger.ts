const isClient = typeof window !== 'undefined';

type LogArgs = unknown[];

export const logger = {
  info: (message: string, ...args: LogArgs) => {
    // Only log if not in silent environment
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: LogArgs) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, error?: unknown, ...args: LogArgs) => {
    // Filter browser extension noise in client console
    if (isClient && error instanceof Error && error.stack?.includes('chrome-extension://')) {
      // Ignore extension background scripting errors
      return;
    }
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[ERROR] ${message}`, error || '', ...args);
    }
  }
};
