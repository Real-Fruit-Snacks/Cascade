import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SaveThemeDialogProps {
  onSave: (name: string) => void;
  onCancel: () => void;
}

export function SaveThemeDialog({ onSave, onCancel }: SaveThemeDialogProps) {
  const { t: ts } = useTranslation('settings');
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <div
      className="absolute bottom-full right-0 mb-2 flex items-center gap-2 rounded-lg p-2.5"
      style={{
        backgroundColor: 'var(--ctp-mantle)',
        border: '1px solid var(--ctp-surface1)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={ts('themeStudio.themeName', 'Theme name...')}
        className="text-xs px-2 py-1 rounded ctp-input"
        style={{ width: 160 }}
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="text-xs px-2.5 py-1 rounded font-medium"
        style={{
          backgroundColor: 'var(--ctp-accent)',
          color: 'var(--ctp-base)',
          opacity: name.trim() ? 1 : 0.5,
          cursor: name.trim() ? 'pointer' : 'default',
        }}
      >
        {ts('themeStudio.save', 'Save')}
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-2 py-1 rounded ctp-subtext0"
      >
        {ts('themeStudio.cancelSave', 'Cancel')}
      </button>
    </div>
  );
}
