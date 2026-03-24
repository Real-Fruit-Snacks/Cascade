import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { List } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';

interface Heading {
  level: number;
  text: string;
  line: number;
}

function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split('\n');
  let inFrontmatter = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track YAML frontmatter
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---') inFrontmatter = false;
      continue;
    }

    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Match ATX headings (# through ######)
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/\s*#+\s*$/, '').trim(), // strip trailing # markers
        line: i + 1, // 1-based line number
      });
    }
  }

  return headings;
}

// Returns the set of heading lines that have children (i.e., are parents).
function computeParentLines(headings: Heading[]): Set<number> {
  const parents = new Set<number>();
  for (let i = 0; i < headings.length - 1; i++) {
    if (headings[i + 1].level > headings[i].level) {
      parents.add(headings[i].line);
    }
  }
  return parents;
}

// Returns the set of heading lines that should be visible given expanded state.
function computeVisibleLines(headings: Heading[], expanded: Set<number>): Set<number> {
  const visible = new Set<number>();
  // Stack of ancestor lines — a heading is visible only if all ancestors are expanded.
  const ancestorStack: Heading[] = [];

  for (const heading of headings) {
    // Pop ancestors that are no longer relevant (same level or higher)
    while (ancestorStack.length > 0 && ancestorStack[ancestorStack.length - 1].level >= heading.level) {
      ancestorStack.pop();
    }

    // Visible if there are no ancestors, or all ancestors are expanded
    const parentVisible = ancestorStack.length === 0 || ancestorStack.every((a) => expanded.has(a.line));
    if (parentVisible) {
      visible.add(heading.line);
    }

    ancestorStack.push(heading);
  }

  return visible;
}

export function OutlinePanel() {
  const { t } = useTranslation('sidebar');

  const content = useEditorStore((s) => s.content);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);

  const outlineMinLevel = useSettingsStore((s) => s.outlineMinLevel);
  const outlineAutoExpand = useSettingsStore((s) => s.outlineAutoExpand);

  const deferredContent = useDeferredValue(content);
  const allHeadings = useMemo(() => extractHeadings(deferredContent), [deferredContent]);
  const headings = useMemo(
    () => allHeadings.filter((h) => h.level >= outlineMinLevel),
    [allHeadings, outlineMinLevel],
  );

  const parentLines = useMemo(() => computeParentLines(headings), [headings]);

  // Track which parent headings are expanded (by line number).
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    outlineAutoExpand ? new Set(parentLines) : new Set(),
  );

  // Reset expanded state only when the autoExpand setting actually toggles.
  // When new headings appear while autoExpand is on, add them to expanded set.
  const prevAutoExpand = useRef(outlineAutoExpand);
  useEffect(() => {
    if (prevAutoExpand.current !== outlineAutoExpand) {
      setExpanded(outlineAutoExpand ? new Set(parentLines) : new Set());
      prevAutoExpand.current = outlineAutoExpand;
    } else if (outlineAutoExpand) {
      // Add any newly appeared parent headings
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const line of parentLines) {
          next.add(line);
        }
        return next;
      });
    }
  }, [outlineAutoExpand, parentLines]);

  const visibleLines = useMemo(() => computeVisibleLines(headings, expanded), [headings, expanded]);

  const editorViewRef = useEditorStore((s) => s.editorViewRef);

  const scrollToLine = (line: number) => {
    const view = editorViewRef.current;
    if (!view) return;
    const lineInfo = view.state.doc.line(line);
    view.dispatch({
      selection: { anchor: lineInfo.from },
    });
    view.focus();
    const coords = view.coordsAtPos(lineInfo.from);
    if (coords) {
      const editorRect = view.dom.getBoundingClientRect();
      const targetY = coords.top - editorRect.top - editorRect.height / 3;
      view.scrollDOM.scrollTop += targetY;
    }
  };

  const toggleExpanded = (line: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  };

  if (!activeFilePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-8 px-4 text-center">
        <List size={32} strokeWidth={1} style={{ color: 'var(--ctp-surface2)' }} />
        <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('emptyStates.noFileOpen')}</p>
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-8 px-4 text-center">
        <List size={32} strokeWidth={1} style={{ color: 'var(--ctp-surface2)' }} />
        <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('emptyStates.noHeadings')}</p>
        <p className="text-[0.65rem]" style={{ color: 'var(--ctp-surface2)' }}>Use # Heading to add structure</p>
      </div>
    );
  }

  // Find minimum heading level for indentation normalization
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 py-1">
        <span className="font-semibold uppercase" style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.05em', color: 'var(--ctp-overlay1)' }}>
          {t('panels.outline')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1" style={{ overscrollBehavior: 'contain' }}>
        {headings.map((heading, i) => {
          if (!visibleLines.has(heading.line)) return null;

          const indent = (heading.level - minLevel) * 16;
          const colors = [
            'var(--ctp-red)',
            'var(--ctp-peach)',
            'var(--ctp-yellow)',
            'var(--ctp-green)',
            'var(--ctp-blue)',
            'var(--ctp-accent)',
          ];
          const color = colors[heading.level - 1] ?? 'var(--ctp-text)';
          const isParent = parentLines.has(heading.line);
          const isExpanded = expanded.has(heading.line);

          return (
            <div
              key={`${heading.line}-${i}`}
              className="flex items-center w-full"
              style={{ paddingLeft: 12 + indent }}
            >
              {/* Chevron placeholder — always reserve space for alignment */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isParent) toggleExpanded(heading.line);
                }}
                className="shrink-0 flex items-center justify-center w-4 h-4 rounded-sm transition-colors"
                style={{
                  color: 'var(--ctp-overlay0)',
                  opacity: isParent ? 0.6 : 0,
                  cursor: isParent ? 'pointer' : 'default',
                }}
                tabIndex={isParent ? 0 : -1}
                aria-label={isParent ? (isExpanded ? t('backlinks.collapseSection') : t('backlinks.expandSection')) : undefined}
              >
                <span style={{ fontSize: 9, lineHeight: 1, display: 'block' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
              </button>
              <button
                onClick={() => scrollToLine(heading.line)}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-0.5 pr-3 text-sm rounded-sm hover:bg-[var(--ctp-surface0)] transition-colors"
                style={{ color }}
                title={t('outline.headingTitle', { text: heading.text, line: heading.line })}
              >
                <span className="text-[10px] opacity-50 shrink-0">H{heading.level}</span>
                <span className="truncate">{heading.text}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
