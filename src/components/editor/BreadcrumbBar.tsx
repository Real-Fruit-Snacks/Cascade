import React from 'react';
import { Pencil, Code, BookOpen, MoreVertical } from 'lucide-react';
import { Breadcrumb } from './Breadcrumb';
import { useTranslation } from 'react-i18next';
import type { ViewMode } from '../../types/index';

const VIEW_MODES: { mode: ViewMode; icon: typeof Pencil; labelKey: string }[] = [
  { mode: 'live', icon: Pencil, labelKey: 'viewModes.livePreview' },
  { mode: 'source', icon: Code, labelKey: 'viewModes.source' },
  { mode: 'reading', icon: BookOpen, labelKey: 'viewModes.reading' },
];

interface BreadcrumbBarProps {
  activeFilePath: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  paneMenuBtnRef: React.RefObject<HTMLButtonElement | null>;
  setPaneMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
}

export function BreadcrumbBar({
  activeFilePath,
  viewMode,
  setViewMode,
  paneMenuBtnRef,
  setPaneMenu,
}: BreadcrumbBarProps) {
  const { t } = useTranslation('editor');

  return (
    <div
      className="flex items-center shrink-0 min-w-0"
      style={{
        backgroundColor: 'var(--ctp-mantle)',
        borderBottom: '1px solid var(--ctp-surface0)',
        height: 28,
      }}
    >
      <Breadcrumb path={activeFilePath} />
      <div className="flex items-center gap-0.5 px-2 shrink-0 ml-auto">
        {VIEW_MODES.map(({ mode, icon: Icon, labelKey }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className="flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-[11px]"
            style={{
              color: viewMode === mode ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
              backgroundColor: viewMode === mode ? 'var(--ctp-surface0)' : 'transparent',
            }}
            title={t(labelKey)}
          >
            <Icon size={13} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: 'var(--ctp-surface1)', margin: '0 4px' }} />
        <button
          ref={paneMenuBtnRef}
          onClick={() => {
            const rect = paneMenuBtnRef.current?.getBoundingClientRect();
            if (rect) setPaneMenu({ x: rect.right - 180, y: rect.bottom + 4 });
          }}
          className="p-1.5 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('paneMenu.title')}
          aria-label={t('paneMenu.ariaLabel')}
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
}
