const LIFECYCLE_PREFIX = 'LIFECYCLE:';

export type LifecycleEvent =
  | { type: 'file-created'; path: string; by: string }
  | { type: 'file-renamed'; oldPath: string; newPath: string; by: string }
  | { type: 'file-deleted'; path: string; by: string };

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function encodeLifecycleEvent(event: LifecycleEvent): string {
  return LIFECYCLE_PREFIX + JSON.stringify(event);
}

export function decodeLifecycleEvent(data: string): LifecycleEvent | null {
  if (!isLifecycleMessage(data)) {
    throw new Error('Not a lifecycle message');
  }
  const parsed = JSON.parse(data.slice(LIFECYCLE_PREFIX.length));
  if (!parsed || typeof parsed.type !== 'string' || typeof parsed.by !== 'string') {
    throw new Error('Invalid lifecycle event shape');
  }
  // Validate paths don't contain traversal
  const validatePath = (p: unknown): boolean => {
    if (typeof p !== 'string') return true; // non-string paths are OK (absent)
    return !p.includes('..') && !p.startsWith('/') && !p.startsWith('\\');
  };
  if (!validatePath(parsed.path) || !validatePath(parsed.oldPath) || !validatePath(parsed.newPath)) {
    return null;
  }
  return parsed as LifecycleEvent;
}

export function isLifecycleMessage(data: string): boolean {
  return data.startsWith(LIFECYCLE_PREFIX);
}
