import { useTranslation } from 'react-i18next';
import { type GraphSettings } from './GraphTypes';

interface GraphSettingsPanelProps {
  settings: GraphSettings;
  updateSetting: <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => void;
}

export function GraphSettingsPanel({ settings, updateSetting }: GraphSettingsPanelProps) {
  const { t } = useTranslation('graph');

  return (
    <div
      className="shrink-0 px-3 py-2 flex flex-col gap-2"
      style={{
        borderBottom: '1px solid var(--ctp-surface1)',
        backgroundColor: 'var(--ctp-crust)',
        fontSize: '0.6875rem',
        color: 'var(--ctp-subtext0)',
      }}
    >
      <div className="flex items-center justify-between">
        <span>{t('settings.repulsion')}</span>
        <div className="flex items-center gap-2">
          <input
            type="range" min={30} max={300} step={10}
            value={settings.repulsion}
            onChange={(e) => updateSetting('repulsion', Number(e.target.value))}
            className="w-20 accent-[var(--ctp-accent)]"
          />
          <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.repulsion}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('settings.linkDistance')}</span>
        <div className="flex items-center gap-2">
          <input
            type="range" min={20} max={300} step={10}
            value={settings.linkDistance}
            onChange={(e) => updateSetting('linkDistance', Number(e.target.value))}
            className="w-20 accent-[var(--ctp-accent)]"
          />
          <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.linkDistance}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('settings.maxNodes')}</span>
        <div className="flex items-center gap-2">
          <input
            type="range" min={50} max={2000} step={50}
            value={settings.nodeLimit}
            onChange={(e) => updateSetting('nodeLimit', Number(e.target.value))}
            className="w-20 accent-[var(--ctp-accent)]"
          />
          <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.nodeLimit}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('settings.showOrphans')}</span>
        <button
          onClick={() => updateSetting('showOrphans', !settings.showOrphans)}
          className="w-8 h-4 rounded-full transition-colors relative"
          style={{ backgroundColor: settings.showOrphans ? 'var(--ctp-accent)' : 'var(--ctp-surface2)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
            style={{
              backgroundColor: 'var(--ctp-crust)',
              transform: settings.showOrphans ? 'translateX(16px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('settings.alwaysShowLabels')}</span>
        <button
          onClick={() => updateSetting('labelsAlways', !settings.labelsAlways)}
          className="w-8 h-4 rounded-full transition-colors relative"
          style={{ backgroundColor: settings.labelsAlways ? 'var(--ctp-accent)' : 'var(--ctp-surface2)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
            style={{
              backgroundColor: 'var(--ctp-crust)',
              transform: settings.labelsAlways ? 'translateX(16px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('settings.localGraph')}</span>
        <button
          onClick={() => updateSetting('localMode', !settings.localMode)}
          className="w-8 h-4 rounded-full transition-colors relative"
          style={{ backgroundColor: settings.localMode ? 'var(--ctp-accent)' : 'var(--ctp-surface2)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
            style={{
              backgroundColor: 'var(--ctp-crust)',
              transform: settings.localMode ? 'translateX(16px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>
      {settings.localMode && (
        <div className="flex items-center justify-between">
          <span>{t('settings.depth')}</span>
          <div className="flex items-center gap-2">
            <input
              type="range" min={1} max={5} step={1}
              value={settings.localDepth}
              onChange={(e) => updateSetting('localDepth', Number(e.target.value))}
              className="w-20 accent-[var(--ctp-accent)]"
            />
            <span className="w-6 text-right" style={{ color: 'var(--ctp-overlay1)' }}>{settings.localDepth}</span>
          </div>
        </div>
      )}
      <div className="pt-1" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ctp-overlay0)' }}>{t('filters.sectionHeader')}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span>{t('filters.includeFolders')}</span>
        <input
          type="text"
          value={settings.filterIncludeFolders}
          onChange={(e) => updateSetting('filterIncludeFolders', e.target.value)}
          placeholder={t('filters.placeholders.includeFolders')}
          className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span>{t('filters.excludeFolders')}</span>
        <input
          type="text"
          value={settings.filterExcludeFolders}
          onChange={(e) => updateSetting('filterExcludeFolders', e.target.value)}
          placeholder={t('filters.placeholders.excludeFolders')}
          className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span>{t('filters.includeTags')}</span>
        <input
          type="text"
          value={settings.filterIncludeTags}
          onChange={(e) => updateSetting('filterIncludeTags', e.target.value)}
          placeholder={t('filters.placeholders.includeTags')}
          className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span>{t('filters.excludeTags')}</span>
        <input
          type="text"
          value={settings.filterExcludeTags}
          onChange={(e) => updateSetting('filterExcludeTags', e.target.value)}
          placeholder={t('filters.placeholders.excludeTags')}
          className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none placeholder:text-[var(--ctp-overlay0)]"
        />
      </div>
      <div className="pt-1" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
        <div className="flex items-center justify-between">
          <span>{t('colorBy.label')}</span>
          <select
            value={settings.colorBy}
            onChange={(e) => updateSetting('colorBy', e.target.value as 'none' | 'folder' | 'tag')}
            className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--ctp-surface0)] text-[var(--ctp-text)] outline-none"
          >
            <option value="none">{t('colorBy.options.none')}</option>
            <option value="folder">{t('colorBy.options.folder')}</option>
            <option value="tag">{t('colorBy.options.tag')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
