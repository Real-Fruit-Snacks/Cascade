import { describe, it, expect } from 'vitest';
import {
  encodeLifecycleEvent,
  decodeLifecycleEvent,
  isLifecycleMessage,
  normalizePath,
  type LifecycleEvent,
} from './collab-messages';

describe('encodeLifecycleEvent / decodeLifecycleEvent', () => {
  it('roundtrips file-created', () => {
    const event: LifecycleEvent = { type: 'file-created', path: 'notes/hello.md', by: 'alice' };
    expect(decodeLifecycleEvent(encodeLifecycleEvent(event))).toEqual(event);
  });

  it('roundtrips file-renamed', () => {
    const event: LifecycleEvent = { type: 'file-renamed', oldPath: 'a.md', newPath: 'b.md', by: 'bob' };
    expect(decodeLifecycleEvent(encodeLifecycleEvent(event))).toEqual(event);
  });

  it('roundtrips file-deleted', () => {
    const event: LifecycleEvent = { type: 'file-deleted', path: 'old.md', by: 'carol' };
    expect(decodeLifecycleEvent(encodeLifecycleEvent(event))).toEqual(event);
  });

  it('throws on non-lifecycle string', () => {
    expect(() => decodeLifecycleEvent('not a lifecycle message')).toThrow();
  });
});

describe('isLifecycleMessage', () => {
  it('returns true for encoded lifecycle events', () => {
    const encoded = encodeLifecycleEvent({ type: 'file-deleted', path: 'x.md', by: 'u' });
    expect(isLifecycleMessage(encoded)).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isLifecycleMessage('hello world')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isLifecycleMessage('')).toBe(false);
  });
});

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('folder\\sub\\file.md')).toBe('folder/sub/file.md');
  });

  it('leaves forward slashes unchanged', () => {
    expect(normalizePath('folder/sub/file.md')).toBe('folder/sub/file.md');
  });

  it('handles empty string', () => {
    expect(normalizePath('')).toBe('');
  });
});
