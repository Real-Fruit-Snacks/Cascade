import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud } from 'lucide-react';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import { useSettingsStore } from '../../../stores/settings-store';
import { useVaultStore } from '../../../stores/vault-store';
import { useSyncStore } from '../../../stores/sync-store';
import { gitTestConnection, gitInitRepo, gitStatus as gitStatusCmd, gitDisconnect, storeSyncPat, readSyncPat, deleteSyncPat } from '../../../lib/tauri-commands';
import { formatAgo } from '../../../lib/format-utils';
import type { OptionsPageProps } from '../shared/types';

export function SyncOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const update = useSettingsStore.getState().update;
  const vaultPath = useVaultStore.getState().vaultPath;
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<string | null>(null);
  const [showPat, setShowPat] = useState(false);
  const [pat, setPat] = useState('');
  const [patLoaded, setPatLoaded] = useState(false);

  // Load PAT from OS credential store on mount
  useEffect(() => {
    if (vaultPath && !patLoaded) {
      readSyncPat(vaultPath).then((stored) => {
        if (stored) setPat(stored);
        setPatLoaded(true);
      }).catch(() => setPatLoaded(true));
    }
  }, [vaultPath, patLoaded]);

  const patSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handlePatChange = (value: string) => {
    setPat(value);
    if (vaultPath) {
      clearTimeout(patSaveTimer.current);
      patSaveTimer.current = setTimeout(() => {
        storeSyncPat(vaultPath, value).catch(() => {/* toast handled by keyring error */});
      }, 500);
    }
  };

  const isConnected = syncStatus !== 'disconnected';

  const handleTestConnection = async () => {
    if (!settings.syncRepoUrl || !pat) return;
    setTesting(true);
    setTestResult(null);
    try {
      await gitTestConnection(settings.syncRepoUrl, pat);
      setTestResult('success');
    } catch {
      setTestResult('error');
    }
    setTesting(false);
  };

  const handleConnect = async () => {
    if (!vaultPath || !settings.syncRepoUrl || !pat) return;
    setConnecting(true);
    setConnectResult(null);
    try {
      const status = await gitStatusCmd(vaultPath);
      if (status.is_repo && status.has_remote) {
        setConnectResult(ts('syncOptions.connectedSyncEnabled'));
      } else {
        await gitInitRepo(vaultPath, settings.syncRepoUrl, pat);
        setConnectResult(ts('syncOptions.repoInitialized'));
      }
      useSyncStore.getState().refreshStatus();
    } catch (err: unknown) {
      setConnectResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!vaultPath) return;
    try {
      await gitDisconnect(vaultPath);
      await deleteSyncPat(vaultPath);
      setPat('');
      useSyncStore.getState().reset();
      setConnectResult(null);
      setTestResult(null);
    } catch (err: unknown) {
      setConnectResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--ctp-surface1)',
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    fontSize: 13,
    outline: 'none',
  };

  const formatSyncAgo = (time: number | null) =>
    formatAgo(time, (key, opts) => ts(`syncOptions.${key}`, opts));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('syncOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('syncOptions.description')}
        </span>
      </div>

      {/* Connection Status Banner */}
      {isConnected && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{
            backgroundColor: syncStatus === 'error' ? 'color-mix(in srgb, var(--ctp-red) 10%, var(--ctp-mantle))' : syncStatus === 'offline' ? 'color-mix(in srgb, var(--ctp-peach) 10%, var(--ctp-mantle))' : 'color-mix(in srgb, var(--ctp-green) 10%, var(--ctp-mantle))',
            border: `1px solid ${syncStatus === 'error' ? 'var(--ctp-red)' : syncStatus === 'offline' ? 'var(--ctp-peach)' : 'var(--ctp-green)'}`,
          }}
        >
          <Cloud size={16} style={{ color: syncStatus === 'error' ? 'var(--ctp-red)' : syncStatus === 'offline' ? 'var(--ctp-peach)' : 'var(--ctp-green)', flexShrink: 0 }} />
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-text)' }}>
              {syncStatus === 'syncing' ? ts('syncOptions.statusSyncing') : syncStatus === 'error' ? ts('syncOptions.statusError') : syncStatus === 'offline' ? ts('syncOptions.statusOffline') : ts('syncOptions.statusConnected')}
            </span>
            <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
              {settings.syncRepoUrl ? settings.syncRepoUrl.replace(/\.git$/, '').replace(/^https:\/\/github\.com\//, '') : ts('syncOptions.noRepository')} · {ts('syncOptions.lastSynced', { time: formatSyncAgo(lastSyncTime) })}
            </span>
          </div>
          <button
            onClick={() => useSyncStore.getState().triggerSync()}
            disabled={syncStatus === 'syncing'}
            className="text-xs px-2.5 py-1 rounded"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              cursor: syncStatus === 'syncing' ? 'default' : 'pointer',
              opacity: syncStatus === 'syncing' ? 0.5 : 1,
            }}
          >
            {ts('syncOptions.syncNow')}
          </button>
        </div>
      )}

      {/* Repository Settings */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('syncOptions.repository')}</span>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{ts('syncOptions.repositoryUrl')}</label>
          <input
            type="text"
            value={settings.syncRepoUrl}
            placeholder="https://github.com/username/vault.git"
            onChange={(e) => update({ syncRepoUrl: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{ts('syncOptions.personalAccessToken')}</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPat ? 'text' : 'password'}
              value={pat}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              onChange={(e) => handlePatChange(e.target.value)}
              style={{ ...inputStyle, paddingRight: 60 }}
            />
            <button
              type="button"
              onClick={() => setShowPat((v) => !v)}
              className="text-xs"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--ctp-overlay1)',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              {showPat ? ts('syncOptions.hidePat') : ts('syncOptions.showPat')}
            </button>
          </div>
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {ts('syncOptions.patHintPrefix')}<strong>repo</strong>{ts('syncOptions.patHintSuffix')}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleTestConnection}
            disabled={testing || !settings.syncRepoUrl || !pat}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              cursor: testing || !settings.syncRepoUrl || !pat ? 'default' : 'pointer',
              opacity: testing || !settings.syncRepoUrl || !pat ? 0.5 : 1,
            }}
          >
            {testing ? ts('syncOptions.testing') : ts('syncOptions.testConnection')}
          </button>

          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting || !settings.syncRepoUrl || !pat}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{
                backgroundColor: 'var(--ctp-accent)',
                color: 'var(--ctp-base)',
                border: 'none',
                cursor: connecting || !settings.syncRepoUrl || !pat ? 'default' : 'pointer',
                opacity: connecting || !settings.syncRepoUrl || !pat ? 0.5 : 1,
              }}
            >
              {connecting ? ts('syncOptions.connecting') : ts('syncOptions.connectAndPush')}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--ctp-red)',
                border: '1px solid var(--ctp-red)',
                cursor: 'pointer',
              }}
            >
              {ts('syncOptions.disconnect')}
            </button>
          )}

          {testResult === 'success' && <span className="text-xs" style={{ color: 'var(--ctp-green)' }}>{ts('syncOptions.connectionSuccessful')}</span>}
          {testResult === 'error' && <span className="text-xs" style={{ color: 'var(--ctp-red)' }}>{ts('syncOptions.connectionFailed')}</span>}
          {connectResult && (
            <span className="text-xs" style={{ color: connectResult.startsWith('Error') ? 'var(--ctp-red)' : 'var(--ctp-green)' }}>
              {connectResult}
            </span>
          )}
        </div>
      </div>

      {/* Auto-Sync Settings */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('syncOptions.autoSync')}</span>

        <SettingRow label={ts('syncOptions.automaticSync')} description={ts('syncOptions.automaticSyncDesc')}>
          <ToggleSwitch
            checked={settings.syncAutoSync}
            onChange={(v) => update({ syncAutoSync: v })}
          />
        </SettingRow>

        {settings.syncAutoSync && (
          <SettingRow label={ts('syncOptions.syncInterval')} description={ts('syncOptions.syncIntervalDesc')}>
            <select
              value={settings.syncInterval}
              onChange={(e) => update({ syncInterval: Number(e.target.value) })}
              className="text-xs px-2 py-1 rounded outline-none"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                color: 'var(--ctp-text)',
                border: '1px solid var(--ctp-surface2)',
              }}
            >
              <option value={1}>{ts('syncOptions.everyMinute')}</option>
              <option value={5}>{ts('syncOptions.every5Minutes')}</option>
              <option value={10}>{ts('syncOptions.every10Minutes')}</option>
              <option value={30}>{ts('syncOptions.every30Minutes')}</option>
            </select>
          </SettingRow>
        )}
      </div>

      <FeatureWiki featureId="sync-options" />
    </div>
  );
}
