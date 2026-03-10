import { ChevronRight } from 'lucide-react';

export function Breadcrumb({ path }: { path: string }) {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);

  const revealInTree = (segmentIndex: number) => {
    // Expand all folders up to the clicked segment
    for (let i = 0; i < segments.length - 1 && i <= segmentIndex; i++) {
      const folderPath = segments.slice(0, i + 1).join('/');
      localStorage.setItem('cascade-expanded:' + folderPath, 'true');
    }
    // Switch sidebar to files view and trigger re-render
    window.dispatchEvent(new CustomEvent('cascade:reveal-in-tree', {
      detail: { path: segments.slice(0, segmentIndex + 1).join('/') },
    }));
  };

  return (
    <div
      className="flex items-center px-3 min-w-0 flex-1"
      style={{ fontSize: '0.6875rem' }}
    >
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center min-w-0">
            {i > 0 && (
              <ChevronRight size={10} className="shrink-0" style={{ color: 'var(--ctp-overlay0)', margin: '0 2px' }} />
            )}
            <span
              className="truncate cursor-pointer hover:underline"
              style={{ color: isLast ? 'var(--ctp-text)' : 'var(--ctp-subtext0)' }}
              onClick={() => revealInTree(i)}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  );
}
