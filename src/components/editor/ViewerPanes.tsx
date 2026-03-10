import { lazy, Suspense } from 'react';
import { LayoutGrid } from 'lucide-react';
import { ImageViewer } from '../ImageViewer';
import { ErrorBoundary } from '../ErrorBoundary';
import { useSettingsStore } from '../../stores/settings-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useTranslation } from 'react-i18next';

const PdfViewer = lazy(() => import('../PdfViewer').then((m) => ({ default: m.PdfViewer })));
const CanvasView = lazy(() => import('../canvas/CanvasView').then((m) => ({ default: m.CanvasView })));
const GraphPanel = lazy(() => import('../sidebar/GraphPanel').then((m) => ({ default: m.GraphPanel })));

interface ViewerPanesProps {
  activeFilePath: string | null;
  activeTabType: string;
  tabPaths: string[];
  vaultPath: string | null;
  isFileLoading: boolean;
  enableCanvas: boolean;
}

export function ViewerPanes({
  activeFilePath,
  activeTabType,
  tabPaths,
  vaultPath,
  isFileLoading,
  enableCanvas,
}: ViewerPanesProps) {
  const { t } = useTranslation('editor');

  return (
    <>
      {/* Graph tab -- kept mounted so zoom/pan state persists across tab switches */}
      {tabPaths.includes('__graph__') && (
        <div
          className="flex-1 overflow-hidden"
          style={{
            display: activeFilePath === '__graph__' ? 'flex' : 'none',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Suspense fallback={null}><GraphPanel /></Suspense>
        </div>
      )}

      {/* Image viewer */}
      {activeFilePath && activeTabType === 'image' && vaultPath && !isFileLoading && (
        <ImageViewer filePath={activeFilePath} vaultPath={vaultPath} />
      )}

      {/* PDF viewer */}
      {activeFilePath && activeTabType === 'pdf' && vaultPath && !isFileLoading && (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-[var(--ctp-surface2)] border-t-[var(--ctp-accent)] rounded-full animate-spin" /></div>}>
          <PdfViewer filePath={activeFilePath} vaultPath={vaultPath} />
        </Suspense>
      )}

      {/* Canvas view */}
      {activeFilePath && activeTabType === 'canvas' && vaultPath && !isFileLoading && (
        enableCanvas ? (
          <ErrorBoundary name="canvas" fallback={<div className="flex items-center justify-center h-full p-4" style={{ color: 'var(--ctp-red)' }}>Canvas failed to load</div>}>
            <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-[var(--ctp-surface2)] border-t-[var(--ctp-accent)] rounded-full animate-spin" /></div>}>
              <CanvasView filePath={activeFilePath} vaultPath={vaultPath} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ctp-overlay0)' }}>
            <LayoutGrid size={48} style={{ color: 'var(--ctp-surface2)' }} />
            <p className="text-sm">Canvas is disabled</p>
            <button
              className="text-xs px-3 py-1.5 rounded"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-text)' }}
              onClick={() => useSettingsStore.getState().update({ enableCanvas: true })}
            >
              Enable in Settings
            </button>
          </div>
        )
      )}

      {/* Plugin custom views */}
      {activeFilePath?.startsWith('__plugin-view:') && (() => {
        const viewType = activeFilePath.slice('__plugin-view:'.length);
        const view = usePluginStore.getState().customViews.get(viewType);
        if (!view) return null;
        return (
          <iframe
            srcDoc={view.html}
            sandbox="allow-scripts"
            className="w-full h-full"
            style={{ border: 'none', flex: 1 }}
            title={t('pluginView.iframeTitle', { viewType })}
          />
        );
      })()}
    </>
  );
}
