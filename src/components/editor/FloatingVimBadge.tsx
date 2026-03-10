import { useVimMode } from '../StatusBar';

export function FloatingVimBadge() {
  const vimMode = useVimMode();
  if (!vimMode) return null;
  return (
    <div
      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md font-semibold z-10 pointer-events-none"
      style={{
        fontSize: '0.6875rem',
        backgroundColor: vimMode === 'INSERT' ? 'var(--ctp-green)'
          : vimMode === 'VISUAL' || vimMode === 'V-LINE' || vimMode === 'V-BLOCK' ? 'var(--ctp-mauve)'
          : vimMode === 'REPLACE' ? 'var(--ctp-red)'
          : 'var(--ctp-blue)',
        color: 'var(--ctp-base)',
        opacity: 0.9,
      }}
    >
      {vimMode}
    </div>
  );
}
