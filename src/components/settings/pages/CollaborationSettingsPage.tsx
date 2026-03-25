import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import type { CategoryPageProps } from '../shared/searchable-items';
import { useCollabStore } from '../../../stores/collab-store';
import { startCollabSession, stopCollabSession } from '../../../lib/collab-init';
import { Button, Input } from '../../ui';

const COLLAB_COLORS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1',
  '#89dceb', '#74c7ec', '#89b4fa', '#cba6f7',
  '#f5c2e7', '#eba0ac', '#94e2d5', '#b4befe',
];

export function CollaborationSettingsPage({ settings, visibleIds, isSearching }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');
  const [password, setPassword] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const collabActive = useCollabStore((s) => s.active);
  const collabRole = useCollabStore((s) => s.role);
  const connectedClients = useCollabStore((s) => s.connectedClients);

  const handleEnable = async (next: boolean) => {
    settings.update({ enableCollaboration: next });
    if (!next && collabActive) {
      await stopCollabSession();
    }
  };

  const handleStartHosting = async () => {
    if (!settings.collabName || password.length < 8) return;
    setIsStarting(true);
    try {
      await startCollabSession(password);
    } finally {
      setIsStarting(false);
    }
  };

  const handleDisconnect = async () => {
    await stopCollabSession();
    setPassword('');
  };

  const canStart = !!settings.collabName && password.length >= 8 && !isStarting;

  return (
    <>
      {(!visibleIds || visibleIds.has('collabEnabled')) && (
        <SettingRow
          label={ts('collaboration.enable.label')}
          description={ts('collaboration.enable.description')}
        >
          <ToggleSwitch
            checked={settings.enableCollaboration}
            onChange={handleEnable}
          />
        </SettingRow>
      )}

      {settings.enableCollaboration && (
        <>
          {!isSearching && <SubHeader label={ts('collaboration.label')} />}

          {(!visibleIds || visibleIds.has('collabName')) && (
            <SettingRow
              label={ts('collaboration.name.label')}
              description={ts('collaboration.name.description')}
            >
              <Input
                type="text"
                value={settings.collabName}
                onChange={(e) => settings.update({ collabName: e.target.value })}
                placeholder={ts('collaboration.name.placeholder')}
                style={{ width: 160 }}
              />
            </SettingRow>
          )}

          {(!visibleIds || visibleIds.has('collabColor')) && (
            <SettingRow
              label={ts('collaboration.color.label')}
              description={ts('collaboration.color.description')}
            >
              <div className="flex items-center gap-1 flex-wrap" style={{ maxWidth: 200 }}>
                {COLLAB_COLORS.map((color) => (
                  <button
                    key={color}
                    title={color}
                    onClick={() => settings.update({ collabColor: color })}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: settings.collabColor === color
                        ? '2px solid var(--ctp-text)'
                        : '2px solid transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </SettingRow>
          )}

          {!collabActive && (
            <SettingRow
              label={ts('collaboration.password.label')}
              description={ts('collaboration.password.description')}
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={ts('collaboration.password.placeholder')}
                style={{ width: 160 }}
              />
            </SettingRow>
          )}

          {collabActive ? (
            <SettingRow
              label={collabRole === 'host' ? ts('collaboration.status.host') : ts('collaboration.status.client')}
              description={ts('collaboration.connectedCount', { count: connectedClients })}
            >
              <Button variant="danger" onClick={handleDisconnect}>
                {ts('collaboration.disconnect')}
              </Button>
            </SettingRow>
          ) : (
            <SettingRow label="" description="">
              <Button
                variant="primary"
                onClick={handleStartHosting}
                disabled={!canStart}
              >
                {isStarting ? '...' : ts('collaboration.startHosting')}
              </Button>
            </SettingRow>
          )}
        </>
      )}
    </>
  );
}
