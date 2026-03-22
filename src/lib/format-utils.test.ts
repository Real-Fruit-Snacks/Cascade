import { describe, it, expect } from 'vitest';
import { formatAgo } from './format-utils';

function t(key: string, opts?: Record<string, unknown>): string {
  if (opts !== undefined) {
    return `${key}:${JSON.stringify(opts)}`;
  }
  return key;
}

describe('formatAgo', () => {
  it('returns "never" for null time', () => {
    expect(formatAgo(null, t)).toBe('never');
  });

  it('returns "never" for 0 time', () => {
    expect(formatAgo(0, t)).toBe('never');
  });

  it('returns "justNow" for 10 seconds ago', () => {
    expect(formatAgo(Date.now() - 10000, t)).toBe('justNow');
  });

  it('returns "minutesAgo" with count 2 for 2 minutes ago', () => {
    expect(formatAgo(Date.now() - 120000, t)).toBe('minutesAgo:{"count":2}');
  });

  it('returns "hoursAgo" with count 1 for 1 hour ago', () => {
    expect(formatAgo(Date.now() - 3600000, t)).toBe('hoursAgo:{"count":1}');
  });

  it('returns "hoursAgo" with count 2 for 2 hours ago', () => {
    expect(formatAgo(Date.now() - 7200000, t)).toBe('hoursAgo:{"count":2}');
  });
});
