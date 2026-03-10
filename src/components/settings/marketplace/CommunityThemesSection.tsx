import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeMarketplace } from './ThemeMarketplace';

export function CommunityThemesSection() {
  const { t: ts } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
      <button
        className="flex items-center justify-between w-full px-0 py-2.5 text-left transition-colors"
        style={{ color: 'var(--ctp-subtext0)', background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ctp-subtext0)' }}>{ts('appearance.communityThemes')}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="pb-3">
          <ThemeMarketplace />
        </div>
      )}
    </div>
  );
}
