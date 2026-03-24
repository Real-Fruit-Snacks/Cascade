import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { useFsWatcher } from './hooks/use-fs-watcher';
import { useSettingsStore, getAppLevelSettings } from './stores/settings-store';
import { useVaultStore } from './stores/vault-store';
import { useEditorStore, restoreSession, saveSession } from './stores/editor-store';
import { useRecentFilesStore } from './stores/recent-files-store';
import { usePluginStore } from './stores/plugin-store';
import { applyTheme, registerCustomTheme } from './styles/catppuccin-flavors';
import type { CustomTheme } from './styles/catppuccin-flavors';
import { listCustomThemes } from './lib/tauri-commands';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { on, emit } from './lib/cascade-events';
import { createLogger } from './lib/logger';
import { initCollab } from './lib/collab-init';
import './i18n';

const log = createLogger('App');

function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/\//, ''); // Remove leading //

    if (path.startsWith('open/')) {
      // cascade://open/vault-name/path/to/note
      const parts = path.slice(5).split('/');
      const vaultName = decodeURIComponent(parts[0]);
      const notePath = parts.slice(1).map(decodeURIComponent).join('/');
      emit('cascade:deep-link-open', { vaultName, notePath });
    } else if (path.startsWith('command/')) {
      const commandId = decodeURIComponent(path.slice(8));
      emit('cascade:execute-command', { commandId });
    } else if (path.startsWith('search')) {
      const query = parsed.searchParams.get('q') ?? '';
      emit('cascade:open-search', { query });
    } else if (path.startsWith('new')) {
      const title = parsed.searchParams.get('title') ?? 'Untitled';
      const template = parsed.searchParams.get('template') ?? undefined;
      emit('cascade:deep-link-new', { title, template });
    }
  } catch (err) {
    log.error('Failed to handle deep link:', err);
  }
}

function App() {
  useFsWatcher();
  const theme = useSettingsStore((s) => s.theme);

  // Listen for deep link events (cascade:// URI scheme)
  useEffect(() => {
    const unlisten = onOpenUrl((urls: string[]) => {
      for (const url of urls) {
        handleDeepLink(url);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    initCollab().catch(console.error);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const vaultPath = useVaultStore((s) => s.vaultPath);

  // Startup behavior: reopen last vault if configured
  useEffect(() => {
    const appSettings = getAppLevelSettings();
    const startupBehavior = appSettings.startupBehavior ?? 'reopen-last';
    if (startupBehavior === 'reopen-last') {
      const recent = useVaultStore.getState().recentVaults;
      if (recent.length > 0 && !useVaultStore.getState().vaultPath) {
        useVaultStore.getState().openVault(recent[0]);
      }
    }
  }, []);

  // Handle vault lifecycle events emitted by vault-store (breaks circular store deps)
  useEffect(() => {
    const unsubOpened = on('cascade:vault-opened', ({ vaultPath: openedPath }) => {
      useRecentFilesStore.getState().loadRecentFiles(openedPath);
      if (useSettingsStore.getState().pluginsEnabled) {
        usePluginStore.getState().discoverPlugins(openedPath);
      }
    });
    const unsubClosing = on('cascade:vault-closing', () => {
      usePluginStore.getState().unloadAll();
    });
    return () => {
      unsubOpened();
      unsubClosing();
    };
  }, []);

  // Load custom themes when vault opens
  useEffect(() => {
    if (!vaultPath) return;
    listCustomThemes(vaultPath).then((rawThemes) => {
      for (const raw of rawThemes) {
        try {
          const parsed = JSON.parse(raw) as CustomTheme;
          if (parsed.id && parsed.name && parsed.colors) {
            registerCustomTheme(parsed);
          }
        } catch { /* skip invalid theme files */ }
      }
      // Re-apply current theme in case it's a custom one that just loaded
      applyTheme(useSettingsStore.getState().theme);
    }).catch(() => { /* no themes dir yet */ });
  }, [vaultPath]);

  // Restore session when a vault opens (and save session when it closes)
  useEffect(() => {
    if (!vaultPath) return;
    // Only restore if no tabs are already open (prevents double-restore)
    if (useEditorStore.getState().tabs.length === 0) {
      restoreSession(vaultPath, useEditorStore);
    }
    return () => {
      saveSession(vaultPath, useEditorStore);
    };
  }, [vaultPath]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppShell />
    </div>
  );
}

export default App;
