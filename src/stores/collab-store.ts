import { create } from 'zustand';
import * as cmd from '../lib/tauri-commands';
import { normalizePath } from '../lib/collab-messages';
import { useToastStore } from './toast-store';

export interface CollabUser {
  name: string;
  color: string;
  activeFile: string | null;
}

interface CollabState {
  active: boolean;
  role: 'host' | 'client' | null;
  connectedClients: number;
  serverPort: number | null;
  hostAddress: string | null;
  userName: string;
  userColor: string;
  users: Map<number, CollabUser>;
  activeDocPaths: Set<string>;
  providerState: 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'auth_failed';

  startAsHost: (password: string, name: string, color: string) => Promise<void>;
  setClientState: (address: string, name: string, color: string) => void;
  promoteToHost: (password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  addActiveDoc: (path: string) => void;
  removeActiveDoc: (path: string) => void;
  updateUsers: (users: Map<number, CollabUser>) => void;
  updateConnectedClients: (count: number) => void;
  updateProviderState: (state: string) => void;
}

export const useCollabStore = create<CollabState>((set) => ({
  active: false,
  role: null,
  connectedClients: 0,
  serverPort: null,
  hostAddress: null,
  userName: '',
  userColor: '#4f8ef7',
  users: new Map(),
  activeDocPaths: new Set(),
  providerState: 'disconnected',

  startAsHost: async (password, name, color) => {
    try {
      const status = await cmd.startCollab(password);
      set({
        active: status.active,
        role: status.role,
        connectedClients: status.connectedClients,
        serverPort: status.serverPort,
        hostAddress: status.hostAddress,
        userName: name,
        userColor: color,
      });
    } catch (e) {
      set({ active: false, role: null });
      useToastStore.getState().addToast('Failed to start collaboration: ' + String(e), 'error');
    }
  },

  setClientState: (address, name, color) => {
    set({
      active: true,
      role: 'client',
      hostAddress: address,
      userName: name,
      userColor: color,
    });
  },

  promoteToHost: async (password) => {
    try {
      const status = await cmd.startCollab(password);
      set({
        active: status.active,
        role: 'host',
        connectedClients: status.connectedClients,
        serverPort: status.serverPort,
        hostAddress: status.hostAddress,
      });
    } catch {
      set({ active: false, role: null });
    }
  },

  disconnect: async () => {
    try {
      await cmd.stopCollab();
    } catch {
      // ignore stop errors
    }
    set({
      active: false,
      role: null,
      connectedClients: 0,
      serverPort: null,
      hostAddress: null,
      userName: '',
      userColor: '#4f8ef7',
      users: new Map(),
      activeDocPaths: new Set(),
      providerState: 'disconnected',
    });
  },

  addActiveDoc: (path) => {
    const normalized = normalizePath(path);
    set((state) => {
      const next = new Set(state.activeDocPaths);
      next.add(normalized);
      return { activeDocPaths: next };
    });
  },

  removeActiveDoc: (path) => {
    const normalized = normalizePath(path);
    set((state) => {
      const next = new Set(state.activeDocPaths);
      next.delete(normalized);
      return { activeDocPaths: next };
    });
  },

  updateUsers: (users) => {
    set({ users });
  },

  updateConnectedClients: (count) => {
    set({ connectedClients: count });
  },

  updateProviderState: (state) => {
    const known = ['disconnected', 'connecting', 'authenticating', 'connected', 'auth_failed'] as const;
    if (!(known as readonly string[]).includes(state)) return;
    set({ providerState: state as CollabState['providerState'] });
  },
}));
