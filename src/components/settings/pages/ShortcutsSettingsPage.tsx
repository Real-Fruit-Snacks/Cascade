import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { formatShortcutDisplay, SHORTCUT_GROUPS } from '../shared/constants';
import { SubHeader } from '../shared/SubHeader';
import { KeyCaptureInput } from '../shared/KeyCaptureInput';

interface ShortcutCommand {
  id: string;
  label: string;
  defaultShortcut: string;
  customShortcut?: string;
}

interface ShortcutsSettingsPageProps {
  shortcutCommands: ShortcutCommand[];
  editingId: string | null;
  capturedKey: string;
  handleKeyCapture: (e: KeyboardEvent) => void;
  startEditing: (id: string) => void;
  saveBinding: (id: string) => void;
  resetBinding: (id: string) => void;
  cancelEditing: () => void;
  isSearching: boolean;
  filteredCommands: ShortcutCommand[] | null;
}

function ShortcutRow({ id, label, defaultShortcut, customShortcut, isEditing, capturedKey, handleKeyCapture, startEditing, saveBinding, resetBinding, cancelEditing }: {
  id: string; label: string; defaultShortcut: string; customShortcut?: string;
  isEditing: boolean; capturedKey: string; handleKeyCapture: (e: KeyboardEvent) => void;
  startEditing: (id: string) => void; saveBinding: (id: string) => void;
  resetBinding: (id: string) => void; cancelEditing: () => void;
}) {
  const { t: ts } = useTranslation('settings');
  const displayShortcut = customShortcut ?? defaultShortcut;
  const isCustomized = customShortcut !== undefined;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm ctp-text">{label}</span>
        {isCustomized && (
          <span className="text-xs ctp-overlay0">
            {ts('shortcuts.default', { shortcut: formatShortcutDisplay(defaultShortcut) })}
          </span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {isEditing ? (
          <KeyCaptureInput capturedKey={capturedKey} onKeyCapture={handleKeyCapture} onSave={() => saveBinding(id)} onCancel={cancelEditing} />
        ) : (
          <>
            <button
              onClick={() => startEditing(id)}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--ctp-surface2)]"
              style={{
                backgroundColor: 'var(--ctp-surface1)',
                color: isCustomized ? 'var(--ctp-accent)' : 'var(--ctp-text)',
                border: isCustomized ? '1px solid var(--ctp-accent)' : '1px solid transparent',
                fontFamily: 'monospace',
              }}
              title={ts('shortcuts.clickToRebind')}
            >
              {formatShortcutDisplay(displayShortcut)}
            </button>
            {isCustomized && (
              <button
                onClick={() => resetBinding(id)}
                className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)] ctp-icon"
                style={{ width: 20, height: 20 }}
                title={ts('shortcuts.resetToDefault')}
              >
                <X size={11} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ShortcutsSettingsPage({
  shortcutCommands, editingId, capturedKey, handleKeyCapture,
  startEditing, saveBinding, resetBinding, cancelEditing,
  isSearching, filteredCommands,
}: ShortcutsSettingsPageProps) {
  const { t: ts } = useTranslation('settings');
  const sharedProps = { capturedKey, handleKeyCapture, startEditing, saveBinding, resetBinding, cancelEditing };

  if (isSearching && filteredCommands) {
    return (
      <>
        {filteredCommands.map((sc) => (
          <ShortcutRow key={sc.id} {...sc} isEditing={editingId === sc.id} {...sharedProps} />
        ))}
      </>
    );
  }

  return (
    <>
      {SHORTCUT_GROUPS.map((group) => {
        const groupItems = group.ids.map((gid) => shortcutCommands.find((sc) => sc.id === gid)).filter(Boolean) as ShortcutCommand[];
        return (
          <div key={group.labelKey}>
            <SubHeader label={ts(group.labelKey)} />
            <div className="flex flex-col gap-5">
              {groupItems.map((sc) => (
                <ShortcutRow key={sc.id} {...sc} isEditing={editingId === sc.id} {...sharedProps} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
