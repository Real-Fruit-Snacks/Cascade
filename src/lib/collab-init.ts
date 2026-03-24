import { CollabProvider } from './collab-provider';
import { CollabDocManager } from './collab-doc-manager';

let provider: CollabProvider | null = null;
let docManager: CollabDocManager | null = null;

export function getGlobalProvider(): CollabProvider | null {
  return provider;
}

export function getGlobalDocManager(): CollabDocManager {
  if (!docManager) docManager = new CollabDocManager();
  return docManager;
}

export function setGlobalProvider(p: CollabProvider | null): void {
  provider = p;
}

// Full implementation added in a later task
