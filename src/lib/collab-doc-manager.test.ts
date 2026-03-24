import { describe, it, expect } from 'vitest';
import { CollabDocManager } from './collab-doc-manager';

describe('CollabDocManager', () => {
  it('creates an empty doc', () => {
    const mgr = new CollabDocManager();
    const doc = mgr.getOrCreate('notes/hello.md');
    expect(doc.getText('content').toString()).toBe('');
    mgr.disposeAll();
  });

  it('returns the same doc for the same path', () => {
    const mgr = new CollabDocManager();
    const doc1 = mgr.getOrCreate('notes/hello.md');
    const doc2 = mgr.getOrCreate('notes/hello.md');
    expect(doc1).toBe(doc2);
    mgr.disposeAll();
  });

  it('get returns undefined for unknown path', () => {
    const mgr = new CollabDocManager();
    expect(mgr.get('nonexistent.md')).toBeUndefined();
  });

  it('getContent returns the text content', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md');
    mgr.initializeIfEmpty('a.md', 'hello');
    expect(mgr.getContent('a.md')).toBe('hello');
    mgr.disposeAll();
  });

  it('getContent returns undefined for unknown path', () => {
    const mgr = new CollabDocManager();
    expect(mgr.getContent('missing.md')).toBeUndefined();
  });

  it('dispose removes the doc', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md');
    mgr.dispose('a.md');
    expect(mgr.get('a.md')).toBeUndefined();
  });

  it('disposeAll clears all docs', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md');
    mgr.getOrCreate('b.md');
    mgr.disposeAll();
    expect(mgr.activePaths().size).toBe(0);
  });

  it('rekey moves doc to new path', () => {
    const mgr = new CollabDocManager();
    const doc = mgr.getOrCreate('old.md');
    mgr.rekey('old.md', 'new.md');
    expect(mgr.get('new.md')).toBe(doc);
    expect(mgr.get('old.md')).toBeUndefined();
    mgr.disposeAll();
  });

  it('ref counting: disposes when count reaches 0', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md'); // refCount = 1
    mgr.addRef('a.md');      // refCount = 2
    mgr.removeRef('a.md');   // refCount = 1 — still alive
    expect(mgr.get('a.md')).not.toBeUndefined();
    mgr.removeRef('a.md');   // refCount = 0 — disposed
    expect(mgr.get('a.md')).toBeUndefined();
  });

  it('getOrCreate increments refCount on second call', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md'); // refCount = 1
    mgr.getOrCreate('a.md'); // refCount = 2
    mgr.removeRef('a.md');   // refCount = 1 — still alive
    expect(mgr.get('a.md')).not.toBeUndefined();
    mgr.disposeAll();
  });

  it('normalizes backslash paths', () => {
    const mgr = new CollabDocManager();
    const doc = mgr.getOrCreate('folder\\sub\\file.md');
    expect(mgr.get('folder/sub/file.md')).toBe(doc);
    mgr.disposeAll();
  });

  it('activePaths returns all active paths', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md');
    mgr.getOrCreate('b.md');
    const paths = mgr.activePaths();
    expect(paths.has('a.md')).toBe(true);
    expect(paths.has('b.md')).toBe(true);
    expect(paths.size).toBe(2);
    mgr.disposeAll();
  });

  it('initializeIfEmpty seeds content when doc is empty', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md');
    mgr.initializeIfEmpty('a.md', 'Hello world');
    expect(mgr.getContent('a.md')).toBe('Hello world');
    mgr.disposeAll();
  });

  it('initializeIfEmpty does not overwrite existing content', () => {
    const mgr = new CollabDocManager();
    mgr.getOrCreate('a.md');
    mgr.initializeIfEmpty('a.md', 'First');
    mgr.initializeIfEmpty('a.md', 'Second');
    expect(mgr.getContent('a.md')).toBe('First');
    mgr.disposeAll();
  });

  it('initializeIfEmpty is a no-op for unknown path', () => {
    const mgr = new CollabDocManager();
    // Should not throw
    mgr.initializeIfEmpty('missing.md', 'content');
  });
});
