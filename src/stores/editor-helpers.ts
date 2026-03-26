import { EditorView } from '@codemirror/view';
import type { Tab, EditorDerived } from './editor-types';
import { clearDraft } from './editor-drafts';
import * as cmd from '../lib/tauri-commands';
import { useSettingsStore } from './settings-store';
import { useVaultStore } from './vault-store';
import { useToastStore } from './toast-store';
import { createLogger } from '../lib/logger';
import { useCollabStore } from './collab-store';
import { getGlobalDocManager } from '../lib/collab-init';

const log = createLogger('EditorHelpers');

/** Apply auto-TOC update to a tab's content before saving. Returns the (possibly updated) tab. */
export async function applyTocUpdate(tab: Tab, editorView: EditorView | null): Promise<Tab> {
  const settings = useSettingsStore.getState();
  if (!settings.enableTableOfContents || !settings.tocAutoUpdate || !tab.path.endsWith('.md')) {
    return tab;
  }
  try {
    const { updateTocInDoc } = await import('../lib/toc');
    const result = updateTocInDoc(tab.content);
    if (result) {
      const newContent = tab.content.slice(0, result.from) + result.insert + tab.content.slice(result.to);
      if (editorView) {
        editorView.dispatch({ changes: { from: result.from, to: result.to, insert: result.insert } });
      }
      return { ...tab, content: newContent };
    }
  } catch { /* ignore TOC errors during save */ }
  return tab;
}

/**
 * Shared save logic used by both saveFile and savePaneFile.
 * Returns the updated tab on success, or null on failure.
 */
export async function performSave(
  tab: Tab,
  editorView: EditorView | null,
  vaultRoot: string,
): Promise<Tab | null> {
  // Collab-aware save: clients skip disk write; host writes Y.Doc content
  const collabState = useCollabStore.getState();
  if (collabState.active) {
    const docManager = getGlobalDocManager();
    const ydocContent = docManager.getContent(tab.path);
    if (ydocContent !== undefined) {
      if (collabState.role === 'client') {
        // Client: skip disk write, just clear draft and mark clean
        clearDraft(tab.path);
        useVaultStore.getState().updateFileTags(tab.path, tab.content);
        useVaultStore.getState().updateFileLinks(tab.path, tab.content);
        return { ...tab, savedContent: tab.content, isDirty: false };
      } else {
        // Host: write the Y.Doc content to disk instead of the editor buffer
        const hostTab = { ...tab, content: ydocContent };
        const updated = await applyTocUpdate(hostTab, editorView);
        try {
          await cmd.writeFile(vaultRoot, updated.path, updated.content);
        } catch (e) {
          log.error('Failed to save file:', updated.path, e);
          const fileName = updated.path.replace(/\\/g, '/').split('/').pop() ?? updated.path;
          useToastStore.getState().addToast(`Failed to save "${fileName}"`, 'error');
          return null;
        }
        clearDraft(updated.path);
        useVaultStore.getState().updateFileTags(updated.path, updated.content);
        useVaultStore.getState().updateFileLinks(updated.path, updated.content);
        return { ...updated, savedContent: updated.content, isDirty: false };
      }
    }
  }

  const updated = await applyTocUpdate(tab, editorView);

  try {
    await cmd.writeFile(vaultRoot, updated.path, updated.content);
  } catch (e) {
    log.error('Failed to save file:', updated.path, e);
    const fileName = updated.path.replace(/\\/g, '/').split('/').pop() ?? updated.path;
    useToastStore.getState().addToast(`Failed to save "${fileName}"`, 'error');
    return null;
  }

  clearDraft(updated.path);
  useVaultStore.getState().updateFileTags(updated.path, updated.content);
  useVaultStore.getState().updateFileLinks(updated.path, updated.content);

  return { ...updated, savedContent: updated.content, isDirty: false };
}

/** Compute derived values from tabs + activeTabIndex */
export function derived(tabs: Tab[], activeTabIndex: number): EditorDerived {
  const tab = tabs[activeTabIndex];
  return {
    activeFilePath: tab?.path ?? null,
    content: tab?.content ?? '',
    isDirty: tab?.isDirty ?? false,
  };
}

/** Find the position of a heading in the editor by matching heading text (case-insensitive). */
export function findHeadingPosition(view: EditorView, heading: string): number | null {
  const doc = view.state.doc;
  const target = heading.toLowerCase().replace(/-/g, ' ').trim();
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const m = line.text.match(/^#{1,6}\s+(.+)/);
    if (m) {
      const text = m[1].trim().toLowerCase();
      if (text === target) return line.from;
    }
  }
  return null;
}

/** Find the position of a block ID (^blockid) in the editor. */
export function findBlockIdPosition(view: EditorView, blockId: string): number | null {
  const doc = view.state.doc;
  const marker = `^${blockId}`;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text.trimEnd().endsWith(marker)) return line.from;
  }
  return null;
}
