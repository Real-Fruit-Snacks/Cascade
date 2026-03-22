type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;
  const prefix = `[Cascade:${context}]`;
  switch (level) {
    case 'debug': console.debug(prefix, message, ...args); break;
    case 'info': console.info(prefix, message, ...args); break;
    case 'warn': console.warn(prefix, message, ...args); break;
    case 'error': console.error(prefix, message, ...args); break;
  }
}

export function createLogger(context: string) {
  return {
    debug: (message: string, ...args: unknown[]) => formatMessage('debug', context, message, ...args),
    info: (message: string, ...args: unknown[]) => formatMessage('info', context, message, ...args),
    warn: (message: string, ...args: unknown[]) => formatMessage('warn', context, message, ...args),
    error: (message: string, ...args: unknown[]) => formatMessage('error', context, message, ...args),
  };
}
