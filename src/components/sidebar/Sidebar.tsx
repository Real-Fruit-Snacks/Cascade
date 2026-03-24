import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeftRight, Command, FolderOpen, Hash, List, LogOut, Search, Settings, Share2, Star, Trash2, Users } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { VariablesIcon } from '../icons/VariablesIcon';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { VaultExplorer } from './VaultExplorer';
import { TagPanel } from './TagPanel';
import { BacklinksPanel } from './BacklinksPanel';
import { OutlinePanel } from './OutlinePanel';
import { BookmarksPanel } from './BookmarksPanel';
import { TrashPanel } from './TrashPanel';
import { CollabUsersPanel } from './CollabUsersPanel';
import { Tooltip } from '../Tooltip';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useCollabStore } from '../../stores/collab-store';
import { emit } from '../../lib/cascade-events';

type SidebarView = 'files' | 'tags' | 'backlinks' | 'outline' | 'bookmarks' | 'trash' | 'collab';

const STORAGE_KEY = 'cascade-sidebar-width';
const VIEW_KEY = 'cascade-sidebar-view';
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;

function getSavedWidth(): number {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const n = parseInt(saved, 10);
    if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return DEFAULT_WIDTH;
}

function getSavedView(): SidebarView {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === 'files' || saved === 'tags' || saved === 'backlinks' || saved === 'outline' || saved === 'bookmarks' || saved === 'trash' || saved === 'collab') return saved;
  return 'files';
}

export function Sidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const { t } = useTranslation('sidebar');

  const {
    enableTags, enableBacklinks, enableOutline, enableBookmarks,
    enableGraphView, enableVariables, enableSearch, variablesSidebarAction,
  } = useSettingsStore(useShallow((s) => ({
    enableTags: s.enableTags,
    enableBacklinks: s.enableBacklinks,
    enableOutline: s.enableOutline,
    enableBookmarks: s.enableBookmarks,
    enableGraphView: s.enableGraphView,
    enableVariables: s.enableVariables,
    enableSearch: s.enableSearch,
    variablesSidebarAction: s.variablesSidebarAction,
  })));

  const sidebarPanels = usePluginStore((s) => s.sidebarPanels);
  const ribbonIcons = usePluginStore((s) => s.ribbonIcons);
  const collabActive = useCollabStore((s) => s.active);

  const [varsMenu, setVarsMenu] = useState<{ x: number; y: number } | null>(null);
  const varsButtonRef = useRef<HTMLButtonElement>(null);

  const handleVarsClick = useCallback(() => {
    if (variablesSidebarAction === 'list') {
      emit('cascade:variables-list');
    } else {
      const rect = varsButtonRef.current?.getBoundingClientRect();
      if (rect) {
        setVarsMenu({ x: rect.right + 4, y: rect.top });
      }
    }
  }, [variablesSidebarAction]);

  const dispatchAfterClose = useCallback((eventName: Parameters<typeof emit>[0]) => {
    // Defer dispatch so the ContextMenu fully unmounts before the handler runs
    setTimeout(() => emit(eventName), 0);
  }, []);

  const varsMenuItems: MenuItem[] = [
    { label: t('variablesMenu.listAll'), onClick: () => dispatchAfterClose('cascade:variables-list') },
    { label: t('variablesMenu.replaceAllInDocument'), onClick: () => dispatchAfterClose('cascade:variables-replace-all') },
    { label: t('variablesMenu.replaceInSelection'), onClick: () => dispatchAfterClose('cascade:variables-replace-selection') },
    { label: t('variablesMenu.copyDocumentReplaced'), onClick: () => dispatchAfterClose('cascade:variables-copy-replaced') },
    { label: t('variablesMenu.copyLineReplaced'), onClick: () => dispatchAfterClose('cascade:variables-copy-line') },
    { label: t('variablesMenu.copySelectionReplaced'), onClick: () => dispatchAfterClose('cascade:variables-copy-selection') },
  ];

  const VIEWS: { id: SidebarView; icon: typeof FolderOpen; label: string }[] = [
    { id: 'files', icon: FolderOpen, label: t('views.files') },
    { id: 'tags', icon: Hash, label: t('views.tags') },
    { id: 'backlinks', icon: ArrowLeftRight, label: t('views.backlinks') },
    { id: 'outline', icon: List, label: t('views.outline') },
    { id: 'bookmarks', icon: Star, label: t('views.bookmarks') },
    { id: 'trash', icon: Trash2, label: t('views.trash') },
    { id: 'collab', icon: Users, label: t('views.collab') },
  ];

  const [width, setWidth] = useState(getSavedWidth);
  const [view, setView] = useState<SidebarView>(getSavedView);
  const widthRef = useRef(width);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      widthRef.current = next;
      // Update DOM directly — no React re-render during drag
      if (panelRef.current) {
        panelRef.current.style.width = `${next - 40}px`;
      }
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      // Commit final width to React state only on mouseup
      setWidth(widthRef.current);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Switch to tags view when a tag is clicked in the editor
  useEffect(() => {
    const handler = () => setView('tags');
    window.addEventListener('cascade:filter-tag', handler);
    return () => window.removeEventListener('cascade:filter-tag', handler);
  }, []);

  // Switch to files view when breadcrumb is clicked
  useEffect(() => {
    const handler = () => setView('files');
    window.addEventListener('cascade:reveal-in-tree', handler);
    return () => window.removeEventListener('cascade:reveal-in-tree', handler);
  }, []);

  // Keyboard shortcut: switch to a specific sidebar view (or toggle if already active)
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent<SidebarView>).detail;
      if (collapsed) {
        setView(target);
        onToggle?.();
      } else if (view === target) {
        onToggle?.();
      } else {
        setView(target);
      }
    };
    window.addEventListener('cascade:sidebar-view', handler);
    return () => window.removeEventListener('cascade:sidebar-view', handler);
  }, [collapsed, view, onToggle]);

  // Filter views based on feature toggles
  const visibleViews = VIEWS.filter(({ id }) => {
    if (id === 'tags') return enableTags;
    if (id === 'backlinks') return enableBacklinks;
    if (id === 'outline') return enableOutline;
    if (id === 'bookmarks') return enableBookmarks;
    if (id === 'collab') return collabActive;
    if (id === 'trash') return true;
    return true; // 'files' always visible
  });

  // Fall back to 'files' if the current view was disabled
  const activeView = visibleViews.some((v) => v.id === view) ? view : 'files';

  const handleDragStart = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="relative flex-shrink-0 flex h-full">
      {/* Activity bar */}
      <div
        className="flex flex-col items-center py-2 gap-1 shrink-0"
        style={{
          width: 40,
          backgroundColor: 'var(--ctp-crust)',
        }}
      >
        {visibleViews.map(({ id, icon: Icon, label }) => {
          const isActive = activeView === id;
          return (
          <Tooltip key={id} label={label} side="right">
            <button
              onClick={() => {
                if (collapsed) {
                  // Expand sidebar and switch to this view
                  setView(id);
                  onToggle?.();
                } else if (activeView === id) {
                  // Clicking the active view again collapses the sidebar
                  onToggle?.();
                } else {
                  // Just switch views
                  setView(id);
                }
              }}
              className={`relative flex items-center justify-center rounded-md transition-colors ${!(isActive && !collapsed) ? 'hover:bg-[var(--ctp-surface0)] sidebar-btn-hover' : ''}`}
              style={{
                width: 32,
                height: 32,
                color: isActive && !collapsed ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
                backgroundColor: isActive && !collapsed ? 'var(--ctp-surface0)' : 'transparent',
              }}
              aria-label={label}
            >
              {isActive && !collapsed && (
                <span
                  className="absolute left-0 rounded-r"
                  style={{
                    width: 3,
                    height: 16,
                    backgroundColor: 'var(--ctp-accent)',
                    top: '50%',
                    transform: 'translateY(-50%) translateX(-4px)',
                  }}
                />
              )}
              <Icon size={18} strokeWidth={isActive && !collapsed ? 2 : 1.5} />
            </button>
          </Tooltip>
          );
        })}
        {enableGraphView && (
          <Tooltip label={t('views.graphView')} side="right">
            <button
              onClick={() => useEditorStore.getState().openSpecialTab('__graph__')}
              className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
              style={{
                width: 32,
                height: 32,
                color: 'var(--ctp-overlay1)',
                backgroundColor: 'transparent',
              }}
              aria-label={t('views.graphView')}
            >
              <Share2 size={18} strokeWidth={1.5} />
            </button>
          </Tooltip>
        )}
        {enableVariables && (
          <Tooltip label={t('views.variables')} side="right">
            <button
              ref={varsButtonRef}
              onClick={handleVarsClick}
              className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
              style={{
                width: 32,
                height: 32,
                color: 'var(--ctp-overlay1)',
                backgroundColor: 'transparent',
              }}
              aria-label={t('views.variables')}
            >
              <VariablesIcon size={18} strokeWidth={1.5} />
            </button>
          </Tooltip>
        )}
        {enableSearch && (
          <Tooltip label={t('views.search')} side="right">
            <button
              onClick={() => emit('cascade:open-search')}
              className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
              style={{
                width: 32,
                height: 32,
                color: 'var(--ctp-overlay1)',
                backgroundColor: 'transparent',
              }}
              aria-label={t('views.search')}
            >
              <Search size={18} strokeWidth={1.5} />
            </button>
          </Tooltip>
        )}
        <Tooltip label={t('views.commandPalette')} side="right">
          <button
            onClick={() => emit('cascade:open-command-palette')}
            className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
            style={{
              width: 32,
              height: 32,
              color: 'var(--ctp-overlay1)',
              backgroundColor: 'transparent',
            }}
            aria-label={t('views.commandPalette')}
          >
            <Command size={18} strokeWidth={1.5} />
          </button>
        </Tooltip>
        {ribbonIcons.size > 0 && Array.from(ribbonIcons.entries()).map(([id, item]) => {
          const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[item.icon];
          return (
            <Tooltip key={id} label={item.tooltip} side="right">
              <button
                onClick={() => item.sandbox.invokeCallback(item.runCallbackId)}
                title={item.tooltip}
                aria-label={item.tooltip}
                className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
                style={{
                  width: 32,
                  height: 32,
                  color: 'var(--ctp-overlay1)',
                  backgroundColor: 'transparent',
                }}
              >
                {IconComponent ? <IconComponent size={18} strokeWidth={1.5} /> : <span style={{ fontSize: 12 }}>{item.icon}</span>}
              </button>
            </Tooltip>
          );
        })}
        <div className="flex-1" />
        <Tooltip label={t('views.closeVault')} side="right">
          <button
            onClick={() => emit('cascade:close-vault')}
            className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
            style={{
              width: 32,
              height: 32,
              color: 'var(--ctp-overlay1)',
              backgroundColor: 'transparent',
            }}
            aria-label={t('views.closeVault')}
          >
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        </Tooltip>
        <Tooltip label={t('views.settings')} side="right">
          <button
            onClick={() => emit('cascade:open-settings')}
            className="flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ctp-surface0)] sidebar-btn-hover"
            style={{
              width: 32,
              height: 32,
              color: 'var(--ctp-overlay1)',
              backgroundColor: 'transparent',
            }}
            aria-label={t('views.settings')}
          >
            <Settings size={18} strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>

      {/* Panel content */}
      <div
        ref={panelRef}
        className="flex flex-col overflow-hidden"
        style={{
          width: collapsed ? 0 : width - 40,
          opacity: collapsed ? 0 : 1,
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease',
          backgroundColor: 'var(--ctp-mantle)',
          pointerEvents: collapsed ? 'none' : undefined,
        }}
      >
        <div key={activeView} className="flex flex-col flex-1 overflow-hidden" style={{ animation: 'panel-fade-in 0.15s ease-out' }}>
          {activeView === 'files' && <VaultExplorer />}
          {activeView === 'tags' && enableTags && <TagPanel />}
          {activeView === 'backlinks' && enableBacklinks && <BacklinksPanel />}
          {activeView === 'outline' && enableOutline && <OutlinePanel />}
          {activeView === 'bookmarks' && enableBookmarks && <BookmarksPanel />}
          {activeView === 'trash' && <TrashPanel />}
          {activeView === 'collab' && collabActive && <CollabUsersPanel />}
        </div>
        {sidebarPanels.size > 0 && Array.from(sidebarPanels.entries()).map(([id, panel]) => (
          <div key={id} className="border-t" style={{ borderColor: 'var(--ctp-surface0)' }}>
            <iframe
              srcDoc={panel.html}
              sandbox="allow-scripts"
              className="w-full"
              style={{ border: 'none', minHeight: 100, maxHeight: 300 }}
              title={`Plugin panel: ${id}`}
            />
          </div>
        ))}
      </div>

      {/* Drag handle */}
      {!collapsed && (
        <div
          className="absolute top-0 right-0 h-full transition-colors"
          style={{
            width: 4,
            cursor: 'col-resize',
            backgroundColor: 'var(--ctp-surface1)',
            zIndex: 10,
          }}
          onMouseDown={handleDragStart}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ctp-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--ctp-surface1)'; }}
        />
      )}

      {/* Variables dropdown menu */}
      {varsMenu && (
        <ContextMenu
          x={varsMenu.x}
          y={varsMenu.y}
          items={varsMenuItems}
          onClose={() => setVarsMenu(null)}
        />
      )}
    </div>
  );
}
