import { create } from 'zustand';
import { confirm } from '@tauri-apps/plugin-dialog';
import type { PluginManifest } from '../plugin-api/types';
import * as cmd from '../lib/tauri-commands';
import { useSettingsStore } from './settings-store';
import { useVaultStore } from './vault-store';
import { PluginSandbox } from '../plugin-api/sandbox';
import i18n from '../i18n';

export interface PluginEntry {
  manifest: PluginManifest;
  enabled: boolean;
  loaded: boolean;
  sandbox: PluginSandbox | null;
  pluginMeta: { id: string; name: string; version: string } | null;
  error: string | null;
}

interface PluginState {
  plugins: Map<string, PluginEntry>;
  statusBarItems: Map<string, { text: string; onClick?: () => void }>;
  sidebarPanels: Map<string, { pluginId: string; html: string }>;
  customViews: Map<string, { pluginId: string; html: string }>;
  contextMenuItems: Map<string, { pluginId: string; label: string; context: 'file' | 'editor' | 'tab'; runCallbackId: string; sandbox: PluginSandbox }>;
  ribbonIcons: Map<string, { pluginId: string; icon: string; tooltip: string; runCallbackId: string; sandbox: PluginSandbox }>;
  settingsTabs: Map<string, { pluginId: string; label: string; html: string }>;
  templateFunctions: Map<string, { pluginId: string; callbackId: string; sandbox: PluginSandbox }>;
}

interface PluginActions {
  discoverPlugins: (vaultRoot: string) => Promise<void>;
  enablePlugin: (id: string) => void;
  disablePlugin: (id: string) => Promise<void>;
  loadPlugin: (id: string, vaultRoot: string) => Promise<void>;
  unloadPlugin: (id: string) => Promise<void>;
  unloadAll: () => Promise<void>;
  addStatusBarItem: (id: string, text: string, onClick?: () => void) => void;
  removeStatusBarItem: (id: string) => void;
  addSidebarPanel: (id: string, pluginId: string, html: string) => void;
  removeSidebarPanel: (id: string) => void;
  registerView: (viewType: string, pluginId: string, html: string) => void;
  unregisterView: (viewType: string) => void;
  addContextMenuItem: (id: string, pluginId: string, label: string, context: 'file' | 'editor' | 'tab', runCallbackId: string, sandbox: PluginSandbox) => void;
  removeContextMenuItem: (id: string) => void;
  addRibbonIcon: (id: string, pluginId: string, icon: string, tooltip: string, runCallbackId: string, sandbox: PluginSandbox) => void;
  removeRibbonIcon: (id: string) => void;
  addSettingsTab: (id: string, pluginId: string, label: string, html: string) => void;
  removeSettingsTab: (id: string) => void;
  registerTemplateFunction: (name: string, pluginId: string, callbackId: string, sandbox: PluginSandbox) => void;
  unregisterTemplateFunction: (name: string) => void;
}

export const usePluginStore = create<PluginState & PluginActions>((set, get) => ({
  plugins: new Map(),
  statusBarItems: new Map(),
  sidebarPanels: new Map(),
  customViews: new Map(),
  contextMenuItems: new Map(),
  ribbonIcons: new Map(),
  settingsTabs: new Map(),
  templateFunctions: new Map(),

  discoverPlugins: async (vaultRoot: string) => {
    try {
      const rawManifests = await cmd.listPlugins(vaultRoot);
      const enabledPlugins = useSettingsStore.getState().enabledPlugins;
      const plugins = new Map<string, PluginEntry>();

      for (const raw of rawManifests) {
        try {
          const manifest: PluginManifest = JSON.parse(raw);
          if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) continue;
          if (manifest.entrypoint?.includes('..') || manifest.entrypoint?.startsWith('/') || /^[a-zA-Z]:/.test(manifest.entrypoint ?? '')) continue;
          const enabled = enabledPlugins.includes(manifest.id);
          plugins.set(manifest.id, {
            manifest,
            enabled,
            loaded: false,
            sandbox: null,
            pluginMeta: null,
            error: null,
          });
        } catch {
          // Skip malformed manifests
        }
      }

      set({ plugins: new Map(plugins) });

      // Auto-load enabled plugins
      for (const [id, entry] of plugins) {
        if (entry.enabled) {
          try {
            await get().loadPlugin(id, vaultRoot);
          } catch {
            // Plugin load failures are recorded in plugin entry error field
          }
        }
      }
    } catch {
      // If .cascade/plugins doesn't exist, that's fine
    }
  },

  enablePlugin: (id: string) => {
    const { plugins } = get();
    const entry = plugins.get(id);
    if (!entry) return;

    const updated = new Map(plugins);
    updated.set(id, { ...entry, enabled: true });
    set({ plugins: updated });

    const settings = useSettingsStore.getState();
    const enabledPlugins = [...settings.enabledPlugins.filter((p) => p !== id), id];
    settings.update({ enabledPlugins });
  },

  disablePlugin: async (id: string) => {
    const { plugins } = get();
    const entry = plugins.get(id);
    if (!entry) return;

    if (entry.loaded) {
      await get().unloadPlugin(id);
    }

    const current = get().plugins;
    const updated = new Map(current);
    const currentEntry = updated.get(id);
    if (currentEntry) {
      updated.set(id, { ...currentEntry, enabled: false });
      set({ plugins: updated });
    }

    const settings = useSettingsStore.getState();
    const enabledPlugins = settings.enabledPlugins.filter((p) => p !== id);
    settings.update({ enabledPlugins });
  },

  loadPlugin: async (id: string, vaultRoot: string) => {
    const { plugins } = get();
    const entry = plugins.get(id);
    if (!entry || entry.loaded) return;

    // Security: require explicit user confirmation before executing plugin code
    const approved = await confirm(
      `Plugin "${entry.manifest.name}" (${id}) wants to run sandboxed code in this vault.\n\nPermissions: ${(entry.manifest.permissions ?? []).join(', ') || 'none'}\n\nOnly allow plugins you trust.`,
      { title: i18n.t('dialogs:loadPlugin.title'), kind: 'warning' },
    );
    if (!approved) return;

    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      const valid = await cmd.verifyPluginIntegrity(vaultPath, id);
      if (!valid) {
        const updated = new Map(get().plugins);
        updated.set(id, { ...entry, error: 'Plugin files modified since install. Reinstall to verify integrity.' });
        set({ plugins: updated });
        return;
      }
    }

    try {
      const entryPath = `.cascade/plugins/${id}/${entry.manifest.entrypoint}`;
      const jsContent = await cmd.readFile(vaultRoot, entryPath);

      // Create sandboxed iframe and load plugin code
      const sandbox = new PluginSandbox(id, entry.manifest.permissions ?? []);
      const pluginMeta = await sandbox.load(jsContent);
      await sandbox.callLifecycle('onLoad');

      const current = get().plugins;
      const updated = new Map(current);
      updated.set(id, { ...entry, loaded: true, sandbox, pluginMeta, error: null });
      set({ plugins: updated });
    } catch (e) {
      const current = get().plugins;
      const updated = new Map(current);
      const currentEntry = updated.get(id) ?? entry;
      updated.set(id, { ...currentEntry, loaded: false, sandbox: null, pluginMeta: null, error: String(e) });
      set({ plugins: updated });
    }
  },

  unloadPlugin: async (id: string) => {
    const { plugins } = get();
    const entry = plugins.get(id);
    if (!entry || !entry.loaded) return;

    if (entry.sandbox) {
      try {
        await entry.sandbox.callLifecycle('onUnload');
      } catch {
        // Best effort unload
      }
      // Destroy sandbox: removes iframe, cleans up event listeners, commands, etc.
      entry.sandbox.destroy();
    }

    const updated = new Map(plugins);
    updated.set(id, { ...entry, loaded: false, sandbox: null, pluginMeta: null, error: null });
    set({ plugins: updated });
  },

  unloadAll: async () => {
    const { plugins } = get();
    for (const id of plugins.keys()) {
      await get().unloadPlugin(id);
    }
    set({ plugins: new Map(), statusBarItems: new Map(), sidebarPanels: new Map(), customViews: new Map(), contextMenuItems: new Map(), ribbonIcons: new Map(), settingsTabs: new Map(), templateFunctions: new Map() });
  },

  addStatusBarItem: (id: string, text: string, onClick?: () => void) => {
    set((s) => {
      const items = new Map(s.statusBarItems);
      items.set(id, { text, onClick });
      return { statusBarItems: items };
    });
  },

  removeStatusBarItem: (id: string) => {
    set((s) => {
      const items = new Map(s.statusBarItems);
      items.delete(id);
      return { statusBarItems: items };
    });
  },

  addSidebarPanel: (id, pluginId, html) => {
    set((s) => {
      const items = new Map(s.sidebarPanels);
      items.set(id, { pluginId, html });
      return { sidebarPanels: items };
    });
  },
  removeSidebarPanel: (id) => {
    set((s) => {
      const items = new Map(s.sidebarPanels);
      items.delete(id);
      return { sidebarPanels: items };
    });
  },

  registerView: (viewType, pluginId, html) => {
    set((s) => {
      const items = new Map(s.customViews);
      items.set(viewType, { pluginId, html });
      return { customViews: items };
    });
  },
  unregisterView: (viewType) => {
    set((s) => {
      const items = new Map(s.customViews);
      items.delete(viewType);
      return { customViews: items };
    });
  },

  addContextMenuItem: (id, pluginId, label, context, runCallbackId, sandbox) => {
    set((s) => {
      const items = new Map(s.contextMenuItems);
      items.set(id, { pluginId, label, context, runCallbackId, sandbox });
      return { contextMenuItems: items };
    });
  },
  removeContextMenuItem: (id) => {
    set((s) => {
      const items = new Map(s.contextMenuItems);
      items.delete(id);
      return { contextMenuItems: items };
    });
  },

  addRibbonIcon: (id, pluginId, icon, tooltip, runCallbackId, sandbox) => {
    set((s) => {
      const items = new Map(s.ribbonIcons);
      items.set(id, { pluginId, icon, tooltip, runCallbackId, sandbox });
      return { ribbonIcons: items };
    });
  },
  removeRibbonIcon: (id) => {
    set((s) => {
      const items = new Map(s.ribbonIcons);
      items.delete(id);
      return { ribbonIcons: items };
    });
  },

  addSettingsTab: (id, pluginId, label, html) => {
    set((s) => {
      const items = new Map(s.settingsTabs);
      items.set(id, { pluginId, label, html });
      return { settingsTabs: items };
    });
  },
  removeSettingsTab: (id) => {
    set((s) => {
      const items = new Map(s.settingsTabs);
      items.delete(id);
      return { settingsTabs: items };
    });
  },

  registerTemplateFunction: (name, pluginId, callbackId, sandbox) => {
    set((s) => {
      const items = new Map(s.templateFunctions);
      items.set(name, { pluginId, callbackId, sandbox });
      return { templateFunctions: items };
    });
  },
  unregisterTemplateFunction: (name) => {
    set((s) => {
      const items = new Map(s.templateFunctions);
      items.delete(name);
      return { templateFunctions: items };
    });
  },
}));
