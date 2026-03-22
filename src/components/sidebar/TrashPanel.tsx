import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { useVaultStore } from '../../stores/vault-store';
import { listTrash, restoreFromTrash, deleteFromTrash, emptyTrash, type TrashEntry } from '../../lib/tauri-commands';
import { useToastStore } from '../../stores/toast-store';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(epoch: number): string {
  const d = new Date(epoch * 1000);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

export function TrashPanel() {
  const { t } = useTranslation('sidebar');
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!vaultPath) return;
    try {
      const items = await listTrash(vaultPath);
      setEntries(items);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [vaultPath]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRestore = async (name: string) => {
    if (!vaultPath) return;
    try {
      await restoreFromTrash(vaultPath, name);
      useToastStore.getState().addToast(t('trash.restored', { name }), 'success');
      useVaultStore.getState().refreshTree();
      refresh();
    } catch (err) {
      useToastStore.getState().addToast(`Failed to restore: ${err}`, 'error');
    }
  };

  const handleDelete = async (name: string) => {
    if (!vaultPath) return;
    try {
      await deleteFromTrash(vaultPath, name);
      refresh();
    } catch (err) {
      useToastStore.getState().addToast(`Failed to delete: ${err}`, 'error');
    }
  };

  const handleEmptyTrash = async () => {
    if (!vaultPath || entries.length === 0) return;
    try {
      await emptyTrash(vaultPath);
      useToastStore.getState().addToast(t('trash.emptied'), 'success');
      refresh();
    } catch (err) {
      useToastStore.getState().addToast(`Failed to empty trash: ${err}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ctp-subtext0)' }}>
          {t('panels.trash')}
        </span>
        {entries.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
            style={{ color: 'var(--ctp-red)' }}
            title={t('trash.emptyTrash')}
          >
            {t('trash.emptyTrash')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>Loading...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6">
            <Trash2 size={24} style={{ color: 'var(--ctp-overlay0)' }} />
            <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('trash.empty')}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => (
              <div
                key={entry.name}
                className="group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--ctp-surface0)]"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className="text-xs truncate"
                    style={{ color: 'var(--ctp-text)' }}
                    title={entry.name}
                  >
                    {entry.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ctp-overlay0)', fontSize: 10 }}>
                    {formatSize(entry.size)} · {formatDate(entry.trashed_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestore(entry.name)}
                    className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
                    style={{ color: 'var(--ctp-green)' }}
                    title={t('trash.restore')}
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.name)}
                    className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
                    style={{ color: 'var(--ctp-red)' }}
                    title={t('trash.deletePermanently')}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
