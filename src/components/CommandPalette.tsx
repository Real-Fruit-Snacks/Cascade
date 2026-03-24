import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { commandRegistry, type Command } from '../lib/command-registry';
import { fuzzyMatch } from '../lib/fuzzy-match';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { KbdBadge } from './ui/KbdBadge';

function highlightMatches(text: string, indices: number[]) {
  const indexSet = new Set(indices);
  const parts: React.ReactNode[] = [];
  let current = '';
  let isMatch = false;

  for (let i = 0; i <= text.length; i++) {
    const charMatch = indexSet.has(i);
    if (i === text.length || charMatch !== isMatch) {
      if (current) {
        parts.push(isMatch
          ? <span key={i} style={{ color: 'var(--ctp-accent)', fontWeight: 600 }}>{current}</span>
          : current
        );
      }
      current = i < text.length ? text[i] : '';
      isMatch = charMatch;
    } else {
      current += text[i];
    }
  }
  return parts;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation('commands');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allCommands, setAllCommands] = useState<Command[]>(() => commandRegistry.getAll());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  // Subscribe to registry changes
  useEffect(() => {
    const unsub = commandRegistry.subscribe(() => {
      setAllCommands(commandRegistry.getAll());
    });
    return unsub;
  }, []);

  const results = useMemo(() =>
    query.trim()
      ? allCommands
          .map((cmd) => ({ cmd, ...fuzzyMatch(query, cmd.label) }))
          .filter((r) => r.match)
          .sort((a, b) => b.score - a.score)
          .map((r) => ({ cmd: r.cmd, indices: r.indices }))
      : allCommands.map((cmd) => ({ cmd, indices: [] as number[] })),
    [query, allCommands]
  );

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus(); }, 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (cmd: Command) => {
      onClose();
      // Run after close to avoid interfering with any state the command changes
      setTimeout(() => cmd.run(), 0);
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex].cmd);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, handleSelect, onClose]
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
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.ariaLabel')}
        onKeyDown={trapKeyDown}
        className="flex flex-col w-full rounded-xl overflow-hidden modal-content"
        style={{
          maxWidth: '32rem',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--ctp-accent) 10%, transparent)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            borderBottom: '1px solid var(--ctp-surface1)',
          }}
        >
          <Terminal size={16} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('palette.placeholder')}
            className="w-full py-3.5 text-sm outline-none"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--ctp-text)',
            }}
          />
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--ctp-overlay0)',
              backgroundColor: 'var(--ctp-surface1)',
              flexShrink: 0,
            }}
          >
            ESC
          </span>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          role="listbox"
          className="overflow-y-auto"
          style={{
            maxHeight: '400px',
            backgroundColor: 'var(--ctp-mantle)',
          }}
        >
          {results.length === 0 && query && (
            <div
              className="px-4 py-8 text-sm text-center"
              style={{ color: 'var(--ctp-overlay0)' }}
            >
              {t('palette.noResults')}
            </div>
          )}
          {results.map(({ cmd, indices }, i) => {
            const isSelected = i === selectedIndex;
            return (
              <div
                key={cmd.id}
                role="option"
                aria-selected={isSelected}
                className="flex items-center justify-between px-3 py-2 cursor-pointer text-sm"
                style={{
                  backgroundColor: isSelected ? 'var(--ctp-surface0)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--ctp-accent)' : '2px solid transparent',
                }}
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span style={{ color: 'var(--ctp-text)' }}>{highlightMatches(cmd.label, indices)}</span>
                {cmd.shortcut && (
                  <span className="ml-3">
                    <KbdBadge shortcut={cmd.shortcut} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
