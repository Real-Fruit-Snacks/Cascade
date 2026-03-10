export function CanvasView({ filePath, vaultPath: _vaultPath }: { filePath: string; vaultPath: string }) {
  return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--ctp-overlay0)' }}>
      <p className="text-sm">Canvas view — {filePath}</p>
    </div>
  );
}
