import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud } from 'lucide-react';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import { useSettingsStore } from '../../../stores/settings-store';
import { useVaultStore } from '../../../stores/vault-store';
import { useSyncStore } from '../../../stores/sync-store';
import { useToastStore } from '../../../stores/toast-store';
import { gitTestConnection, gitInitRepo, gitStatus as gitStatusCmd, gitDisconnect, storeSyncPat, hasSyncPat, deleteSyncPat, openSyncLogFolder } from '../../../lib/tauri-commands';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { formatAgo } from '../../../lib/format-utils';
import type { OptionsPageProps } from '../shared/types';

function isSshUrl(url: string) {
  return url.startsWith('git@') || url.startsWith('ssh://');
}

export function SyncOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const update = useSettingsStore((s) => s.update);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const isSSH = isSshUrl(settings.syncRepoUrl);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<string | null>(null);
  const [patInput, setPatInput] = useState('');
  const [patSaved, setPatSaved] = useState(false);
  const [patChecked, setPatChecked] = useState(false);
  const [patSaving, setPatSaving] = useState(false);

  // Check if a PAT exists in the credential store on mount
  useEffect(() => {
    if (vaultPath && settings.syncRepoUrl && !patChecked) {
      hasSyncPat(vaultPath, settings.syncRepoUrl).then((has) => {
        setPatSaved(has);
        setPatChecked(true);
      }).catch(() => {
        setPatChecked(true);
      });
    }
  }, [vaultPath, settings.syncRepoUrl, patChecked]);

  const handleSavePat = async () => {
    if (!vaultPath || !patInput || !settings.syncRepoUrl) return;
    setPatSaving(true);
    try {
      await storeSyncPat(vaultPath, settings.syncRepoUrl, patInput);
      setPatSaved(true);
      setPatInput('');
      useToastStore.getState().addToast(ts('syncOptions.patSavedSuccess'), 'success');
    } catch (err) {
      useToastStore.getState().addToast(`${ts('syncOptions.patSaveFailed')}: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    setPatSaving(false);
  };

  const handleDeletePat = async () => {
    if (!vaultPath || !settings.syncRepoUrl) return;
    try {
      await deleteSyncPat(vaultPath, settings.syncRepoUrl);
      setPatSaved(false);
      setPatInput('');
      useToastStore.getState().addToast(ts('syncOptions.patDeleted'), 'success');
    } catch (err) {
      useToastStore.getState().addToast(`Failed to delete PAT: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const isConnected = syncStatus !== 'disconnected';

  const handleTestConnection = async () => {
    if (!vaultPath || !settings.syncRepoUrl) return;
    if (!isSSH && !patSaved) return;
    setTesting(true);
    setTestResult(null);
    try {
      await gitTestConnection(vaultPath, settings.syncRepoUrl, settings.syncSshKeyPath || '');
      setTestResult('success');
    } catch {
      setTestResult('error');
    }
    setTesting(false);
  };

  const handleConnect = async () => {
    if (!vaultPath || !settings.syncRepoUrl) return;
    if (!isSSH && !patSaved) return;
    setConnecting(true);
    setConnectResult(null);
    try {
      const status = await gitStatusCmd(vaultPath);
      if (status.is_repo && status.has_remote) {
        setConnectResult(ts('syncOptions.connectedSyncEnabled'));
      } else {
        await gitInitRepo(vaultPath, settings.syncRepoUrl, settings.syncSshKeyPath || '');
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
      await deleteSyncPat(vaultPath, settings.syncRepoUrl);
      setPatSaved(false);
      setPatInput('');
      useSyncStore.getState().reset();
      setConnectResult(null);
      setTestResult(null);
    } catch (err: unknown) {
      setConnectResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const formatSyncAgo = (time: number | null) =>
    formatAgo(time, (key, opts) => ts(`syncOptions.${key}`, opts));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium ctp-accent">{ts('syncOptions.title')}</span>
        <span className="text-xs ctp-overlay0">
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
            <span className="text-xs font-medium ctp-text">
              {syncStatus === 'syncing' ? ts('syncOptions.statusSyncing') : syncStatus === 'error' ? ts('syncOptions.statusError') : syncStatus === 'offline' ? ts('syncOptions.statusOffline') : ts('syncOptions.statusConnected')}
            </span>
            <span className="text-xs ctp-subtext0">
              {settings.syncRepoUrl ? settings.syncRepoUrl.replace(/\.git$/, '').replace(/^https:\/\/[^/]+\//, '') : ts('syncOptions.noRepository')} · {ts('syncOptions.lastSynced', { time: formatSyncAgo(lastSyncTime) })}
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
      <div className="flex flex-col gap-3 rounded-lg p-4 ctp-panel">
        <span className="text-xs font-medium ctp-subtext1">{ts('syncOptions.repository')}</span>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs ctp-subtext0">{ts('syncOptions.repositoryUrl')}</label>
          <input
            type="text"
            value={settings.syncRepoUrl}
            placeholder="https://github.com/user/vault.git or git@github.com:user/vault.git"
            onChange={(e) => update({ syncRepoUrl: e.target.value })}
            className="ctp-input w-full text-[13px] outline-none"
            style={{ padding: '7px 10px', borderRadius: 6 }}
          />
        </div>

        {!isSSH && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs ctp-subtext0">{ts('syncOptions.personalAccessToken')}</label>
            {patSaved ? (
              <div className="flex items-center gap-2">
                <span className="text-xs ctp-green">{ts('syncOptions.patSavedSecurely')}</span>
                <button
                  type="button"
                  onClick={handleDeletePat}
                  className="text-xs px-2 py-1 rounded ctp-red bg-transparent cursor-pointer"
                  style={{ border: '1px solid var(--ctp-red)' }}
                >
                  {ts('syncOptions.deletePat')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={patInput}
                    placeholder="ghp_... or glpat-..."
                    onChange={(e) => setPatInput(e.target.value)}
                    className="ctp-input flex-1 text-[13px] outline-none"
                    style={{ padding: '7px 10px', borderRadius: 6 }}
                  />
                  <button
                    type="button"
                    onClick={handleSavePat}
                    disabled={!patInput || patSaving}
                    className="text-xs px-3 py-1.5 rounded font-medium"
                    style={{
                      backgroundColor: 'var(--ctp-accent)',
                      color: 'var(--ctp-base)',
                      cursor: !patInput || patSaving ? 'default' : 'pointer',
                      opacity: !patInput || patSaving ? 0.5 : 1,
                    }}
                  >
                    {patSaving ? ts('syncOptions.patSaving') : ts('syncOptions.savePat')}
                  </button>
                </div>
                <span className="text-xs ctp-overlay0">
                  {ts('syncOptions.patHintPrefix')}<strong>repo</strong>{ts('syncOptions.patHintSuffix')}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs ctp-subtext0">{ts('syncOptions.sshKeyLabel')}</label>
          <span className="text-xs ctp-overlay0">
            {ts('syncOptions.sshKeyHint')}
          </span>
          <SettingRow label={ts('syncOptions.sshCustomKeyPath')} description={ts('syncOptions.sshCustomKeyPathDesc')}>
            <ToggleSwitch
              checked={!!settings.syncSshKeyPath}
              onChange={(v) => update({ syncSshKeyPath: v ? '~/.ssh/id_ed25519' : '' })}
            />
          </SettingRow>
          {settings.syncSshKeyPath && (
            <input
              type="text"
              value={settings.syncSshKeyPath}
              placeholder="~/.ssh/id_ed25519"
              onChange={(e) => update({ syncSshKeyPath: e.target.value })}
              className="ctp-input w-full text-[13px] outline-none"
              style={{ padding: '7px 10px', borderRadius: 6 }}
            />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleTestConnection}
            disabled={testing || !settings.syncRepoUrl || (!isSSH && !patSaved)}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              cursor: testing || !settings.syncRepoUrl || (!isSSH && !patSaved) ? 'default' : 'pointer',
              opacity: testing || !settings.syncRepoUrl || (!isSSH && !patSaved) ? 0.5 : 1,
            }}
          >
            {testing ? ts('syncOptions.testing') : ts('syncOptions.testConnection')}
          </button>

          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting || !settings.syncRepoUrl || (!isSSH && !patSaved)}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{
                backgroundColor: 'var(--ctp-accent)',
                color: 'var(--ctp-base)',
                border: 'none',
                cursor: connecting || !settings.syncRepoUrl || (!isSSH && !patSaved) ? 'default' : 'pointer',
                opacity: connecting || !settings.syncRepoUrl || (!isSSH && !patSaved) ? 0.5 : 1,
              }}
            >
              {connecting ? ts('syncOptions.connecting') : ts('syncOptions.connectAndPush')}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded ctp-red border border-[var(--ctp-red)] bg-transparent cursor-pointer"
            >
              {ts('syncOptions.disconnect')}
            </button>
          )}

          {testResult === 'success' && <span className="text-xs ctp-green">{ts('syncOptions.connectionSuccessful')}</span>}
          {testResult === 'error' && <span className="text-xs ctp-red">{ts('syncOptions.connectionFailed')}</span>}
          {connectResult && (
            <span className="text-xs" style={{ color: connectResult.startsWith('Error') ? 'var(--ctp-red)' : 'var(--ctp-green)' }}>
              {connectResult}
            </span>
          )}
        </div>
      </div>

      {/* Auto-Sync Settings */}
      <div className="flex flex-col gap-3 rounded-lg p-4 ctp-panel">
        <span className="text-xs font-medium ctp-subtext1">{ts('syncOptions.autoSync')}</span>

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
              className="text-xs px-2 py-1 rounded outline-none ctp-input"
            >
              <option value={1}>{ts('syncOptions.everyMinute')}</option>
              <option value={5}>{ts('syncOptions.every5Minutes')}</option>
              <option value={10}>{ts('syncOptions.every10Minutes')}</option>
              <option value={30}>{ts('syncOptions.every30Minutes')}</option>
            </select>
          </SettingRow>
        )}
      </div>

      {/* Sync Logs */}
      <div className="flex items-center justify-between rounded-lg p-4 ctp-panel">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium ctp-subtext1">{ts('syncOptions.syncLogs')}</span>
          <span className="text-xs ctp-overlay0">{ts('syncOptions.syncLogsDesc')}</span>
        </div>
        <button
          onClick={async () => {
            if (!vaultPath) return;
            try {
              const logDir = await openSyncLogFolder(vaultPath);
              await revealItemInDir(logDir);
            } catch { /* ignore if folder can't be opened */ }
          }}
          className="text-xs px-3 py-1.5 rounded bg-ctp-surface0 ctp-text border-ctp-surface1 cursor-pointer"
        >
          {ts('syncOptions.viewLogs')}
        </button>
      </div>

      <FeatureWiki featureId="sync-options" />
    </div>
  );
}
