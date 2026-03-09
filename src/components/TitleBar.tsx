import { useEffect, useMemo, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';

export function TitleBar() {
  const { t } = useTranslation('common');
  const [maximized, setMaximized] = useState(false);
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const isDirty = useEditorStore((s) => s.isDirty);

  // Derive display title
  const displayTitle = useMemo(() => {
    if (!activeFilePath) return t('appName');
    const fileName = activeFilePath.replace(/\\/g, '/').split('/').pop() ?? activeFilePath;
    return isDirty
      ? t('titleDirtyWithFile', { fileName })
      : t('titleWithFile', { fileName });
  }, [activeFilePath, isDirty, t]);

  // Update window title for OS taskbar
  useEffect(() => {
    appWindow.setTitle(displayTitle);
  }, [displayTitle, appWindow]);

  // Sync maximized state when window is resized externally (e.g. Win+Up)
  useEffect(() => {
    const unlisten = appWindow.onResized(async () => {
      setMaximized(await appWindow.isMaximized());
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    const isMax = await appWindow.isMaximized();
    if (isMax) {
      await appWindow.unmaximize();
      setMaximized(false);
    } else {
      await appWindow.maximize();
      setMaximized(true);
    }
  };
  const handleClose = () => appWindow.close();

  const handleDrag = (e: React.MouseEvent) => {
    // Only drag on left-click and not on buttons
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    appWindow.startDragging();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between shrink-0 select-none"
      style={{
        height: 32,
        backgroundColor: 'var(--ctp-crust)',
        borderBottom: '1px solid var(--ctp-surface0)',
      }}
      onMouseDown={handleDrag}
      onDoubleClick={handleMaximize}
    >
      {/* App icon + title — left side */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-3 flex-1 h-full"
      >
        <img
          src="/app-icon.png"
          alt=""
          className="shrink-0"
          style={{ width: 16, height: 16 }}
          draggable={false}
        />
        <span
          data-tauri-drag-region
          className="text-xs font-medium tracking-wide truncate"
          style={{ color: 'var(--ctp-overlay1)' }}
        >
          {displayTitle}
        </span>
      </div>

      {/* Window controls — right side */}
      <div className="flex items-stretch h-full">
        <button
          onClick={handleMinimize}
          aria-label={t('windowControls.minimize')}
          className="flex items-center justify-center transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ width: 46, color: 'var(--ctp-overlay1)' }}
          tabIndex={-1}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          aria-label={maximized ? t('windowControls.restore') : t('windowControls.maximize')}
          className="flex items-center justify-center transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ width: 46, color: 'var(--ctp-overlay1)' }}
          tabIndex={-1}
        >
          {maximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="2.5" y="3.5" width="7" height="7" rx="0.5" />
              <path d="M4.5 3.5V2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9" />
            </svg>
          ) : (
            <Square size={12} />
          )}
        </button>
        <button
          onClick={handleClose}
          aria-label={t('windowControls.close')}
          className="flex items-center justify-center transition-colors hover:bg-[var(--ctp-red)]"
          style={{ width: 46, color: 'var(--ctp-overlay1)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ctp-base)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ctp-overlay1)'; }}
          tabIndex={-1}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
