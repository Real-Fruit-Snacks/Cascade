import i18n from '../../../i18n';
import { RotateCcw } from 'lucide-react';

export function SettingRow({ label, description, children, onReset }: { label: string; description: string; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="ctp-text" style={{ fontSize: 'var(--text-sm)' }}>{label}</span>
        <span className="ctp-overlay0" style={{ fontSize: 'var(--text-xs)' }}>{description}</span>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {children}
        {onReset && (
          <button
            onClick={onReset}
            className="p-0.5 rounded transition-colors hover:bg-[var(--ctp-surface1)] ctp-overlay0"
            title={i18n.t('settings:resetToDefault')}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
