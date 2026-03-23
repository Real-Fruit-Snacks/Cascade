import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FOLDER_PALETTE, setFolderColor } from './file-tree-types';
import { useSettingsStore } from '../../stores/settings-store';

interface FolderColorPickerProps {
  entryPath: string;
  folderColor: string | null;
  enableFolderColors: boolean;
  pos: { x: number; y: number };
  onClose: () => void;
  onColorChange?: () => void;
  setMenu: (v: null) => void;
}

export function FolderColorPicker({
  entryPath, folderColor, enableFolderColors, pos,
  onClose, onColorChange, setMenu,
}: FolderColorPickerProps) {
  const { t } = useTranslation('sidebar');

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      onClick={onClose}
    >
      <div
        className="fixed z-[101] p-2 rounded-lg"
        style={{
          left: pos.x,
          top: pos.y,
          backgroundColor: 'var(--ctp-surface0)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs mb-1.5 px-1" style={{ color: 'var(--ctp-subtext0)' }}>{t('fileTree.folderColor')}</div>
        <div className="grid grid-cols-6 gap-1">
          {FOLDER_PALETTE.map(({ name, cssVar }) => (
            <button
              key={name}
              className="w-5 h-5 rounded-full transition-transform hover:scale-125"
              style={{
                backgroundColor: cssVar,
                outline: folderColor === cssVar ? '2px solid var(--ctp-text)' : undefined,
                outlineOffset: 1,
              }}
              title={name}
              onClick={() => {
                setFolderColor(entryPath, cssVar);
                if (!enableFolderColors) {
                  useSettingsStore.getState().update({ enableFolderColors: true });
                }
                onClose();
                setMenu(null);
                onColorChange?.();
              }}
            />
          ))}
        </div>
        {folderColor && (
          <button
            className="w-full mt-1.5 text-xs py-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-subtext0)' }}
            onClick={() => {
              setFolderColor(entryPath, null);
              onClose();
              setMenu(null);
              onColorChange?.();
            }}
          >
            {t('fileTree.resetColor')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
