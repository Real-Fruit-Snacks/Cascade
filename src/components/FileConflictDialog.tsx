import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';

interface ConflictInfo {
  path: string;
  externalContent: string;
}

export function FileConflictDialog() {
  const { t } = useTranslation('dialogs');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const { shouldRender, isClosing } = useCloseAnimation(conflict !== null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, conflict !== null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ConflictInfo;
      setConflict(detail);
    };
    window.addEventListener('cascade:file-conflict', handler);
    return () => window.removeEventListener('cascade:file-conflict', handler);
  }, []);

  useEffect(() => {
    if (!conflict) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setConflict(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [conflict]);

  if (!shouldRender || !conflict) return null;

  const fileName = conflict.path?.replace(/\\/g, '/').split('/').pop() ?? conflict.path ?? '';

  const handleKeepMine = () => {
    // Keep local edits, do nothing — user can save when ready
    setConflict(null);
  };

  const handleLoadExternal = () => {
    const store = useEditorStore.getState();
    const { tabs, activeTabIndex } = store;
    const tabIndex = tabs.findIndex((t) => t.path === conflict.path);
    if (tabIndex !== -1) {
      const updated = {
        ...tabs[tabIndex],
        content: conflict.externalContent,
        savedContent: conflict.externalContent,
        isDirty: false,
      };
      const newTabs = tabs.map((t, i) => (i === tabIndex ? updated : t));
      const dirtyPaths = new Set(store.dirtyPaths);
      dirtyPaths.delete(conflict.path);
      useEditorStore.setState({
        tabs: newTabs,
        dirtyPaths,
        ...(tabIndex === activeTabIndex
          ? { content: conflict.externalContent, isDirty: false }
          : {}),
      });
    }
    setConflict(null);
  };

  const handleSaveOverwrite = async () => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      // Update savedContent to match external, then save current content
      const store = useEditorStore.getState();
      const tabIndex = store.tabs.findIndex((t) => t.path === conflict.path);
      if (tabIndex !== -1) {
        const tab = store.tabs[tabIndex];
        const updated = { ...tab, savedContent: conflict.externalContent };
        const newTabs = store.tabs.map((t, i) => (i === tabIndex ? updated : t));
        useEditorStore.setState({ tabs: newTabs });
      }
      // Switch to the tab and save using fresh store reference after setState
      const freshStore = useEditorStore.getState();
      const newTabIndex = freshStore.tabs.findIndex((t) => t.path === conflict.path);
      if (newTabIndex !== -1) {
        freshStore.switchTab(newTabIndex);
        await freshStore.saveFile(vaultPath);
      }
    }
    setConflict(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setConflict(null); }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-5 max-w-md w-full mx-4 modal-content"
        style={{
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="File conflict"
      >
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={20} style={{ color: 'var(--ctp-yellow)', flexShrink: 0 }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
            {t('fileConflict.title')}
          </h3>
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--ctp-subtext0)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ctp-text)' }}>{fileName}</strong>{' '}
          {t('fileConflict.message')}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleKeepMine}
            className="w-full px-3 py-2 rounded text-xs text-left transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-text)', backgroundColor: 'var(--ctp-surface0)' }}
          >
            <strong>{t('fileConflict.keepMine')}</strong>
            <span className="block mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>
              {t('fileConflict.keepMineDesc')}
            </span>
          </button>

          <button
            onClick={handleLoadExternal}
            className="w-full px-3 py-2 rounded text-xs text-left transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-text)', backgroundColor: 'var(--ctp-surface0)' }}
          >
            <strong>{t('fileConflict.loadExternal')}</strong>
            <span className="block mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>
              {t('fileConflict.loadExternalDesc')}
            </span>
          </button>

          <button
            onClick={handleSaveOverwrite}
            className="w-full px-3 py-2 rounded text-xs text-left transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-peach)', backgroundColor: 'var(--ctp-surface0)' }}
          >
            <strong>{t('fileConflict.saveOverwrite')}</strong>
            <span className="block mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>
              {t('fileConflict.saveOverwriteDesc')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
