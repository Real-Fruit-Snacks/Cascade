import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { useSyncStore } from '../stores/sync-store';
import { useSettingsStore } from '../stores/settings-store';

export function SyncStatusIndicator() {
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const unpushedCommits = useSyncStore((s) => s.unpushedCommits);
  const triggerSync = useSyncStore((s) => s.triggerSync);

  if (!syncEnabled) return null;

  const formatAgo = (ts: number | null) => {
    if (!ts) return 'never';
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  let icon: React.ReactNode;
  let label: string;
  let color = 'var(--ctp-overlay1)';
  let clickable = true;

  switch (syncStatus) {
    case 'syncing':
      icon = <Loader2 size={12} className="animate-spin" />;
      label = 'Syncing...';
      clickable = false;
      break;
    case 'error':
      icon = <AlertTriangle size={12} />;
      label = 'Sync failed';
      color = 'var(--ctp-red)';
      break;
    case 'offline':
      icon = <CloudOff size={12} />;
      label = `Pending: ${unpushedCommits} commit${unpushedCommits !== 1 ? 's' : ''}`;
      color = 'var(--ctp-peach)';
      break;
    case 'disconnected':
      icon = <CloudOff size={12} />;
      label = 'Not connected';
      color = 'var(--ctp-overlay0)';
      clickable = false;
      break;
    default: // idle
      icon = <Cloud size={12} />;
      label = `Synced ${formatAgo(lastSyncTime)}`;
      color = 'var(--ctp-green)';
      break;
  }

  return (
    <span
      role={clickable ? 'button' : 'status'}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${label} — click to sync now` : label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color,
        cursor: clickable ? 'pointer' : 'default',
      }}
      title={clickable ? 'Click to sync now' : label}
      onClick={clickable ? () => triggerSync() : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerSync(); } } : undefined}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
