import * as Y from 'yjs';
import { normalizePath } from './collab-messages';

interface DocEntry {
  doc: Y.Doc;
  refCount: number;
}

export class CollabDocManager {
  private entries: Map<string, DocEntry> = new Map();

  getOrCreate(filePath: string): Y.Doc {
    const key = normalizePath(filePath);
    const existing = this.entries.get(key);
    if (existing) {
      existing.refCount++;
      return existing.doc;
    }
    const doc = new Y.Doc();
    doc.gc = true;
    this.entries.set(key, { doc, refCount: 1 });
    return doc;
  }

  /** Initialize Y.Text content only if empty (prevents doubling on sync). */
  initializeIfEmpty(filePath: string, content: string): void {
    const doc = this.get(filePath);
    if (!doc) return;
    const text = doc.getText('content');
    if (text.length === 0 && content) {
      doc.transact(() => { text.insert(0, content); });
    }
  }

  get(filePath: string): Y.Doc | undefined {
    return this.entries.get(normalizePath(filePath))?.doc;
  }

  getContent(filePath: string): string | undefined {
    const entry = this.entries.get(normalizePath(filePath));
    if (!entry) return undefined;
    return entry.doc.getText('content').toString();
  }

  addRef(filePath: string): void {
    const key = normalizePath(filePath);
    const entry = this.entries.get(key);
    if (entry) {
      entry.refCount++;
    }
  }

  removeRef(filePath: string): void {
    const key = normalizePath(filePath);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      this.dispose(filePath);
    }
  }

  dispose(filePath: string): void {
    const key = normalizePath(filePath);
    const entry = this.entries.get(key);
    if (entry) {
      entry.doc.destroy();
      this.entries.delete(key);
    }
  }

  disposeAll(): void {
    for (const entry of this.entries.values()) {
      entry.doc.destroy();
    }
    this.entries.clear();
  }

  rekey(oldPath: string, newPath: string): void {
    const oldKey = normalizePath(oldPath);
    const newKey = normalizePath(newPath);
    const entry = this.entries.get(oldKey);
    if (entry) {
      this.entries.delete(oldKey);
      this.entries.set(newKey, entry);
    }
  }

  activePaths(): Set<string> {
    return new Set(this.entries.keys());
  }
}
