import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settings-store';

interface ImageViewerProps {
  filePath: string;
  vaultPath: string;
}

const ZOOM_STEPS = [10, 25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];

export function ImageViewer({ filePath, vaultPath }: ImageViewerProps) {
  const { t } = useTranslation('editor');
  const [zoom, setZoom] = useState<number | 'fit'>(() => {
    const pref = useSettingsStore.getState().imageDefaultZoom;
    return pref === 'actual' ? 100 : 'fit';
  });
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const normalized = vaultPath.replace(/\\/g, '/');
  const rel = filePath.replace(/\\/g, '/');
  const src = convertFileSrc(`${normalized}/${rel}`);

  const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (img) {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  const effectiveZoom = zoom === 'fit' ? null : zoom;

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const current = prev === 'fit' ? 100 : prev;
      const next = ZOOM_STEPS.find((s) => s > current);
      return next ?? current;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const current = prev === 'fit' ? 100 : prev;
      const next = [...ZOOM_STEPS].reverse().find((s) => s < current);
      return next ?? current;
    });
  }, []);

  // Reset pan when zoom changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [zoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, [zoomIn, zoomOut]);

  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom === 'fit') return;
    e.preventDefault();
    setPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: panOffsetRef.current.x, oy: panOffsetRef.current.y };
  }, [zoom]);

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      setPanOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      });
    };
    const onUp = () => setPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  const imgStyle: React.CSSProperties = zoom === 'fit'
    ? { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
    : {
        width: dimensions ? dimensions.w * (zoom / 100) : 'auto',
        height: dimensions ? dimensions.h * (zoom / 100) : 'auto',
        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        cursor: panning ? 'grabbing' : 'grab',
      };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden" style={{ backgroundColor: 'var(--ctp-base)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 shrink-0"
        style={{
          height: 36,
          backgroundColor: 'var(--ctp-mantle)',
          borderBottom: '1px solid var(--ctp-surface0)',
        }}
      >
        <button
          onClick={zoomOut}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('imageViewer.zoomOut')}
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-xs min-w-[3rem] text-center" style={{ color: 'var(--ctp-subtext1)' }}>
          {zoom === 'fit' ? t('imageViewer.fit') : `${zoom}%`}
        </span>
        <button
          onClick={zoomIn}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('imageViewer.zoomIn')}
        >
          <ZoomIn size={14} />
        </button>
        <div style={{ width: 1, height: 16, backgroundColor: 'var(--ctp-surface1)', margin: '0 4px' }} />
        <button
          onClick={() => setZoom('fit')}
          className="flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-[11px] hover:bg-[var(--ctp-surface0)]"
          style={{ color: zoom === 'fit' ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }}
          title={t('imageViewer.fitToView')}
        >
          <Maximize size={13} />
          <span>{t('imageViewer.fit')}</span>
        </button>
        <button
          onClick={() => setZoom(100)}
          className="flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-[11px] hover:bg-[var(--ctp-surface0)]"
          style={{ color: effectiveZoom === 100 ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }}
          title={t('imageViewer.actualSize')}
        >
          <Minimize2 size={13} />
          <span>{t('imageViewer.oneToOne')}</span>
        </button>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-auto"
        style={{ backgroundColor: 'var(--ctp-crust)' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imgRef}
          src={src}
          alt={fileName}
          onLoad={handleImageLoad}
          draggable={false}
          style={imgStyle}
        />
      </div>

      {/* Info bar */}
      <div
        className="flex items-center gap-4 px-3 shrink-0"
        style={{
          height: 24,
          backgroundColor: 'var(--ctp-mantle)',
          borderTop: '1px solid var(--ctp-surface0)',
        }}
      >
        <span className="text-[10px] truncate" style={{ color: 'var(--ctp-overlay0)' }}>
          {fileName}
        </span>
        {dimensions && (
          <span className="text-[10px]" style={{ color: 'var(--ctp-overlay0)' }}>
            {dimensions.w} x {dimensions.h}
          </span>
        )}
      </div>
    </div>
  );
}
