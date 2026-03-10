import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import { useSettingsStore } from '../../../stores/settings-store';

export function CanvasOptionsPage() {
  const { t: ts } = useTranslation('settings');
  const canvasSnapToGrid = useSettingsStore((s) => s.canvasSnapToGrid);
  const canvasGridSize = useSettingsStore((s) => s.canvasGridSize);
  const canvasDefaultCardWidth = useSettingsStore((s) => s.canvasDefaultCardWidth);
  const canvasDefaultCardHeight = useSettingsStore((s) => s.canvasDefaultCardHeight);
  const canvasShowMinimap = useSettingsStore((s) => s.canvasShowMinimap);
  const canvasAutoLayout = useSettingsStore((s) => s.canvasAutoLayout);
  const canvasEdgeStyle = useSettingsStore((s) => s.canvasEdgeStyle);
  const canvasShowEdgeLabels = useSettingsStore((s) => s.canvasShowEdgeLabels);
  const canvasExportBackground = useSettingsStore((s) => s.canvasExportBackground);
  const update = useSettingsStore((s) => s.update);

  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };
  const selectStyle = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c7086' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 6px center',
    paddingRight: '22px',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('canvasOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('canvasOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('canvasOptions.snapToGrid.label')} description={ts('canvasOptions.snapToGrid.description')}>
        <ToggleSwitch
          checked={canvasSnapToGrid}
          onChange={(v) => update({ canvasSnapToGrid: v })}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.gridSize.label')} description={ts('canvasOptions.gridSize.description')}>
        <input
          type="number"
          min={10}
          max={100}
          step={5}
          value={canvasGridSize}
          onChange={(e) => update({ canvasGridSize: Math.max(10, Math.min(100, Number(e.target.value) || 20)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.defaultCardWidth.label')} description={ts('canvasOptions.defaultCardWidth.description')}>
        <input
          type="number"
          min={100}
          max={800}
          step={10}
          value={canvasDefaultCardWidth}
          onChange={(e) => update({ canvasDefaultCardWidth: Math.max(100, Math.min(800, Number(e.target.value) || 260)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.defaultCardHeight.label')} description={ts('canvasOptions.defaultCardHeight.description')}>
        <input
          type="number"
          min={60}
          max={600}
          step={10}
          value={canvasDefaultCardHeight}
          onChange={(e) => update({ canvasDefaultCardHeight: Math.max(60, Math.min(600, Number(e.target.value) || 140)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.showMinimap.label')} description={ts('canvasOptions.showMinimap.description')}>
        <ToggleSwitch
          checked={canvasShowMinimap}
          onChange={(v) => update({ canvasShowMinimap: v })}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.autoLayout.label')} description={ts('canvasOptions.autoLayout.description')}>
        <select
          value={canvasAutoLayout}
          onChange={(e) => update({ canvasAutoLayout: e.target.value as 'none' | 'grid' | 'tree' | 'force' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={selectStyle}
        >
          <option value="none">{ts('canvasOptions.autoLayout.none')}</option>
          <option value="grid">{ts('canvasOptions.autoLayout.grid')}</option>
          <option value="tree">{ts('canvasOptions.autoLayout.tree')}</option>
          <option value="force">{ts('canvasOptions.autoLayout.force')}</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('canvasOptions.edgeStyle.label')} description={ts('canvasOptions.edgeStyle.description')}>
        <select
          value={canvasEdgeStyle}
          onChange={(e) => update({ canvasEdgeStyle: e.target.value as 'bezier' | 'straight' | 'step' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={selectStyle}
        >
          <option value="bezier">{ts('canvasOptions.edgeStyle.bezier')}</option>
          <option value="straight">{ts('canvasOptions.edgeStyle.straight')}</option>
          <option value="step">{ts('canvasOptions.edgeStyle.step')}</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('canvasOptions.showEdgeLabels.label')} description={ts('canvasOptions.showEdgeLabels.description')}>
        <ToggleSwitch
          checked={canvasShowEdgeLabels}
          onChange={(v) => update({ canvasShowEdgeLabels: v })}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.exportBackground.label')} description={ts('canvasOptions.exportBackground.description')}>
        <ToggleSwitch
          checked={canvasExportBackground}
          onChange={(v) => update({ canvasExportBackground: v })}
        />
      </SettingRow>

      <FeatureWiki featureId="canvas-options" />
    </div>
  );
}
