import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, getLogLevel } from './logger';

// Reset log level after each test to avoid cross-test pollution.
let originalLevel: ReturnType<typeof getLogLevel>;

beforeEach(() => {
  originalLevel = getLogLevel();
});

afterEach(() => {
  setLogLevel(originalLevel);
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('returns an object with debug, info, warn, and error methods', () => {
    const logger = createLogger('Test');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('prefixes output with [Cascade:<context>]', () => {
    setLogLevel('debug');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('MyModule');
    logger.debug('hello');
    expect(spy).toHaveBeenCalledWith('[Cascade:MyModule]', 'hello');
  });

  it('passes additional arguments through to console methods', () => {
    setLogLevel('debug');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('Context');
    const extra = { key: 'value' };
    logger.debug('msg', extra);
    expect(spy).toHaveBeenCalledWith('[Cascade:Context]', 'msg', extra);
  });

  it('uses console.info for info level', () => {
    setLogLevel('debug');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    createLogger('Ctx').info('info message');
    expect(spy).toHaveBeenCalledWith('[Cascade:Ctx]', 'info message');
  });

  it('uses console.warn for warn level', () => {
    setLogLevel('debug');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createLogger('Ctx').warn('warn message');
    expect(spy).toHaveBeenCalledWith('[Cascade:Ctx]', 'warn message');
  });

  it('uses console.error for error level', () => {
    setLogLevel('debug');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createLogger('Ctx').error('error message');
    expect(spy).toHaveBeenCalledWith('[Cascade:Ctx]', 'error message');
  });
});

describe('setLogLevel / getLogLevel', () => {
  it('getLogLevel returns the level that was set', () => {
    setLogLevel('warn');
    expect(getLogLevel()).toBe('warn');
  });

  it('can be changed multiple times', () => {
    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');
    setLogLevel('error');
    expect(getLogLevel()).toBe('error');
  });
});

describe('log level filtering', () => {
  it('suppresses debug messages when level is info', () => {
    setLogLevel('info');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    createLogger('Ctx').debug('should be hidden');
    expect(spy).not.toHaveBeenCalled();
  });

  it('suppresses debug and info messages when level is warn', () => {
    setLogLevel('warn');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('Ctx');
    logger.debug('hidden debug');
    logger.info('hidden info');
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('suppresses debug, info, and warn messages when level is error', () => {
    setLogLevel('error');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('Ctx');
    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('hidden');
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('always emits error messages regardless of level', () => {
    setLogLevel('error');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createLogger('Ctx').error('critical failure');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('emits all messages at debug level', () => {
    setLogLevel('debug');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('Ctx');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(debugSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('emits warn and error messages when level is warn', () => {
    setLogLevel('warn');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('Ctx');
    logger.warn('visible warn');
    logger.error('visible error');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
