import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FileText, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import * as cmd from '../lib/tauri-commands';
import { fuzzyMatch } from '../lib/fuzzy-match';

const MAX_PREVIEW_LINES = 30;
const PREVIEW_CACHE_MAX = 10;

// Parse YAML frontmatter into key-value pairs
function parseFrontmatter(text: string): { props: Record<string, string | string[]>; bodyStart: number } | null {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;

  const yaml = text.slice(4, end);
  const props: Record<string, string | string[]> = {};
  let currentKey = '';

  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^(\w[\w\s-]*?):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val) {
        props[currentKey] = val;
      } else {
        props[currentKey] = [];
      }
    } else if (currentKey && line.match(/^\s+-\s+(.*)/)) {
      const item = line.match(/^\s+-\s+(.*)/);
      if (item) {
        const arr = props[currentKey];
        if (Array.isArray(arr)) {
          arr.push(item[1].trim());
        } else {
          props[currentKey] = [item[1].trim()];
        }
      }
    }
  }

  // bodyStart is after the closing ---\n
  const bodyStart = end + 4;
  return { props, bodyStart };
}

const TAG_PILL_COLORS = [
  'var(--ctp-mauve)', 'var(--ctp-blue)', 'var(--ctp-teal)',
  'var(--ctp-green)', 'var(--ctp-peach)', 'var(--ctp-pink)',
];

function renderFrontmatterPanel(props: Record<string, string | string[]>): React.ReactNode {
  const entries = Object.entries(props);
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--ctp-mantle)',
        border: '1px solid var(--ctp-surface1)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '12px',
        fontSize: '0.6875rem',
      }}
    >
      {entries.map(([key, value], idx) => (
        <div
          key={key}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '4px 0',
            borderBottom: idx < entries.length - 1 ? '1px solid var(--ctp-surface0)' : undefined,
          }}
        >
          <span style={{ color: 'var(--ctp-overlay1)', minWidth: '60px', fontWeight: 500 }}>
            {key}
          </span>
          <span style={{ flex: 1 }}>
            {Array.isArray(value) ? (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {value.map((v, vi) => (
                  <span
                    key={vi}
                    style={{
                      display: 'inline-block',
                      padding: '1px 8px',
                      borderRadius: '10px',
                      fontSize: '0.625rem',
                      fontWeight: 500,
                      color: 'var(--ctp-base)',
                      backgroundColor: TAG_PILL_COLORS[vi % TAG_PILL_COLORS.length],
                    }}
                  >
                    {v}
                  </span>
                ))}
              </span>
            ) : (
              <span style={{ color: 'var(--ctp-text)' }}>{value}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// Styled markdown preview renderer
function renderMarkdownPreview(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  // Handle frontmatter
  const fm = parseFrontmatter(text);
  let body = text;
  if (fm) {
    elements.push(<React.Fragment key="fm">{renderFrontmatterPanel(fm.props)}</React.Fragment>);
    body = text.slice(fm.bodyStart).trimStart();
  }

  const lines = body.split('\n');
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeLines: string[] = [];

  const flushCodeBlock = (key: number) => {
    elements.push(
      <div
        key={`code-${key}`}
        style={{
          backgroundColor: 'var(--ctp-mantle)',
          borderRadius: '6px',
          padding: '10px 12px',
          margin: '4px 0',
          border: '1px solid var(--ctp-surface1)',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: '0.6875rem',
          lineHeight: '1.5',
          color: 'var(--ctp-green)',
          overflowX: 'auto',
        }}
      >
        {codeBlockLang && (
          <div style={{ color: 'var(--ctp-overlay0)', fontSize: '0.625rem', marginBottom: '4px' }}>
            {codeBlockLang}
          </div>
        )}
        {codeLines.map((cl, ci) => (
          <div key={ci}>{cl || '\u00A0'}</div>
        ))}
      </div>
    );
    codeLines = [];
    codeBlockLang = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock(i);
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trimStart().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      elements.push(
        <hr
          key={i}
          style={{
            border: 'none',
            borderTop: '1px solid var(--ctp-surface2)',
            margin: '8px 0',
          }}
        />
      );
      continue;
    }

    // Table: starts with | and has at least one |
    if (line.trimStart().startsWith('|') && line.includes('|', 1)) {
      // Collect all table lines
      const tableLines: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].trimStart().startsWith('|')) {
        i++;
        tableLines.push(lines[i]);
      }
      // Parse: first row = header, second row = alignment, rest = body
      const parseRow = (row: string) =>
        row.split('|').slice(1, -1).map((c) => c.trim());

      const headerCells = parseRow(tableLines[0]);
      // Detect alignment from separator row
      const alignments: ('left' | 'center' | 'right')[] = [];
      let bodyStart = 1;
      if (tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1])) {
        bodyStart = 2;
        for (const cell of parseRow(tableLines[1])) {
          if (cell.startsWith(':') && cell.endsWith(':')) alignments.push('center');
          else if (cell.endsWith(':')) alignments.push('right');
          else alignments.push('left');
        }
      }
      const bodyRows = tableLines.slice(bodyStart).map(parseRow);

      elements.push(
        <table
          key={`table-${i}`}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            margin: '8px 0',
            fontSize: '0.6875rem',
          }}
        >
          <thead>
            <tr>
              {headerCells.map((cell, ci) => (
                <th
                  key={ci}
                  style={{
                    padding: '6px 10px',
                    borderBottom: '2px solid var(--ctp-surface2)',
                    color: 'var(--ctp-blue)',
                    fontWeight: 600,
                    textAlign: alignments[ci] || 'left',
                  }}
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '4px 10px',
                      borderBottom: '1px solid var(--ctp-surface1)',
                      color: 'var(--ctp-text)',
                      textAlign: alignments[ci] || 'left',
                    }}
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // Image embed: ![alt](url) or ![[name]]
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/) || line.match(/^!\[\[([^\]]+)\]\]/);
    if (imgMatch) {
      const alt = imgMatch[1] || '';
      elements.push(
        <div
          key={i}
          style={{
            margin: '8px 0',
            padding: '8px',
            backgroundColor: 'var(--ctp-mantle)',
            borderRadius: '6px',
            border: '1px solid var(--ctp-surface1)',
            color: 'var(--ctp-overlay1)',
            fontSize: '0.6875rem',
            fontStyle: 'italic',
          }}
        >
          🖼 {alt || 'Image'}
        </div>
      );
      continue;
    }

    // Headers — different color per level (matches editor theme)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = ['1.4em', '1.25em', '1.1em', '1em', '0.95em', '0.9em'];
      const colors = [
        'var(--ctp-red)',    // h1
        'var(--ctp-peach)',  // h2
        'var(--ctp-yellow)', // h3
        'var(--ctp-green)',  // h4
        'var(--ctp-blue)',   // h5
        'var(--ctp-mauve)',  // h6
      ];
      elements.push(
        <div
          key={i}
          style={{
            color: colors[level - 1],
            fontWeight: 'bold',
            fontSize: sizes[level - 1],
            lineHeight: '1.4',
            margin: '6px 0 2px',
          }}
        >
          {renderInline(headingMatch[2])}
        </div>
      );
      continue;
    }

    // Blockquote / callout — collect all consecutive > lines
    if (line.startsWith('>')) {
      const blockLines: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].startsWith('>')) {
        i++;
        blockLines.push(lines[i]);
      }

      const firstContent = blockLines[0].replace(/^>\s?/, '');
      const calloutMatch = firstContent.match(/^\[!(\w+)\]\s*(.*)/);

      if (calloutMatch) {
        const rawType = calloutMatch[1].toLowerCase();
        const CALLOUT_COLORS: Record<string, string> = {
          note: 'blue', info: 'blue', todo: 'blue',
          abstract: 'teal', summary: 'teal', tldr: 'teal',
          tip: 'teal', hint: 'teal', important: 'teal',
          success: 'green', check: 'green', done: 'green',
          question: 'yellow', help: 'yellow', faq: 'yellow',
          warning: 'peach', caution: 'peach', attention: 'peach',
          failure: 'red', fail: 'red', missing: 'red',
          danger: 'red', error: 'red', bug: 'red',
          example: 'mauve',
          quote: 'overlay1', cite: 'overlay1',
        };
        const colorName = CALLOUT_COLORS[rawType] ?? 'blue';
        const cssColor = `var(--ctp-${colorName})`;
        const title = calloutMatch[2]?.trim() || rawType.charAt(0).toUpperCase() + rawType.slice(1);
        const bodyLines = blockLines.slice(1).map((l) => l.replace(/^>\s?/, ''));

        elements.push(
          <div
            key={`callout-${i}`}
            style={{
              borderLeft: `3px solid ${cssColor}`,
              borderRadius: '4px',
              backgroundColor: `color-mix(in srgb, ${cssColor} 8%, transparent)`,
              padding: '8px 12px',
              margin: '6px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: bodyLines.length > 0 ? '4px' : 0 }}>
              <span style={{ color: cssColor, fontWeight: 600, fontSize: '0.75rem' }}>
                {title}
              </span>
            </div>
            {bodyLines.map((bl, bi) => (
              <div key={bi} style={{ color: 'var(--ctp-text)', margin: '1px 0', paddingLeft: '26px' }}>
                {renderInline(bl)}
              </div>
            ))}
          </div>
        );
      } else {
        // Regular blockquote
        elements.push(
          <div
            key={`bq-${i}`}
            style={{
              borderLeft: '3px solid var(--ctp-surface2)',
              paddingLeft: '10px',
              margin: '4px 0',
            }}
          >
            {blockLines.map((bl, bi) => (
              <div
                key={bi}
                style={{
                  color: 'var(--ctp-overlay2)',
                  fontStyle: 'italic',
                  margin: '1px 0',
                }}
              >
                {renderInline(bl.replace(/^>\s?/, ''))}
              </div>
            ))}
          </div>
        );
      }
      continue;
    }

    // List items
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const isChecked = listMatch[3].startsWith('[x] ') || listMatch[3].startsWith('[X] ');
      const isUnchecked = listMatch[3].startsWith('[ ] ');
      let content = listMatch[3];
      let marker = '\u2022';

      if (isChecked) {
        marker = '\u2713';
        content = content.slice(4);
      } else if (isUnchecked) {
        marker = '\u25CB';
        content = content.slice(4);
      }

      elements.push(
        <div
          key={i}
          style={{
            paddingLeft: `${8 + indent * 12}px`,
            margin: '1px 0',
            color: 'var(--ctp-text)',
          }}
        >
          <span style={{ color: isChecked ? 'var(--ctp-green)' : 'var(--ctp-yellow)', marginRight: '6px' }}>
            {marker}
          </span>
          <span style={{ color: isChecked ? 'var(--ctp-overlay1)' : undefined, textDecoration: isChecked ? 'line-through' : undefined }}>
            {renderInline(content)}
          </span>
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} style={{ height: '8px' }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <div key={i} style={{ color: 'var(--ctp-text)', margin: '1px 0' }}>
        {renderInline(line)}
      </div>
    );
  }

  // Flush unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    flushCodeBlock(lines.length);
  }

  return elements;
}

// Hoisted regex for inline markdown patterns (includes strikethrough and #tags)
const INLINE_PATTERN = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|\[([^\]]+)\]\(([^)]+)\)|(?:^|\s)(#[a-zA-Z][\w/-]*))/g;

// Render inline markdown (bold, italic, code, links, wiki-links)
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  INLINE_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // ***bold italic***
      parts.push(
        <span key={key++} style={{ color: 'var(--ctp-peach)', fontWeight: 'bold', fontStyle: 'italic' }}>
          {match[2]}
        </span>
      );
    } else if (match[3]) {
      // **bold**
      parts.push(
        <span key={key++} style={{ color: 'var(--ctp-peach)', fontWeight: 'bold' }}>
          {match[3]}
        </span>
      );
    } else if (match[4]) {
      // *italic*
      parts.push(
        <span key={key++} style={{ color: 'var(--ctp-pink)', fontStyle: 'italic' }}>
          {match[4]}
        </span>
      );
    } else if (match[5]) {
      // ~~strikethrough~~
      parts.push(
        <span key={key++} style={{ color: 'var(--ctp-overlay1)', textDecoration: 'line-through' }}>
          {match[5]}
        </span>
      );
    } else if (match[6]) {
      // `inline code`
      parts.push(
        <span
          key={key++}
          style={{
            color: 'var(--ctp-green)',
            backgroundColor: 'var(--ctp-surface0)',
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '0.9em',
          }}
        >
          {match[6]}
        </span>
      );
    } else if (match[7]) {
      // [[wiki-link]] or [[target|display]]
      const display = match[8] || match[7];
      parts.push(
        <span key={key++} style={{ color: 'var(--ctp-blue)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
          {display}
        </span>
      );
    } else if (match[9]) {
      // [text](url)
      parts.push(
        <span key={key++} style={{ color: 'var(--ctp-blue)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
          {match[9]}
        </span>
      );
    } else if (match[11]) {
      // #tag — preserve leading whitespace, match editor tag styling
      const full = match[0];
      const leadingSpace = full.slice(0, full.indexOf('#'));
      if (leadingSpace) parts.push(leadingSpace);
      parts.push(
        <span
          key={key++}
          style={{
            color: 'var(--ctp-teal)',
            backgroundColor: 'rgba(148, 226, 213, 0.12)',
            padding: '1px 4px',
            borderRadius: '3px',
            fontWeight: 500,
          }}
        >
          {match[11]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

export type QuickOpenMode = 'open' | 'link';

interface QuickOpenProps {
  open: boolean;
  mode?: QuickOpenMode;
  onClose: () => void;
  onInsertLink?: (name: string) => void;
}

export function QuickOpen({ open, mode = 'open', onClose, onInsertLink }: QuickOpenProps) {
  const { t } = useTranslation('commands');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [preview, setPreview] = useState('');
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  // LRU cache scoped to component lifecycle
  const previewCache = useRef(new Map<string, string>());
  const cachePreview = useCallback((path: string, text: string) => {
    if (previewCache.current.size >= PREVIEW_CACHE_MAX) {
      const oldest = previewCache.current.keys().next().value!;
      previewCache.current.delete(oldest);
    }
    previewCache.current.set(path, text);
  }, []);

  const flatFiles = useVaultStore((s) => s.flatFiles);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const openFile = useEditorStore((s) => s.openFile);
  const recentFiles = useEditorStore((s) => s.recentFiles);
  const loadRecentFiles = useEditorStore((s) => s.loadRecentFiles);

  // Load recent files from localStorage when vault is known
  useEffect(() => {
    if (vaultPath) loadRecentFiles(vaultPath);
  }, [vaultPath, loadRecentFiles]);

  const flatFilesSet = useMemo(() => new Set(flatFiles), [flatFiles]);

  // Recent files filtered to only those that still exist in the vault
  const recentResults = useMemo(
    () => recentFiles.filter((p) => flatFilesSet.has(p)).slice(0, 20),
    [recentFiles, flatFilesSet]
  );

  const isEmptyQuery = !query.trim();

  const results = useMemo(() => {
    if (isEmptyQuery) return [];
    const recentSet = new Map(recentFiles.map((p, i) => [p, i]));
    return flatFiles
      .map((f) => ({ path: f, ...fuzzyMatch(query, f) }))
      .filter((r) => r.match)
      .sort((a, b) => {
        // Boost recent files: add score bonus based on recency position
        const aIdx = recentSet.get(a.path);
        const bIdx = recentSet.get(b.path);
        const aBoost = aIdx !== undefined ? 0.5 * (1 - aIdx / recentFiles.length) : 0;
        const bBoost = bIdx !== undefined ? 0.5 * (1 - bIdx / recentFiles.length) : 0;
        return (b.score + bBoost) - (a.score + aBoost);
      })
      .slice(0, 20)
      .map((r) => r.path);
  }, [query, flatFiles, isEmptyQuery, recentFiles]);

  // Active list: recent when empty query, search results otherwise
  const activeList = isEmptyQuery ? recentResults : results;

  // Reset state when opened
  useEffect(() => {
    if (open) {
      previewCache.current.clear();
      setQuery('');
      setSelectedIndex(0);
      setPreview('');
      setPreviewPath(null);
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus(); }, 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Load preview for selected file
  useEffect(() => {
    const selectedFile = activeList[selectedIndex];
    if (!selectedFile || !vaultPath || selectedFile === previewPath) return;

    // Check cache first to avoid redundant IPC calls
    const cached = previewCache.current.get(selectedFile);
    if (cached !== undefined) {
      setPreview(cached);
      setPreviewPath(selectedFile);
      return;
    }

    let cancelled = false;
    cmd.readFile(vaultPath, selectedFile).then((text) => {
      if (cancelled) return;
      const lines = text.split('\n').slice(0, MAX_PREVIEW_LINES);
      const previewText = lines.join('\n');
      cachePreview(selectedFile, previewText);
      setPreview(previewText);
      setPreviewPath(selectedFile);
    }).catch(() => {
      if (!cancelled) {
        setPreview('');
        setPreviewPath(selectedFile);
      }
    });

    return () => { cancelled = true; };
  }, [selectedIndex, activeList, vaultPath, previewPath]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Account for the header element when showing recent files
    const offset = isEmptyQuery && recentResults.length > 0 ? 1 : 0;
    const item = list.children[selectedIndex + offset] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isEmptyQuery, recentResults.length]);

  const handleSelect = useCallback(
    (path: string, newTab?: boolean) => {
      if (mode === 'link') {
        // Insert wiki-link: strip .md extension for the link name
        const name = path.replace(/\.md$/, '');
        onInsertLink?.(name);
      } else {
        if (vaultPath) {
          openFile(vaultPath, path, newTab);
        }
      }
      onClose();
    },
    [mode, vaultPath, openFile, onClose, onInsertLink]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, activeList.length - 1));
          setPreviewPath(null);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          setPreviewPath(null);
          break;
        case 'Enter':
          e.preventDefault();
          if (activeList[selectedIndex]) {
            handleSelect(activeList[selectedIndex], e.ctrlKey || e.metaKey);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [activeList, selectedIndex, handleSelect, onClose]
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
        aria-label={t('quickOpen.ariaLabel')}
        onKeyDown={trapKeyDown}
        className="flex flex-col w-full rounded-xl overflow-hidden modal-content"
        style={{
          maxWidth: '56rem',
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
          {mode === 'link' ? (
            <Link size={16} style={{ color: 'var(--ctp-blue)', flexShrink: 0 }} />
          ) : (
            <FileText size={16} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'link' ? t('quickOpen.placeholderLink') : t('quickOpen.placeholderOpen')}
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

        {/* Results + Preview */}
        <div className="flex" style={{ height: '440px' }}>
          {/* File list */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto shrink-0"
            style={{
              width: '42%',
              borderRight: '1px solid var(--ctp-surface1)',
              backgroundColor: 'var(--ctp-mantle)',
            }}
          >
            {!isEmptyQuery && results.length === 0 && (
              <div
                className="px-4 py-8 text-sm text-center"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                {t('quickOpen.noMatchingFiles')}
              </div>
            )}
            {isEmptyQuery && recentResults.length === 0 && (
              <div
                className="px-4 py-8 text-sm text-center"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                {t('quickOpen.noRecentFiles')}
              </div>
            )}
            {isEmptyQuery && recentResults.length > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                style={{ color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface0)' }}
              >
                <Clock size={11} style={{ color: 'var(--ctp-accent)' }} />
                {t('quickOpen.recentHeader')}
              </div>
            )}
            {activeList.map((path, i) => {
              const parts = path.replace(/\\/g, '/').split('/');
              const name = parts.at(-1) ?? path;
              const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
              const isSelected = i === selectedIndex;

              return (
                <div
                  key={path}
                  role="option"
                  aria-selected={isSelected}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm"
                  style={{
                    backgroundColor: isSelected ? 'var(--ctp-surface0)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--ctp-accent)' : '2px solid transparent',
                    color: 'var(--ctp-text)',
                  }}
                  onClick={(e) => handleSelect(path, e.ctrlKey || e.metaKey)}
                  onMouseEnter={() => {
                    setSelectedIndex(i);
                    setPreviewPath(null);
                  }}
                >
                  <FileText
                    size={14}
                    style={{
                      color: isSelected ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex flex-col truncate">
                    <span
                      className="truncate"
                      style={{
                        color: isSelected ? 'var(--ctp-text)' : 'var(--ctp-subtext1)',
                      }}
                    >
                      {name.replace(/\.md$/, '')}
                    </span>
                    {dir && (
                      <span
                        className="truncate text-xs"
                        style={{ color: 'var(--ctp-overlay0)' }}
                      >
                        {dir}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview pane */}
          <div
            className="flex-1 overflow-y-auto p-5 text-xs leading-relaxed"
            style={{
              color: 'var(--ctp-subtext0)',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              wordBreak: 'break-word',
              backgroundColor: 'var(--ctp-base)',
            }}
          >
            {preview ? (
              renderMarkdownPreview(preview)
            ) : (
              <span style={{ color: 'var(--ctp-overlay0)', fontStyle: 'italic' }}>
                {activeList.length > 0 ? t('quickOpen.loadingPreview') : t('quickOpen.noFileSelected')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
