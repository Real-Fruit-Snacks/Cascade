import { CollabProvider, ProviderState } from './collab-provider';
import { CollabDocManager } from './collab-doc-manager';
import { useCollabStore, type CollabUser } from '../stores/collab-store';
import { useSettingsStore } from '../stores/settings-store';
import { useToastStore } from '../stores/toast-store';
import * as cmd from './tauri-commands';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

let provider: CollabProvider | null = null;
let docManager: CollabDocManager | null = null;
let currentPassword = '';
let unlistenStatus: UnlistenFn | null = null;

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

export async function initCollab(): Promise<void> {
  // Listen for collab status events from the Tauri backend
  unlistenStatus = await listen<{ connectedClients: number }>('collab://status', (event) => {
    const { connectedClients } = event.payload;
    useCollabStore.getState().updateConnectedClients(connectedClients);
  });

  // Listen for presence change window events (split-brain detection)
  window.addEventListener('cascade:collab-presence-changed', handlePresenceChange as EventListener);

  // Stop collab session on window/app close (fire-and-forget)
  window.addEventListener('beforeunload', () => {
    const collab = useCollabStore.getState();
    if (collab.active) {
      cmd.stopCollab().catch(() => {});
    }
  });
}

export async function startCollabSession(password: string): Promise<void> {
  const settings = useSettingsStore.getState();
  const name = settings.collabName;
  const color = settings.collabColor || '#89b4fa';

  if (!name) {
    useToastStore.getState().addToast('Please set a display name before starting collaboration.', 'warning');
    return;
  }

  currentPassword = password;

  const collab = useCollabStore.getState();
  await collab.startAsHost(password, name, color);

  const state = useCollabStore.getState();
  if (state.role === 'client' && state.hostAddress) {
    createProvider(`ws://${state.hostAddress}`, password, name, color);
  } else if (state.role === 'host' && state.serverPort) {
    createProvider(`ws://127.0.0.1:${state.serverPort}`, password, name, color);
  }
}

export async function stopCollabSession(): Promise<void> {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (docManager) {
    docManager.disposeAll();
  }
  currentPassword = '';
  await useCollabStore.getState().disconnect();
}

function createProvider(url: string, password: string, name: string, color: string): void {
  if (provider) {
    provider.destroy();
    provider = null;
  }

  const p = new CollabProvider(url, password);
  provider = p;

  p.setLocalState({ name, color });

  p.onStateChange = (state) => {
    useCollabStore.getState().updateProviderState(state);
    if (state === ProviderState.AuthFailed) {
      useToastStore.getState().addToast('Collaboration authentication failed. Check your password.', 'error');
      stopCollabSession().catch(console.error);
    } else if (state === ProviderState.Disconnected) {
      handleProviderDisconnect();
    }
  };

  p.onLifecycleEvent = (event) => {
    if (event.type === 'file-renamed') {
      const dm = getGlobalDocManager();
      dm.rekey(event.oldPath, event.newPath);
      if (provider) {
        provider.rekeyDoc(event.oldPath, event.newPath);
      }
    } else if (event.type === 'file-deleted') {
      useToastStore.getState().addToast(
        `File deleted by ${event.by}: ${event.path}`,
        'warning',
      );
    }
  };

  p.connect();

  // Subscribe to awareness changes to update users list
  p.awareness.on('change', () => {
    const states = p.awareness.getStates();
    const users = new Map<number, CollabUser>();
    states.forEach((state: Record<string, unknown>, clientId: number) => {
      if (state.user && clientId !== p.awareness.clientID) {
        const u = state.user as Record<string, unknown>;
        users.set(clientId, {
          name: typeof u.name === 'string' ? u.name : 'Unknown',
          color: typeof u.color === 'string' ? u.color : '#89b4fa',
          activeFile: typeof u.activeFile === 'string' ? u.activeFile : null,
        });
      }
    });
    useCollabStore.getState().updateUsers(users);
  });
}

function handleProviderDisconnect(): void {
  const collabState = useCollabStore.getState();
  // Only handle disconnect logic when we are a client
  if (collabState.role !== 'client') return;

  useToastStore.getState().addToast('Host disconnected. Will reconnect or promote in ~15s...', 'info');

  setTimeout(async () => {
    // If already reconnected, do nothing
    if (provider && provider.state === ProviderState.Connected) return;

    try {
      const presence = await cmd.readCollabPresence();
      if (presence) {
        const now = Date.now();
        const age = now - presence.heartbeat;
        // If heartbeat is fresh (within 10 seconds), reconnect to new host
        if (age < 10000) {
          const settings = useSettingsStore.getState();
          const name = settings.collabName;
          const color = settings.collabColor || '#89b4fa';
          const address = `${presence.host}:${presence.port}`;
          useCollabStore.getState().setClientState(address, name, color);
          createProvider(`ws://${address}`, currentPassword, name, color);
          return;
        }
      }
    } catch {
      // presence read failed — fall through to promote
    }

    // No fresh presence — promote self to host
    try {
      await useCollabStore.getState().promoteToHost(currentPassword);
      const state = useCollabStore.getState();
      if (state.serverPort) {
        const settings = useSettingsStore.getState();
        const name = settings.collabName;
        const color = settings.collabColor || '#89b4fa';
        createProvider(`ws://127.0.0.1:${state.serverPort}`, currentPassword, name, color);
        useToastStore.getState().addToast('Promoted to host.', 'success');
      }
    } catch (e) {
      useToastStore.getState().addToast(
        `Failed to promote to host: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      );
    }
  }, 16000);
}

async function handlePresenceChange(): Promise<void> {
  const collabState = useCollabStore.getState();
  // Only relevant when we are the host (split-brain detection)
  if (collabState.role !== 'host' || !collabState.serverPort) return;

  try {
    const presence = await cmd.readCollabPresence();
    if (!presence) return;

    // If the presence port doesn't match our port, another host took over
    if (presence.port !== collabState.serverPort) {
      useToastStore.getState().addToast('Another host detected. Switching to client mode.', 'info');
      // Stop our server and destroy provider first
      if (provider) {
        provider.destroy();
        provider = null;
      }
      try {
        await cmd.stopCollab();
      } catch {
        // ignore — best effort
      }
      const settings = useSettingsStore.getState();
      const name = settings.collabName;
      const color = settings.collabColor || '#89b4fa';
      const address = `${presence.host}:${presence.port}`;
      useCollabStore.getState().setClientState(address, name, color);
      createProvider(`ws://${address}`, currentPassword, name, color);
    }
  } catch {
    // ignore
  }
}

export async function cleanupCollab(): Promise<void> {
  if (unlistenStatus) {
    unlistenStatus();
    unlistenStatus = null;
  }
  window.removeEventListener('cascade:collab-presence-changed', handlePresenceChange as EventListener);
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (docManager) {
    docManager.disposeAll();
  }
  currentPassword = '';
}
