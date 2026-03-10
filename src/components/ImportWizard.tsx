import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle, AlertCircle, X, FolderOpen, FileUp, Loader2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { useToastStore } from '../stores/toast-store';
import {
  readObsidianConfig,
  importNotionExport,
  importRoamExport,
  importBearExport,
  type ObsidianConfig,
  type ImportResult,
} from '../lib/tauri-commands';

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
}

type ImportSource = 'obsidian' | 'notion' | 'roam' | 'bear';
type Step = 'select' | 'preview' | 'done';

interface SourceInfo {
  id: ImportSource;
  label: string;
  description: string;
  fileLabel: string;
  filters: { name: string; extensions: string[] }[];
  directory?: boolean;
}

const SOURCE_CONFIGS: Pick<SourceInfo, 'id' | 'filters' | 'directory'>[] = [
  {
    id: 'obsidian',
    filters: [],
  },
  {
    id: 'notion',
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
  },
  {
    id: 'roam',
    filters: [{ name: 'JSON File', extensions: ['json'] }],
  },
  {
    id: 'bear',
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    directory: true,
  },
];

const SOURCE_LABELS: Record<ImportSource, string> = {
  obsidian: 'Obsidian',
  notion: 'Notion',
  roam: 'Roam Research',
  bear: 'Bear',
};

export function ImportWizard({ open: isOpen, onClose }: ImportWizardProps) {
  const { t } = useTranslation('import');
  const { t: tc } = useTranslation('common');
  const { shouldRender, isClosing } = useCloseAnimation(isOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, isOpen);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const SOURCES: SourceInfo[] = SOURCE_CONFIGS.map((cfg) => ({
    ...cfg,
    label: SOURCE_LABELS[cfg.id],
    description: t(`sources.${cfg.id}.description`),
    fileLabel: t(`sources.${cfg.id}.fileLabel`),
  }));

  const [step, setStep] = useState<Step>('select');
  const [source, setSource] = useState<ImportSource | null>(null);
  const [config, setConfig] = useState<ObsidianConfig | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; file: string } | null>(null);

  // Listen for import progress events from backend
  useEffect(() => {
    if (!importing) { setProgress(null); return; }
    const unlisten = listen<{ current: number; total: number; file: string }>('import://progress', (e) => {
      setProgress(e.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [importing]);

  const selectedSource = SOURCES.find((s) => s.id === source);

  const handlePickFile = useCallback(async () => {
    if (!source || source === 'obsidian') return;
    const src = SOURCES.find((s) => s.id === source);
    if (!src) return;

    // For Bear, allow directory selection too
    if (src.directory) {
      const result = await open({
        directory: true,
        multiple: false,
        title: t('filePicker.bearFolderTitle'),
      });
      if (result) {
        setExportPath(result as string);
        return;
      }
      // If user cancelled directory picker, try file picker
    }

    const result = await open({
      multiple: false,
      title: src.fileLabel,
      filters: src.filters,
    });
    if (result) {
      setExportPath(result as string);
    }
  }, [source]);

  const handleNext = useCallback(async () => {
    if (!vaultPath || !source) return;
    setImporting(true);

    try {
      if (source === 'obsidian') {
        const result = await readObsidianConfig(vaultPath);
        setConfig(result);
        setStep('preview');
      } else if (exportPath) {
        // Run the import directly
        let result: ImportResult;
        if (source === 'notion') {
          result = await importNotionExport(vaultPath, exportPath);
        } else if (source === 'roam') {
          result = await importRoamExport(vaultPath, exportPath);
        } else {
          result = await importBearExport(vaultPath, exportPath);
        }
        setImportResult(result);
        setApplied([
          t('done.filesImported', { count: result.filesImported }),
          ...(result.filesSkipped > 0 ? [t('done.filesSkipped', { count: result.filesSkipped })] : []),
          ...(result.errors.length > 0 ? [t('done.errors', { count: result.errors.length })] : []),
        ]);
        setStep('done');

        // Refresh the vault tree
        window.dispatchEvent(new Event('cascade:vault-changed'));

        useToastStore.getState().addToast(
          t('toast.importedFiles', { count: result.filesImported, source: selectedSource?.label ?? source }),
          result.errors.length > 0 ? 'warning' : 'success'
        );
      }
    } catch (e) {
      useToastStore.getState().addToast(
        t('toast.importFailed', { message: e instanceof Error ? e.message : String(e) }),
        'error'
      );
    } finally {
      setImporting(false);
    }
  }, [vaultPath, source, exportPath, selectedSource]);

  const handleApplyObsidian = useCallback(() => {
    if (!config || !config.detected) return;
    const settings = useSettingsStore.getState();
    const changes: string[] = [];

    if (config.themeMode) {
      const isDark = config.themeMode === 'obsidian' || config.themeMode === 'dark';
      const theme = isDark ? 'mocha' : 'latte';
      settings.update({ theme: theme as 'mocha' | 'latte' | 'macchiato' | 'frappe' });
      changes.push(t(isDark ? 'changes.themeDark' : 'changes.themeLight'));
    }
    if (config.baseFontSize) {
      settings.update({ fontSize: config.baseFontSize });
      changes.push(t('changes.fontSize', { size: config.baseFontSize }));
    }
    if (config.vimMode !== null) {
      settings.update({ vimMode: config.vimMode });
      changes.push(t(config.vimMode ? 'changes.vimModeEnabled' : 'changes.vimModeDisabled'));
    }
    if (config.showLineNumber !== null) {
      settings.update({ showLineNumbers: config.showLineNumber });
      changes.push(t(config.showLineNumber ? 'changes.lineNumbersShown' : 'changes.lineNumbersHidden'));
    }
    if (config.spellcheck !== null) {
      settings.update({ spellcheck: config.spellcheck });
      changes.push(t(config.spellcheck ? 'changes.spellCheckEnabled' : 'changes.spellCheckDisabled'));
    }
    if (config.templateFolder) {
      settings.update({ templatesFolder: config.templateFolder });
      changes.push(t('changes.templateFolder', { folder: config.templateFolder }));
    }
    if (config.attachmentFolderPath) {
      settings.update({
        attachmentLocation: 'vault-folder' as const,
        attachmentsFolder: config.attachmentFolderPath,
      });
      changes.push(t('changes.attachmentFolder', { folder: config.attachmentFolderPath }));
    }
    if (config.hotkeys.dailyNotesFolder) {
      settings.update({ dailyNotesFolder: config.hotkeys.dailyNotesFolder });
      changes.push(t('changes.dailyNotesFolder', { folder: config.hotkeys.dailyNotesFolder }));
    }
    if (config.hotkeys.dailyNotesFormat) {
      settings.update({ dailyNotesFormat: config.hotkeys.dailyNotesFormat });
      changes.push(t('changes.dailyNotesFormat', { format: config.hotkeys.dailyNotesFormat }));
    }

    setApplied(changes);
    setStep('done');
    useToastStore.getState().addToast(
      t('toast.importedSettings', { count: changes.length }),
      'success'
    );
  }, [config]);

  const handleClose = useCallback(() => {
    setStep('select');
    setSource(null);
    setConfig(null);
    setImportResult(null);
    setApplied([]);
    setExportPath(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  if (!shouldRender) return null;

  const canProceed = source === 'obsidian' ? !!source : !!exportPath;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t('wizard.ariaLabel')}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 480,
          maxHeight: '80vh',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
        >
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: 'var(--ctp-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
              {tc('import')}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1 transition-colors hover:bg-[var(--ctp-surface0)]"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          {(['select', 'preview', 'done'] as Step[]).map((s, i) => {
            const stepLabels = source === 'obsidian'
              ? [t('wizard.steps.source'), t('wizard.steps.preview'), t('wizard.steps.done')]
              : [t('wizard.steps.source'), t('wizard.steps.importStep'), t('wizard.steps.done')];
            const stepIndex = (['select', 'preview', 'done'] as Step[]).indexOf(step);
            const isActive = i === stepIndex;
            const isComplete = i < stepIndex;
            return (
              <div key={s} className="flex items-center gap-2" style={{ flex: i < 2 ? 1 : undefined }}>
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: isActive ? 'var(--ctp-accent)' : isComplete ? 'var(--ctp-green)' : 'var(--ctp-surface1)',
                      color: isActive || isComplete ? 'var(--ctp-base)' : 'var(--ctp-overlay0)',
                    }}
                  >
                    {isComplete ? '✓' : i + 1}
                  </div>
                  <span
                    className="text-[10px]"
                    style={{ color: isActive ? 'var(--ctp-text)' : 'var(--ctp-overlay0)' }}
                  >
                    {stepLabels[i]}
                  </span>
                </div>
                {i < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: isComplete ? 'var(--ctp-green)' : 'var(--ctp-surface1)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {step === 'select' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs mb-2" style={{ color: 'var(--ctp-subtext0)' }}>
                {t('select.prompt')}
              </p>
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSource(s.id); setExportPath(null); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{
                    backgroundColor: source === s.id ? 'var(--ctp-surface1)' : 'var(--ctp-surface0)',
                    border: source === s.id ? '1px solid var(--ctp-accent)' : '1px solid transparent',
                  }}
                >
                  <FolderOpen size={16} style={{ color: source === s.id ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)', flexShrink: 0 }} />
                  <div>
                    <span className="text-xs font-medium block" style={{ color: 'var(--ctp-text)' }}>{s.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--ctp-overlay0)' }}>{s.description}</span>
                  </div>
                </button>
              ))}

              {/* File picker for non-Obsidian sources */}
              {source && source !== 'obsidian' && (
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    onClick={handlePickFile}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--ctp-surface1)]"
                    style={{
                      backgroundColor: 'var(--ctp-surface0)',
                      border: exportPath ? '1px solid var(--ctp-green)' : '1px solid var(--ctp-surface2)',
                    }}
                  >
                    <FileUp size={14} style={{ color: exportPath ? 'var(--ctp-green)' : 'var(--ctp-overlay1)', flexShrink: 0 }} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] block" style={{ color: 'var(--ctp-subtext0)' }}>
                        {selectedSource?.fileLabel}
                      </span>
                      {exportPath && (
                        <span
                          className="text-[10px] block truncate"
                          style={{ color: 'var(--ctp-green)' }}
                          title={exportPath}
                        >
                          {exportPath.split(/[/\\]/).pop()}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && source === 'obsidian' && config && (
            <div className="flex flex-col gap-2">
              {!config.detected ? (
                <div className="flex items-center gap-2 py-4">
                  <AlertCircle size={16} style={{ color: 'var(--ctp-yellow)' }} />
                  <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                    {t('preview.noObsidianFolder')}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--ctp-subtext0)' }}>
                    {t('preview.settingsDetected')}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {config.themeMode && <SettingRow label={t('preview.settings.theme')} value={config.themeMode === 'obsidian' ? t('preview.settings.themeDark') : t('preview.settings.themeLight')} />}
                    {config.baseFontSize && <SettingRow label={t('preview.settings.fontSize')} value={t('preview.settings.fontSizePx', { size: config.baseFontSize })} />}
                    {config.vimMode !== null && <SettingRow label={t('preview.settings.vimMode')} value={config.vimMode ? tc('yes') : tc('no')} />}
                    {config.showLineNumber !== null && <SettingRow label={t('preview.settings.lineNumbers')} value={config.showLineNumber ? tc('yes') : tc('no')} />}
                    {config.spellcheck !== null && <SettingRow label={t('preview.settings.spellCheck')} value={config.spellcheck ? tc('yes') : tc('no')} />}
                    {config.templateFolder && <SettingRow label={t('preview.settings.templateFolder')} value={config.templateFolder} />}
                    {config.attachmentFolderPath && <SettingRow label={t('preview.settings.attachments')} value={config.attachmentFolderPath} />}
                    {config.hotkeys.dailyNotesFolder && <SettingRow label={t('preview.settings.dailyNotesFolder')} value={config.hotkeys.dailyNotesFolder} />}
                    {config.hotkeys.dailyNotesFormat && <SettingRow label={t('preview.settings.dailyNotesFormat')} value={config.hotkeys.dailyNotesFormat} />}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} style={{ color: 'var(--ctp-green)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
                  {t('done.title')}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {applied.map((line, i) => (
                  <span key={i} className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                    {line}
                  </span>
                ))}
              </div>
              {/* Show errors if any */}
              {importResult && importResult.errors.length > 0 && (
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-[10px] font-medium" style={{ color: 'var(--ctp-yellow)' }}>
                    {t('done.warnings')}
                  </span>
                  <div
                    className="max-h-32 overflow-y-auto rounded px-2 py-1.5"
                    style={{ backgroundColor: 'var(--ctp-surface0)' }}
                  >
                    {importResult.errors.slice(0, 20).map((err, i) => (
                      <span key={i} className="text-[10px] block" style={{ color: 'var(--ctp-overlay1)' }}>
                        {err}
                      </span>
                    ))}
                    {importResult.errors.length > 20 && (
                      <span className="text-[10px] block mt-1" style={{ color: 'var(--ctp-overlay0)' }}>
                        {t('done.andMore', { count: importResult.errors.length - 20 })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-2.5"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          {step === 'select' && (
            <>
              <button
                onClick={handleClose}
                className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)]"
                style={{ color: 'var(--ctp-subtext0)' }}
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed || importing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs transition-colors"
                style={{
                  backgroundColor: canProceed ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
                  color: 'var(--ctp-base)',
                  opacity: canProceed && !importing ? 1 : 0.5,
                }}
              >
                {importing && <Loader2 size={12} className="animate-spin" />}
                {importing
                  ? (source === 'obsidian' ? t('buttons.detecting') : (progress ? `${progress.current}/${progress.total}` : t('buttons.importing')))
                  : (source === 'obsidian' ? t('buttons.next') : tc('import'))}
              </button>
            </>
          )}
          {step === 'preview' && config?.detected && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)]"
                style={{ color: 'var(--ctp-subtext0)' }}
              >
                {tc('back')}
              </button>
              <button
                onClick={handleApplyObsidian}
                className="px-4 py-1.5 rounded-md text-xs transition-colors"
                style={{ backgroundColor: 'var(--ctp-green)', color: 'var(--ctp-base)' }}
              >
                {t('buttons.applySettings')}
              </button>
            </>
          )}
          {(step === 'done' || (step === 'preview' && !config?.detected)) && (
            <button
              onClick={handleClose}
              className="px-4 py-1.5 rounded-md text-xs transition-colors"
              style={{ backgroundColor: 'var(--ctp-accent)', color: 'var(--ctp-base)' }}
            >
              {tc('close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 rounded"
      style={{ backgroundColor: 'var(--ctp-surface0)' }}
    >
      <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: 'var(--ctp-text)' }}>{value}</span>
    </div>
  );
}
