import { useEffect } from 'react';
import { message } from '@tauri-apps/plugin-dialog';
import i18n from '../i18n';
import { commandRegistry } from '../lib/command-registry';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { openDailyNote, openWeeklyNote, openMonthlyNote, openQuarterlyNote, openYearlyNote } from '../lib/daily-notes';

export function useCommands(options: {
  openCommandPalette: () => void;
  openQuickOpen: () => void;
  toggleSidebar: () => void;
  openSettings: () => void;
}) {
  const { openCommandPalette, openQuickOpen, toggleSidebar, openSettings } = options;
  const customKeybindings = useSettingsStore((s) => s.customKeybindings);
  const enableSearch = useSettingsStore((s) => s.enableSearch);
  const enableTableOfContents = useSettingsStore((s) => s.enableTableOfContents);
  const enableDailyNotes = useSettingsStore((s) => s.enableDailyNotes);
  const enableVariables = useSettingsStore((s) => s.enableVariables);
  const enableFocusMode = useSettingsStore((s) => s.enableFocusMode);
  const enableBookmarks = useSettingsStore((s) => s.enableBookmarks);
  const enableTags = useSettingsStore((s) => s.enableTags);
  const enableBacklinks = useSettingsStore((s) => s.enableBacklinks);
  const enableOutline = useSettingsStore((s) => s.enableOutline);

  useEffect(() => {
    const unregFns: Array<() => void> = [];

    const focusEditor = () => {
      requestAnimationFrame(() => {
        const view = useEditorStore.getState().editorViewRef.current;
        if (view && !view.hasFocus) view.focus();
      });
    };

    const reg = (id: string, label: string, defaultShortcut: string | undefined, run: () => void) => {
      const shortcut = defaultShortcut !== undefined
        ? (customKeybindings[id] !== undefined ? customKeybindings[id] : defaultShortcut)
        : undefined;
      unregFns.push(commandRegistry.register({ id, label, shortcut, run }));
    };

    // File operations
    reg('file.new', i18n.t('commands:labels.newFile'), 'Ctrl+N', () => {
      window.dispatchEvent(new Event('cascade:new-file'));
    });

    reg('file.save', i18n.t('commands:labels.save'), 'Ctrl+S', () => {
      const vaultPath = useVaultStore.getState().vaultPath;
      if (!vaultPath) return;
      useEditorStore.getState().saveFile(vaultPath);
      focusEditor();
    });

    reg('file.quick-open', i18n.t('commands:labels.quickOpen'), 'Ctrl+O', () => {
      openQuickOpen();
    });

    // Tab operations
    reg('tab.close', i18n.t('commands:labels.closeTab'), 'Ctrl+W', () => {
      const store = useEditorStore.getState();
      const { tabs, activeTabIndex } = store;
      if (activeTabIndex === -1) return;
      const tab = tabs[activeTabIndex];
      if (!tab) return;
      if (tab.isDirty) {
        const name = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
        message(`Save changes to "${name}" before closing?`, {
          title: 'Unsaved Changes',
          kind: 'warning',
          buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
        }).then((result) => {
          if (result === 'Cancel') return;
          if (result === 'Yes') {
            const vaultPath = useVaultStore.getState().vaultPath;
            if (!vaultPath) return;
            store.saveFile(vaultPath).then(() => {
              useEditorStore.getState().closeTab(activeTabIndex, true);
            });
          } else {
            // 'No' — Don't Save
            store.closeTab(activeTabIndex, true);
          }
        });
        return;
      }
      store.closeActiveTab();
    });

    reg('tab.next', i18n.t('commands:labels.nextTab'), 'Ctrl+Tab', () => {
      useEditorStore.getState().nextTab();
      focusEditor();
    });

    reg('tab.prev', i18n.t('commands:labels.prevTab'), 'Ctrl+Shift+Tab', () => {
      useEditorStore.getState().prevTab();
      focusEditor();
    });

    // View operations
    reg('view.command-palette', i18n.t('commands:labels.commandPalette'), 'Ctrl+P', () => {
      openCommandPalette();
    });

    reg('edit.find', i18n.t('commands:labels.findInFile'), 'Ctrl+F', () => {
      const view = useEditorStore.getState().editorViewRef.current;
      if (view) {
        view.focus();
        import('@codemirror/search').then(({ openSearchPanel }) => openSearchPanel(view));
      }
    });

    reg('edit.find-replace', i18n.t('commands:labels.findReplace'), 'Ctrl+H', () => {
      const view = useEditorStore.getState().editorViewRef.current;
      if (view) {
        view.focus();
        import('@codemirror/search').then(({ openSearchPanel }) => openSearchPanel(view));
      }
    });

    if (enableSearch) {
      reg('view.search', i18n.t('commands:labels.searchInVault'), 'Ctrl+Shift+F', () => {
        window.dispatchEvent(new Event('cascade:open-search'));
      });

      reg('view.search-replace', i18n.t('commands:labels.searchReplaceInVault'), 'Ctrl+Shift+H', () => {
        window.dispatchEvent(new Event('cascade:open-search'));
        window.dispatchEvent(new CustomEvent('cascade:open-search-replace'));
      });
    }

    reg('file.export', i18n.t('commands:labels.export'), undefined, () => {
      window.dispatchEvent(new Event('cascade:export'));
    });

    reg('file.batchExport', i18n.t('commands:labels.exportVaultFolder'), 'Ctrl+Shift+B', () => {
      window.dispatchEvent(new Event('cascade:export-batch'));
    });

    reg('file.import', i18n.t('commands:labels.importSettings'), undefined, () => {
      window.dispatchEvent(new Event('cascade:import'));
    });

    reg('view.toggle-sidebar', i18n.t('commands:labels.toggleSidebar'), 'Ctrl+B', () => {
      toggleSidebar();
      focusEditor();
    });

    // Sidebar view shortcuts
    reg('sidebar.files', i18n.t('commands:labels.sidebarFiles'), 'Ctrl+Shift+E', () => {
      window.dispatchEvent(new CustomEvent('cascade:sidebar-view', { detail: 'files' }));
      focusEditor();
    });

    if (enableTags) {
      reg('sidebar.tags', i18n.t('commands:labels.sidebarTags'), 'Ctrl+Shift+T', () => {
        window.dispatchEvent(new CustomEvent('cascade:sidebar-view', { detail: 'tags' }));
        focusEditor();
      });
    }

    if (enableBacklinks) {
      reg('sidebar.backlinks', i18n.t('commands:labels.sidebarBacklinks'), 'Ctrl+Shift+L', () => {
        window.dispatchEvent(new CustomEvent('cascade:sidebar-view', { detail: 'backlinks' }));
        focusEditor();
      });
    }

    if (enableOutline) {
      reg('sidebar.outline', i18n.t('commands:labels.sidebarOutline'), 'Ctrl+Shift+O', () => {
        window.dispatchEvent(new CustomEvent('cascade:sidebar-view', { detail: 'outline' }));
        focusEditor();
      });
    }

    if (enableBookmarks) {
      reg('sidebar.bookmarks', i18n.t('commands:labels.sidebarBookmarks'), 'Ctrl+Shift+K', () => {
        window.dispatchEvent(new CustomEvent('cascade:sidebar-view', { detail: 'bookmarks' }));
        focusEditor();
      });
    }

    reg('app.settings', i18n.t('commands:labels.settings'), 'Ctrl+,', () => {
      openSettings();
    });

    reg('app.close-vault', i18n.t('commands:labels.closeVault'), undefined, () => {
      window.dispatchEvent(new Event('cascade:close-vault'));
    });

    reg('app.about', i18n.t('commands:labels.aboutCascade'), undefined, () => {
      window.dispatchEvent(new Event('cascade:about'));
    });

    // Variables commands
    if (enableVariables) {
      reg('variables.set-value', i18n.t('commands:labels.variablesSetValue'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-set'));
      });

      reg('variables.list', i18n.t('commands:labels.variablesList'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-list'));
      });

      reg('variables.replace-all', i18n.t('commands:labels.variablesReplaceAll'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-replace-all'));
      });

      reg('variables.replace-selection', i18n.t('commands:labels.variablesReplaceSelection'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-replace-selection'));
      });

      reg('variables.copy-replaced', i18n.t('commands:labels.variablesCopyReplaced'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-copy-replaced'));
      });

      reg('variables.copy-line', i18n.t('commands:labels.variablesCopyLine'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-copy-line'));
      });

      reg('variables.copy-selection', i18n.t('commands:labels.variablesCopySelection'), undefined, () => {
        window.dispatchEvent(new Event('cascade:variables-copy-selection'));
      });
    }

    // Focus Mode
    if (enableFocusMode) {
      reg('view.focus-mode', i18n.t('commands:labels.toggleFocusMode'), undefined, () => {
        useEditorStore.getState().toggleFocusMode();
        focusEditor();
      });
    }

    // Table of Contents
    if (enableTableOfContents) {
      reg('toc.insert', i18n.t('commands:labels.insertToc'), undefined, () => {
        const view = useEditorStore.getState().editorViewRef.current;
        if (!view) return;
        import('../lib/toc').then(({ generateToc }) => {
          const doc = view.state.doc.toString();
          const toc = generateToc(doc);
          if (!toc) return;
          const pos = view.state.selection.main.head;
          view.dispatch({ changes: { from: pos, insert: toc + '\n' } });
        });
      });

      reg('toc.update', i18n.t('commands:labels.updateToc'), undefined, () => {
        const view = useEditorStore.getState().editorViewRef.current;
        if (!view) return;
        import('../lib/toc').then(({ updateTocInDoc }) => {
          const doc = view.state.doc.toString();
          const result = updateTocInDoc(doc);
          if (!result) return;
          view.dispatch({ changes: { from: result.from, to: result.to, insert: result.insert } });
        });
      });
    }

    // Bookmarks
    if (enableBookmarks) {
      reg('file.toggle-bookmark', i18n.t('commands:labels.toggleBookmark'), undefined, () => {
        const filePath = useEditorStore.getState().activeFilePath;
        if (!filePath) return;
        const settings = useSettingsStore.getState();
        const bookmarks = settings.bookmarkedFiles ?? [];
        if (bookmarks.includes(filePath)) {
          settings.update({ bookmarkedFiles: bookmarks.filter((p: string) => p !== filePath) });
        } else {
          settings.update({ bookmarkedFiles: [...bookmarks, filePath] });
        }
      });
    }

    // Periodic Notes
    if (enableDailyNotes) {
      reg('daily.open-today', i18n.t('commands:labels.openTodayDailyNote'), 'Alt+D', () => {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return;
        openDailyNote(vaultPath);
      });

      reg('periodic.open-weekly', i18n.t('commands:labels.openWeeklyNote'), undefined, () => {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return;
        openWeeklyNote(vaultPath);
      });

      reg('periodic.open-monthly', i18n.t('commands:labels.openMonthlyNote'), undefined, () => {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return;
        openMonthlyNote(vaultPath);
      });

      reg('periodic.open-quarterly', i18n.t('commands:labels.openQuarterlyNote'), undefined, () => {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return;
        openQuarterlyNote(vaultPath);
      });

      reg('periodic.open-yearly', i18n.t('commands:labels.openYearlyNote'), undefined, () => {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return;
        openYearlyNote(vaultPath);
      });
    }

    return () => {
      unregFns.forEach((fn) => fn());
    };
  }, [openCommandPalette, openQuickOpen, toggleSidebar, openSettings, customKeybindings, enableSearch, enableTableOfContents, enableDailyNotes, enableVariables, enableFocusMode, enableBookmarks, enableTags, enableBacklinks, enableOutline]);
}
