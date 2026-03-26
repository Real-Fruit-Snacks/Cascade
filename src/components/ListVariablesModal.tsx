import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, List, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VariableMatch } from '../lib/tidemark';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';

interface ListVariablesModalProps {
  open: boolean;
  variables: VariableMatch[];
  onClose: () => void;
  /** Called when a variable value is saved. Returns updated variables list. */
  onSave: (name: string, value: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  exists: 'var(--ctp-green)',
  'has-default': 'var(--ctp-peach)',
  missing: 'var(--ctp-red)',
};

const STATUS_LABELS: Record<string, string> = {
  exists: 'SET',
  'has-default': 'DEFAULT',
  missing: 'MISSING',
};

export function ListVariablesModal({ open, variables, onClose, onSave }: ListVariablesModalProps) {
  const { t } = useTranslation('common');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [filter, setFilter] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const filterRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFilter('');
      setEditingName(null);
      requestAnimationFrame(() => filterRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== filterRef.current) filterRef.current?.focus(); }, 50);
    }
  }, [open]);

  useEffect(() => {
    if (editingName !== null) {
      requestAnimationFrame(() => {
        editRef.current?.focus();
        editRef.current?.select();
      });
    }
  }, [editingName]);

  const filtered = useMemo(() => {
    if (!filter) return variables;
    const lower = filter.toLowerCase();
    return variables.filter((v) => v.name.toLowerCase().includes(lower));
  }, [variables, filter]);

  const startEditing = useCallback((v: VariableMatch) => {
    setEditingName(v.name);
    setEditValue(v.status === 'exists' ? v.resolvedValue : '');
  }, []);

  const commitEdit = useCallback(() => {
    if (editingName === null) return;
    onSave(editingName, editValue);
    setEditingName(null);
  }, [editingName, editValue, onSave]);

  const handleFilterKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingName(null);
      }
      e.stopPropagation();
    },
    [commitEdit]
  );

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t('variables.title')}
        className="flex flex-col w-full rounded-xl overflow-hidden modal-content"
        style={{
          maxWidth: '32rem',
          maxHeight: '60vh',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--ctp-accent) 10%, transparent)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            borderBottom: '1px solid var(--ctp-surface1)',
          }}
        >
          <Search size={16} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
          <input
            ref={filterRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t('listVariablesModal.filterPlaceholder')}
            className="w-full py-3.5 text-sm outline-none"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--ctp-text)',
            }}
          />
          <span
            className="text-xs px-1.5 py-0.5 rounded shrink-0"
            style={{
              color: 'var(--ctp-overlay0)',
              backgroundColor: 'var(--ctp-surface1)',
            }}
          >
            ESC
          </span>
        </div>

        {/* Variable list */}
        <div className="overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
              {variables.length === 0 ? t('listVariablesModal.noVariablesInDoc') : t('listVariablesModal.noMatchingVariables')}
            </div>
          ) : (
            filtered.map((v, i) => {
              const isEditing = editingName === v.name;
              return (
                <div key={`${v.name}-${i}`}>
                  <button
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors hover:bg-[var(--ctp-surface0)]"
                    onClick={() => startEditing(v)}
                  >
                    {/* Status badge */}
                    <span
                      className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase"
                      style={{
                        color: STATUS_COLORS[v.status],
                        backgroundColor: 'var(--ctp-surface1)',
                      }}
                    >
                      {STATUS_LABELS[v.status]}
                    </span>

                    {/* Variable name */}
                    <span className="text-sm truncate flex-1" style={{ color: 'var(--ctp-text)' }}>
                      {v.name}
                    </span>

                    {/* Current value */}
                    <span
                      className="text-xs truncate max-w-[10rem]"
                      style={{ color: 'var(--ctp-overlay1)' }}
                    >
                      {v.status === 'exists'
                        ? v.resolvedValue
                        : v.status === 'has-default'
                          ? t('listVariablesModal.defaultPrefix', { value: v.defaultValue })
                          : '—'}
                    </span>
                  </button>

                  {/* Inline edit row */}
                  {isEditing && (
                    <div
                      className="flex items-center gap-2 px-4 py-2"
                      style={{
                        backgroundColor: 'var(--ctp-surface0)',
                        borderTop: '1px solid var(--ctp-surface1)',
                        borderBottom: '1px solid var(--ctp-surface1)',
                      }}
                    >
                      <span className="text-xs shrink-0" style={{ color: 'var(--ctp-overlay1)' }}>
                        {v.name} =
                      </span>
                      <input
                        ref={editRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        placeholder={t('setVariableModal.enterValuePlaceholder')}
                        className="flex-1 px-2 py-1 text-xs rounded outline-none"
                        style={{
                          backgroundColor: 'var(--ctp-base)',
                          color: 'var(--ctp-text)',
                          border: '1px solid var(--ctp-surface2)',
                        }}
                      />
                      <button
                        onClick={commitEdit}
                        className="p-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
                        style={{ color: 'var(--ctp-green)' }}
                        title={t('listVariablesModal.saveTitleHint')}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 flex items-center gap-2 text-xs"
          style={{
            color: 'var(--ctp-overlay0)',
            borderTop: '1px solid var(--ctp-surface1)',
          }}
        >
          <List size={12} />
          <span>{variables.length !== 1 ? t('listVariablesModal.variablesFound_other', { count: variables.length }) : t('listVariablesModal.variablesFound_one', { count: variables.length })}</span>
          {editingName && (
            <span className="ml-auto" style={{ color: 'var(--ctp-subtext0)' }}>
              {t('listVariablesModal.enterToSave')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
