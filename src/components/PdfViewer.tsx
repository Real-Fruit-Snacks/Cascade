import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as pdfjsLib from 'pdfjs-dist';
import { useSettingsStore } from '../stores/settings-store';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  filePath: string;
  vaultPath: string;
}

const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300, 400];

export function PdfViewer({ filePath, vaultPath }: PdfViewerProps) {
  const { t } = useTranslation('editor');
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(() => useSettingsStore.getState().pdfDefaultZoom ?? 100);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderingPages = useRef<Set<number>>(new Set());
  const renderedPages = useRef<Set<string>>(new Set());
  const pageInputRef = useRef<HTMLInputElement>(null);
  const [pageInput, setPageInput] = useState('1');
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1, 2]));
  const pageObserver = useRef<IntersectionObserver | null>(null);

  const normalized = vaultPath.replace(/\\/g, '/');
  const rel = filePath.replace(/\\/g, '/');
  const src = convertFileSrc(`${normalized}/${rel}`);

  // Track current PDF document for cleanup
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Destroy previous PDF document to prevent memory leak
    if (pdfRef.current) {
      pdfRef.current.destroy();
      pdfRef.current = null;
    }
    setPdf(null);
    renderedPages.current.clear();

    const loadTask = pdfjsLib.getDocument(src);
    loadTask.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setPdf(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('pdfViewer.failedToLoad'));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      loadTask.destroy();
      // Destroy PDF document on unmount or src change
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [src]);

  // IntersectionObserver to track which page placeholders are near the viewport
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    pageObserver.current = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(pageNum);
            else next.delete(pageNum);
          }
          // Add 1-page buffer above and below
          const expanded = new Set(next);
          for (const p of next) {
            if (p > 1) expanded.add(p - 1);
            if (p < totalPages) expanded.add(p + 1);
          }
          return expanded;
        });
      },
      { root: container, rootMargin: '200px 0px' },
    );
    return () => { pageObserver.current?.disconnect(); };
  }, [totalPages]);

  // Render a single page to its canvas
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf) return;
    const key = `${pageNum}-${zoom}`;
    if (renderedPages.current.has(key)) return;
    if (renderingPages.current.has(pageNum)) return;

    const canvas = canvasRefs.current.get(pageNum);
    if (!canvas) return;

    renderingPages.current.add(pageNum);
    try {
      const page = await pdf.getPage(pageNum);
      const scale = zoom / 100;
      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      renderedPages.current.add(key);
    } catch {
      // Page render failed — ignore
    } finally {
      renderingPages.current.delete(pageNum);
    }
  }, [pdf, zoom]);

  // Clear rendered cache on zoom change so pages re-render
  useEffect(() => {
    renderedPages.current.clear();
  }, [zoom]);

  // Render visible pages + buffer
  const renderVisiblePages = useCallback(() => {
    if (!pdf || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) continue;
      const parent = canvas.parentElement;
      if (!parent) continue;

      const rect = parent.getBoundingClientRect();
      const buffer = containerRect.height;
      const isVisible =
        rect.bottom >= containerRect.top - buffer &&
        rect.top <= containerRect.bottom + buffer;

      if (isVisible) {
        renderPage(pageNum);
      }
    }
  }, [pdf, totalPages, renderPage]);

  // Render on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !pdf) return;

    const onScroll = () => {
      renderVisiblePages();

      // Update current page indicator based on scroll position
      const containerRect = container.getBoundingClientRect();
      const midY = containerRect.top + containerRect.height / 2;
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const canvas = canvasRefs.current.get(pageNum);
        if (!canvas?.parentElement) continue;
        const rect = canvas.parentElement.getBoundingClientRect();
        if (rect.top <= midY && rect.bottom >= midY) {
          setCurrentPage(pageNum);
          setPageInput(String(pageNum));
          break;
        }
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [pdf, totalPages, renderVisiblePages]);

  // Initial render after PDF loads or zoom changes
  useEffect(() => {
    if (pdf) {
      // Small delay so canvases are mounted
      requestAnimationFrame(() => renderVisiblePages());
    }
  }, [pdf, zoom, renderVisiblePages]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => ZOOM_STEPS.find((s) => s > prev) ?? prev);
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => [...ZOOM_STEPS].reverse().find((s) => s < prev) ?? prev);
  }, []);

  const fitWidth = useCallback(() => {
    if (!pdf || !scrollContainerRef.current) return;
    pdf.getPage(1).then((page) => {
      const containerWidth = scrollContainerRef.current!.clientWidth - 48; // padding
      const viewport = page.getViewport({ scale: 1 });
      const fitScale = containerWidth / viewport.width;
      const fitPercent = Math.round(fitScale * 100);
      setZoom(Math.max(25, Math.min(400, fitPercent)));
    });
  }, [pdf]);

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
    const canvas = canvasRefs.current.get(clamped);
    if (canvas?.parentElement) {
      canvas.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [totalPages]);

  if (error) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-2" style={{ backgroundColor: 'var(--ctp-base)' }}>
        <span className="text-sm" style={{ color: 'var(--ctp-red)' }}>{t('pdfViewer.failedToLoad')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--ctp-base)' }}>
        <span className="text-sm" style={{ color: 'var(--ctp-overlay1)' }}>{t('pdfViewer.loading')}</span>
      </div>
    );
  }

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
        {/* Page navigation */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)] disabled:opacity-30"
          style={{ color: 'var(--ctp-overlay1)' }}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex items-center gap-1">
          <input
            ref={pageInputRef}
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt(pageInput, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) goToPage(val);
                else setPageInput(String(currentPage));
                pageInputRef.current?.blur();
              }
            }}
            onBlur={() => {
              const val = parseInt(pageInput, 10);
              if (!isNaN(val) && val >= 1 && val <= totalPages) goToPage(val);
              else setPageInput(String(currentPage));
            }}
            className="w-8 text-center text-xs rounded px-1 py-0.5"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            / {totalPages}
          </span>
        </div>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)] disabled:opacity-30"
          style={{ color: 'var(--ctp-overlay1)' }}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>

        <div style={{ width: 1, height: 16, backgroundColor: 'var(--ctp-surface1)', margin: '0 4px' }} />

        {/* Zoom controls */}
        <button
          onClick={zoomOut}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('pdfViewer.zoomOut')}
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-xs min-w-[3rem] text-center" style={{ color: 'var(--ctp-subtext1)' }}>
          {zoom}%
        </span>
        <button
          onClick={zoomIn}
          className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('pdfViewer.zoomIn')}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={fitWidth}
          className="flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-[11px] hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={t('pdfViewer.fitToWidth')}
        >
          <Maximize size={13} />
          <span>{t('pdfViewer.fitWidth')}</span>
        </button>
      </div>

      {/* Pages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        style={{ backgroundColor: 'var(--ctp-crust)' }}
      >
        <div className="flex flex-col items-center gap-4 py-4 px-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              data-page={pageNum}
              ref={(el) => {
                if (el) pageObserver.current?.observe(el);
                // cleanup handled by disconnect on unmount
              }}
              className="shadow-lg"
              style={{
                backgroundColor: '#fff',
                lineHeight: 0,
                minHeight: 400,
              }}
            >
              {visiblePages.has(pageNum) && (
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                    else canvasRefs.current.delete(pageNum);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
