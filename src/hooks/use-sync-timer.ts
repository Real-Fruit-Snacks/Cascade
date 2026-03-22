import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { useSyncStore } from '../stores/sync-store';

export function useSyncTimer() {
  const syncEnabled = useSettingsStore((s) => s.syncEnabled);
  const syncAutoSync = useSettingsStore((s) => s.syncAutoSync);
  const syncInterval = useSettingsStore((s) => s.syncInterval);
  const triggerSync = useSyncStore((s) => s.triggerSync);
  const refreshStatus = useSyncStore((s) => s.refreshStatus);
  const initialSyncDone = useRef(false);

  useEffect(() => {
    if (!syncEnabled) {
      useSyncStore.getState().reset();
      return;
    }

    refreshStatus().then(() => {
      if (!initialSyncDone.current) {
        initialSyncDone.current = true;
        triggerSync();
      }
    });

    if (!syncAutoSync) return;

    const ms = Math.max((syncInterval || 5) * 60_000, 60_000);
    const id = setInterval(() => {
      triggerSync();
    }, ms);

    return () => clearInterval(id);
  }, [syncEnabled, syncAutoSync, syncInterval, triggerSync, refreshStatus]);
}
