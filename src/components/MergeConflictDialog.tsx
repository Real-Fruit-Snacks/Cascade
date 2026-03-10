import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { useRef } from 'react';

export interface ConflictInfo {
  path: string;
  localContent: string;
  remoteContent: string;
}

interface MergeConflictDialogProps {
  open: boolean;
  conflicts: ConflictInfo[];
  onResolve: (resolutions: Map<string, 'local' | 'remote'>) => void;
  onCancel: () => void;
}

export function MergeConflictDialog({ open, conflicts, onResolve, onCancel }: MergeConflictDialogProps) {
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [resolutions, setResolutions] = useState<Map<string, 'local' | 'remote'>>(() => {
    const m = new Map<string, 'local' | 'remote'>();
    for (const c of conflicts) m.set(c.path, 'local');
    return m;
  });
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!shouldRender || conflicts.length === 0) return null;

  const selected = conflicts[selectedIdx];
  const setChoice = (path: string, choice: 'local' | 'remote') => {
    setResolutions((prev) => new Map(prev).set(path, choice));
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onKeyDown={trapKeyDown}
    >
      <div
        ref={dialogRef}
        className="rounded-xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--ctp-base)',
          width: 800,
          maxHeight: '80vh',
          border: '1px solid var(--ctp-surface1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--ctp-surface0)' }}>
          <GitMerge size={16} style={{ color: 'var(--ctp-peach)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
            Merge Conflicts ({conflicts.length} files)
          </span>
        </div>

        {/* File list + preview */}
        <div className="flex flex-1 min-h-0">
          {/* File list */}
          <div className="w-48 overflow-auto" style={{ borderRight: '1px solid var(--ctp-surface0)' }}>
            {conflicts.map((c, i) => (
              <button
                key={c.path}
                onClick={() => setSelectedIdx(i)}
                className="w-full text-left px-3 py-2 text-xs truncate"
                style={{
                  backgroundColor: i === selectedIdx ? 'var(--ctp-surface0)' : undefined,
                  color: 'var(--ctp-text)',
                }}
              >
                {c.path.split('/').pop()}
                <span className="ml-1 text-[10px]" style={{ color: 'var(--ctp-overlay0)' }}>
                  ({resolutions.get(c.path) === 'local' ? 'mine' : 'theirs'})
                </span>
              </button>
            ))}
          </div>

          {/* Side-by-side diff */}
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 overflow-auto p-3" style={{ borderRight: '1px solid var(--ctp-surface0)' }}>
              <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--ctp-blue)' }}>LOCAL (Mine)</div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--ctp-text)', fontFamily: '"JetBrains Mono", monospace' }}>
                {selected?.localContent || '(empty)'}
              </pre>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--ctp-peach)' }}>REMOTE (Theirs)</div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--ctp-text)', fontFamily: '"JetBrains Mono", monospace' }}>
                {selected?.remoteContent || '(empty)'}
              </pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--ctp-surface0)' }}>
          <button
            onClick={() => selected && setChoice(selected.path, 'local')}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{
              backgroundColor: resolutions.get(selected?.path ?? '') === 'local' ? 'var(--ctp-blue)' : 'var(--ctp-surface1)',
              color: resolutions.get(selected?.path ?? '') === 'local' ? 'var(--ctp-base)' : 'var(--ctp-text)',
            }}
          >
            Keep Mine
          </button>
          <button
            onClick={() => selected && setChoice(selected.path, 'remote')}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{
              backgroundColor: resolutions.get(selected?.path ?? '') === 'remote' ? 'var(--ctp-peach)' : 'var(--ctp-surface1)',
              color: resolutions.get(selected?.path ?? '') === 'remote' ? 'var(--ctp-base)' : 'var(--ctp-text)',
            }}
          >
            Keep Theirs
          </button>
          <div className="flex-1" />
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs"
            style={{ color: 'var(--ctp-subtext0)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onResolve(resolutions)}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ backgroundColor: 'var(--ctp-green)', color: 'var(--ctp-base)' }}
          >
            Apply Resolutions
          </button>
        </div>
      </div>
    </div>
  );
}
