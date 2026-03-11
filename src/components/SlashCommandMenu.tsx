import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, MessageSquare, Code, Sigma, Minus, Table, FileStack,
  Image, FileInput,
} from 'lucide-react';
import { slashCommandBus, type SlashCommandRequest } from '../lib/slash-command-bus';
import { SLASH_COMMAND_ITEMS, SLASH_COMMAND_GROUPS, type SlashCommandItem } from '../editor/slash-commands/slash-command-items';
import { clearActiveSlash } from '../editor/slash-commands/slash-command-extension';
import { quickOpenBus } from '../lib/quick-open-bus';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, MessageSquare, Code, Sigma, Minus, Table, FileStack,
  Image, FileInput,
};

const GROUP_LABEL_KEYS: Record<string, string> = {
  textAndHeadings: 'slashCommands.groups.textAndHeadings',
  codeAndMedia: 'slashCommands.groups.codeAndMedia',
  structured: 'slashCommands.groups.structured',
  embeds: 'slashCommands.groups.embeds',
};

interface Props {
  editorViewRef: React.RefObject<import('@codemirror/view').EditorView | null>;
}

export function SlashCommandMenu({ editorViewRef }: Props) {
  const { t } = useTranslation('editor');
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [slashFrom, setSlashFrom] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!query) return SLASH_COMMAND_ITEMS;
    const q = query.toLowerCase();
    return SLASH_COMMAND_ITEMS.filter((item) => {
      const label = t(item.labelKey).toLowerCase();
      return label.includes(q) || item.keywords.some((kw) => kw.includes(q));
    });
  }, [query, t]);

  const groupedItems = useMemo(() => {
    const groups: { group: string; items: SlashCommandItem[] }[] = [];
    for (const group of SLASH_COMMAND_GROUPS) {
      const items = filteredItems.filter((i) => i.group === group);
      if (items.length > 0) groups.push({ group, items });
    }
    return groups;
  }, [filteredItems]);

  const flatItems = useMemo(() => groupedItems.flatMap((g) => g.items), [groupedItems]);

  const executeItem = useCallback((item: SlashCommandItem) => {
    const view = editorViewRef.current;
    if (!view) return;

    const to = view.state.selection.main.head;

    if (item.id === 'template') {
      view.dispatch({ changes: { from: slashFrom, to } });
      view.focus();
      clearActiveSlash();
      setIsOpen(false);
      quickOpenBus.requestLinkPicker(() => {});
      return;
    }

    if (item.id === 'embedNote') {
      view.dispatch({ changes: { from: slashFrom, to, insert: '![[' } });
      view.focus();
      clearActiveSlash();
      setIsOpen(false);
      quickOpenBus.requestLinkPicker((name: string) => {
        const currentView = editorViewRef.current;
        if (!currentView) return;
        const pos = currentView.state.selection.main.head;
        currentView.dispatch({
          changes: { from: pos, to: pos, insert: `${name}]]` },
          selection: { anchor: pos + name.length + 2 },
        });
        currentView.focus();
      });
      return;
    }

    item.action(view, slashFrom, to);
    clearActiveSlash();
    setIsOpen(false);
  }, [editorViewRef, slashFrom]);

  useEffect(() => {
    const unsubOpen = slashCommandBus.onOpen((req: SlashCommandRequest) => {
      setPosition({ x: req.x, y: req.y });
      setSlashFrom(req.from);
      setQuery('');
      setSelectedIndex(0);
      setIsOpen(true);
    });
    const unsubClose = slashCommandBus.onClose(() => {
      setIsOpen(false);
    });
    const unsubUpdate = slashCommandBus.onUpdate((q: string) => {
      setQuery(q);
      setSelectedIndex(0);
    });
    return () => { unsubOpen(); unsubClose(); unsubUpdate(); };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearActiveSlash();
        setIsOpen(false);
        editorViewRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          executeItem(flatItems[selectedIndex]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, flatItems, selectedIndex, executeItem, editorViewRef]);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const el = menuRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        clearActiveSlash();
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (!isOpen || flatItems.length === 0) return null;

  let itemIndex = 0;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-64 max-h-72 overflow-y-auto rounded-lg border shadow-lg"
      style={{
        left: position.x,
        top: position.y + 4,
        backgroundColor: 'var(--ctp-base)',
        borderColor: 'var(--ctp-surface0)',
      }}
    >
      {groupedItems.map(({ group, items }) => (
        <div key={group}>
          <div
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--ctp-subtext0)' }}
          >
            {t(GROUP_LABEL_KEYS[group])}
          </div>
          {items.map((item) => {
            const idx = itemIndex++;
            const Icon = ICON_MAP[item.icon];
            return (
              <button
                key={item.id}
                data-index={idx}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{
                  color: 'var(--ctp-text)',
                  backgroundColor: idx === selectedIndex ? 'var(--ctp-surface0)' : 'transparent',
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => executeItem(item)}
              >
                {Icon && <Icon size={16} />}
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
