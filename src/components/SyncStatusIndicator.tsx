import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '../stores/sync-store';
import { useSettingsStore } from '../stores/settings-store';
import { formatAgo } from '../lib/format-utils';

export function SyncStatusIndicator() {
  const { t } = useTranslation('common');
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const unpushedCommits = useSyncStore((s) => s.unpushedCommits);
  const triggerSync = useSyncStore((s) => s.triggerSync);

  if (!syncEnabled) return null;

  const formatSyncAgo = (ts: number | null) =>
    formatAgo(ts, (key, opts) => t(`syncStatus.${key}`, opts));

  let icon: React.ReactNode;
  let label: string;
  let color = 'var(--ctp-overlay1)';
  let clickable = true;

  switch (syncStatus) {
    case 'syncing':
      icon = <Loader2 size={12} className="animate-spin" />;
      label = t('syncStatus.syncing');
      clickable = false;
      break;
    case 'error':
      icon = <AlertTriangle size={12} />;
      label = t('syncStatus.syncFailed');
      color = 'var(--ctp-red)';
      break;
    case 'offline':
      icon = <CloudOff size={12} />;
      label = unpushedCommits !== 1
        ? t('syncStatus.pendingPlural', { count: unpushedCommits })
        : t('syncStatus.pending', { count: unpushedCommits });
      color = 'var(--ctp-peach)';
      break;
    case 'disconnected':
      icon = <CloudOff size={12} />;
      label = t('syncStatus.notConnected');
      color = 'var(--ctp-overlay0)';
      clickable = false;
      break;
    default: // idle
      icon = <Cloud size={12} />;
      label = t('syncStatus.synced', { time: formatSyncAgo(lastSyncTime) });
      color = 'var(--ctp-green)';
      break;
  }

  return (
    <span
      role={clickable ? 'button' : 'status'}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? t('syncStatus.ariaClickToSync', { label }) : label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color,
        cursor: clickable ? 'pointer' : 'default',
      }}
      title={clickable ? t('syncStatus.clickToSync') : label}
      onClick={clickable ? () => triggerSync() : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerSync(); } } : undefined}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
