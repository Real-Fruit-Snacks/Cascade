import { useMemo } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../stores/editor-store';
import { usePluginStore } from '../stores/plugin-store';
import type { MenuItem } from '../components/sidebar/ContextMenu';
import type { TabMeta } from '../components/editor/TabBar';
import type { TFunction } from 'i18next';

interface UseTabContextMenuParams {
  tabMenu: { x: number; y: number; index: number } | null;
  tabsMeta: TabMeta[];
  closeTab: (index: number) => void;
  t: TFunction<'editor'>;
}

export function useTabContextMenu({ tabMenu, tabsMeta, closeTab, t }: UseTabContextMenuParams): MenuItem[] {
  return useMemo((): MenuItem[] => {
    if (tabMenu === null) return [];
    const idx = tabMenu.index;
    const tab = tabsMeta[idx];
    if (!tab) return [];
    const items: MenuItem[] = [];
    const isPinned = tab.isPinned;

    items.push({
      label: isPinned ? t('tabContextMenu.unpinTab') : t('tabContextMenu.pinTab'),
      onClick: () => {
        if (isPinned) useEditorStore.getState().unpinTab(idx);
        else useEditorStore.getState().pinTab(idx);
      },
    });

    if (!isPinned) {
      items.push({
        label: t('tabContextMenu.closeTab'),
        onClick: () => closeTab(idx),
      });
    }

    items.push({
      label: t('tabContextMenu.closeTabsToRight'),
      onClick: async () => {
        const store = useEditorStore.getState();
        const hasDirty = store.tabs.some((t, i) => i > idx && !t.isPinned && t.isDirty);
        if (hasDirty) {
          const confirmed = await ask(t('dialogs.closeTabsRightMessage'), { title: t('dialogs.closeTabsRightTitle'), kind: 'warning' });
          if (!confirmed) return;
        }
        const s = useEditorStore.getState();
        for (let i = s.tabs.length - 1; i > idx; i--) {
          if (!s.tabs[i].isPinned) {
            s.closeTab(i, true);
          }
        }
      },
    });

    items.push({
      label: t('tabContextMenu.revealInSidebar'),
      onClick: () => {
        if (tab.path && !tab.path.startsWith('__')) {
          window.dispatchEvent(new CustomEvent('cascade:reveal-in-tree', { detail: { path: tab.path } }));
        }
      },
    });

    items.push({
      label: t('tabContextMenu.copyFilePath'),
      onClick: () => {
        if (tab.path) {
          navigator.clipboard.writeText(tab.path);
        }
      },
    });

    items.push({
      label: t('tabContextMenu.closeOtherTabs'),
      onClick: async () => {
        const store = useEditorStore.getState();
        const hasDirty = store.tabs.some((t, i) => i !== idx && !t.isPinned && t.isDirty);
        if (hasDirty) {
          const confirmed = await ask(t('dialogs.closeOtherTabsMessage'), { title: t('dialogs.closeOtherTabsTitle'), kind: 'warning' });
          if (!confirmed) return;
        }
        const s = useEditorStore.getState();
        for (let i = s.tabs.length - 1; i >= 0; i--) {
          if (i !== idx && !s.tabs[i].isPinned) {
            s.closeTab(i, true);
          }
        }
      },
    });

    items.push({
      label: t('tabContextMenu.closeAllTabs'),
      danger: true,
      onClick: async () => {
        const store = useEditorStore.getState();
        const hasDirty = store.tabs.some((t) => !t.isPinned && t.isDirty);
        if (hasDirty) {
          const confirmed = await ask(t('dialogs.closeAllTabsMessage'), { title: t('dialogs.closeAllTabsTitle'), kind: 'warning' });
          if (!confirmed) return;
        }
        const s = useEditorStore.getState();
        for (let i = s.tabs.length - 1; i >= 0; i--) {
          if (!s.tabs[i].isPinned) {
            s.closeTab(i, true);
          }
        }
      },
    });

    // Append plugin tab context menu items
    const pluginTabItems = Array.from(usePluginStore.getState().contextMenuItems.values())
      .filter((item) => item.context === 'tab')
      .map((item) => ({
        label: item.label,
        onClick: () => item.sandbox.invokeCallback(item.runCallbackId),
      }));
    if (pluginTabItems.length > 0) {
      items.push({ label: '', separator: true, onClick: () => {} });
      items.push(...pluginTabItems);
    }

    return items;
  }, [tabMenu, tabsMeta, closeTab, t]);
}
