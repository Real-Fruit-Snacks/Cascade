import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { FileEntry, FsChangeEvent } from '../types/index';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { getAllFilePaths } from '../lib/wiki-link-resolver';

export function useFsWatcher() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pluginDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const treeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTreeRef = useRef<FileEntry[] | null>(null);
  const modifiedPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    let unlistenFsChange: (() => void) | undefined;
    let unlistenTreeUpdated: (() => void) | undefined;

    // Listen for the incrementally-patched tree from Rust — no extra disk walk needed
    listen<FileEntry[]>('vault://tree-updated', (event) => {
      latestTreeRef.current = event.payload;
      if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current);
      treeDebounceRef.current = setTimeout(() => {
        const tree = latestTreeRef.current;
        if (tree) {
          useVaultStore.setState({ fileTree: tree, flatFiles: getAllFilePaths(tree) });
          latestTreeRef.current = null;
        }
      }, 150);
    }).then((fn) => {
      unlistenTreeUpdated = fn;
    });

    listen<FsChangeEvent>('vault://fs-change', (event) => {
      const { kind, path: absPath } = event.payload;
      const pathNorm = absPath.replace(/\\/g, '/');

      // Detect changes in .cascade/plugins/ for hot-reload
      if (pathNorm.includes('.cascade/plugins/') && useSettingsStore.getState().pluginsEnabled) {
        if (pluginDebounceRef.current) clearTimeout(pluginDebounceRef.current);
        pluginDebounceRef.current = setTimeout(() => {
          const vaultPath = useVaultStore.getState().vaultPath;
          if (vaultPath) {
            import('../stores/plugin-store').then(({ usePluginStore }) => {
              usePluginStore.getState().discoverPlugins(vaultPath);
            });
          }
        }, 1000);
      }

      // Check if an open file was modified externally
      if (kind === 'modify') {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) {
          const vaultNorm = vaultPath.replace(/\\/g, '/').replace(/\/$/, '');
          if (pathNorm.startsWith(vaultNorm + '/')) {
            const relPath = pathNorm.slice(vaultNorm.length + 1);
            modifiedPaths.current.add(relPath);
          }
        }
      }

      // Debounce conflict checks for external modifications
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Process external modifications for open tabs
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath && modifiedPaths.current.size > 0) {
          const paths = [...modifiedPaths.current];
          modifiedPaths.current.clear();
          for (const relPath of paths) {
            useEditorStore.getState().handleExternalChange(vaultPath, relPath);
          }
        }
      }, 250);
    }).then((fn) => {
      unlistenFsChange = fn;
    });

    return () => {
      unlistenFsChange?.();
      unlistenTreeUpdated?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pluginDebounceRef.current) clearTimeout(pluginDebounceRef.current);
      if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current);
    };
  }, []);
}
