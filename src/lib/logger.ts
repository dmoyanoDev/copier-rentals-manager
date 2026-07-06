const isClient = typeof window !== 'undefined';

export const logger = {
  info: (message: string, ...args: any[]) => {
    // Only log if not in silent environment
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, error?: any, ...args: any[]) => {
    // Filter browser extension noise in client console
    if (isClient && error?.stack && error.stack.includes('chrome-extension://')) {
      // Ignore extension background scripting errors
      return;
    }
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[ERROR] ${message}`, error || '', ...args);
    }
  }
};
