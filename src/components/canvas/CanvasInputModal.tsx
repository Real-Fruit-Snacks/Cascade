import { useState, useEffect, useRef } from 'react';

interface CanvasInputModalProps {
  title: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function CanvasInputModal({ title, defaultValue, onSubmit, onCancel }: CanvasInputModalProps) {
  const [value, setValue] = useState(defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onCancel}>
      <div className="rounded-lg p-4 w-80" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface1)' }} onClick={(e) => e.stopPropagation()}>
        <label className="text-sm" style={{ color: 'var(--ctp-text)' }}>{title}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(value); if (e.key === 'Escape') onCancel(); }}
          className="w-full mt-2 p-2 rounded text-sm outline-none"
          style={{ backgroundColor: 'var(--ctp-base)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
        />
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onCancel} className="px-3 py-1 text-sm" style={{ color: 'var(--ctp-subtext0)' }}>Cancel</button>
          <button onClick={() => onSubmit(value)} className="px-3 py-1 text-sm rounded" style={{ backgroundColor: 'var(--ctp-blue)', color: 'var(--ctp-base)' }}>OK</button>
        </div>
      </div>
    </div>
  );
}
