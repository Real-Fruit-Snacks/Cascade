import React from 'react';
import { X, Pin, FileText, ChevronDown, Image as ImageIcon, Share2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { useTranslation } from 'react-i18next';

const SPECIAL_TAB_LABELS: Record<string, { label: string; icon: typeof Share2 }> = {
  '__graph__': { label: 'Graph', icon: Share2 },
};

export interface TabMeta {
  path: string;
  isDirty: boolean;
  isPinned: boolean;
  type: string;
}

interface TabBarProps {
  tabsMeta: TabMeta[];
  activeTabIndex: number;
  dragVisual: { from: number; insertSlot: number | null } | null;
  measuring: boolean;
  visibleIndices: Set<number>;
  overflowTabs: (TabMeta & { originalIndex: number })[];
  overflowMenuOpen: boolean;
  setOverflowMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tabListRef: React.RefObject<HTMLDivElement | null>;
  tabContainerRef: React.RefObject<HTMLDivElement | null>;
  overflowBtnRef: React.RefObject<HTMLButtonElement | null>;
  handleTabMouseDown: (e: React.MouseEvent, index: number) => void;
  handleTabDoubleClick: (e: React.MouseEvent, index: number) => void;
  handleTabContextMenu: (e: React.MouseEvent, index: number) => void;
  closeTab: (index: number) => void;
  setTabMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; index: number } | null>>;
  specialTabLabel: (path: string) => string | undefined;
  isPane: boolean;
  paneIndex: number | undefined;
}

export function TabBar({
  tabsMeta,
  activeTabIndex,
  dragVisual,
  measuring,
  visibleIndices,
  overflowTabs,
  overflowMenuOpen,
  setOverflowMenuOpen,
  tabListRef,
  tabContainerRef,
  overflowBtnRef,
  handleTabMouseDown,
  handleTabDoubleClick,
  handleTabContextMenu,
  closeTab,
  setTabMenu,
  specialTabLabel,
  isPane,
  paneIndex,
}: TabBarProps) {
  const { t } = useTranslation('editor');

  return (
    <div
      className="flex items-center shrink-0"
      style={{ backgroundColor: 'var(--ctp-mantle)', minHeight: 36, borderBottom: '1px solid var(--ctp-surface0)' }}
    >
      {/* Tab list with overflow menu */}
      <div ref={tabContainerRef} className="relative flex-1 min-w-0 overflow-hidden">
        <div
          ref={tabListRef}
          className="flex items-stretch flex-nowrap h-full"
        >
          {tabsMeta.length === 0 && (
            <div className="px-4 py-2 text-sm" style={{ color: 'var(--ctp-overlay0)' }}>
              No file open
            </div>
          )}
          {tabsMeta.map((tab, index) => {
            const isActive = index === activeTabIndex;
            const isHidden = !measuring && !visibleIndices.has(index);
            const special = SPECIAL_TAB_LABELS[tab.path];
            const fileNameRaw = tab.path.replace(/\\/g, '/').split('/').at(-1) ?? tab.path;
            const pluginViewType = tab.path.startsWith('__plugin-view:') ? tab.path.slice('__plugin-view:'.length) : null;
            const fileName = specialTabLabel(tab.path) ?? (pluginViewType ? pluginViewType : fileNameRaw.replace(/\.[^.]+$/, ''));
            const isDragSource = dragVisual?.from === index;
            const showDropBefore = dragVisual !== null && dragVisual.insertSlot === index;
            const showDropAfter = index === tabsMeta.length - 1 && dragVisual !== null && dragVisual.insertSlot === tabsMeta.length;
            return (
              <div key={tab.path} className="relative flex items-stretch shrink-0" style={isHidden ? { display: 'none' } : undefined}>
                {showDropBefore && (
                  <div
                    className="absolute left-0 top-1 bottom-1 w-0.5 z-20 rounded-full"
                    style={{ backgroundColor: 'var(--ctp-accent)', boxShadow: '0 0 4px var(--ctp-accent)' }}
                  />
                )}
                <div
                  className={`group/tab flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-t-2 select-none transition-colors ${isActive ? '' : 'hover:bg-[var(--ctp-surface0)]'}`}
                  style={{
                    backgroundColor: isActive ? 'var(--ctp-base)' : tab.isPinned ? 'var(--ctp-surface0)' : 'var(--ctp-mantle)',
                    color: isActive ? 'var(--ctp-text)' : 'var(--ctp-overlay1)',
                    fontWeight: isActive ? 500 : 400,
                    borderTopColor: isActive ? 'var(--ctp-accent)' : tab.isPinned ? 'var(--ctp-surface2)' : 'transparent',
                    borderBottom: isActive ? '1px solid var(--ctp-base)' : '1px solid transparent',
                    marginBottom: '-1px',
                    opacity: isDragSource ? 0.5 : 1,
                    transform: isDragSource ? 'scale(1.04) translateY(-1px)' : 'none',
                    boxShadow: isDragSource ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
                    transition: isDragSource ? 'none' : 'background-color 0.15s, opacity 0.15s, transform 0.1s, box-shadow 0.1s',
                    zIndex: isDragSource ? 5 : 'auto',
                    position: 'relative',
                  }}
                  onMouseDown={(e) => handleTabMouseDown(e, index)}
                  onDoubleClick={(e) => handleTabDoubleClick(e, index)}
                  onContextMenu={(e) => handleTabContextMenu(e, index)}
                >
                  {special && <special.icon size={12} className="shrink-0" style={{ color: isActive ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }} />}
                  {!special && tab.type === 'image' && <ImageIcon size={12} className="shrink-0" style={{ color: isActive ? 'var(--ctp-green)' : 'var(--ctp-overlay1)' }} />}
                  {!special && tab.type === 'pdf' && <FileText size={12} className="shrink-0" style={{ color: isActive ? 'var(--ctp-red)' : 'var(--ctp-overlay1)' }} />}
                  <span className="truncate max-w-[140px]" style={{ minWidth: 40 }} title={fileName}>{fileName}</span>
                  {tab.isDirty && !tab.isPinned && (
                    <span className="group-hover/tab:hidden" style={{ color: 'var(--ctp-red)', fontSize: '0.625rem' }}>&#9679;</span>
                  )}
                  {tab.isDirty && tab.isPinned && (
                    <span style={{ color: 'var(--ctp-red)', fontSize: '0.625rem' }}>&#9679;</span>
                  )}
                  {tab.isPinned ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        useEditorStore.getState().unpinTab(index);
                      }}
                      className="rounded p-0.5 transition-colors hover:bg-[var(--ctp-surface1)]"
                      style={{ color: 'var(--ctp-accent)' }}
                      title={t('tabs.unpinTitle')}
                    >
                      <Pin size={12} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(index);
                      }}
                      className={`rounded p-0.5 transition-colors hover:bg-[var(--ctp-surface0)] ${isActive ? '' : 'opacity-0 group-hover/tab:opacity-100'}`}
                      style={{ color: 'var(--ctp-overlay1)' }}
                      title={t('tabs.closeTitle')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                {showDropAfter && (
                  <div
                    className="absolute right-0 top-1 bottom-1 w-0.5 z-20 rounded-full"
                    style={{ backgroundColor: 'var(--ctp-accent)', boxShadow: '0 0 4px var(--ctp-accent)' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overflow menu button */}
      {overflowTabs.length > 0 && (
        <div className="relative shrink-0 self-stretch flex">
          <button
            ref={overflowBtnRef}
            onClick={() => setOverflowMenuOpen((v) => !v)}
            className="flex items-center justify-center gap-1 px-2 transition-colors text-[var(--ctp-overlay1)] hover:text-[var(--ctp-accent)] h-full"
            title={overflowTabs.length > 1 ? t('tabs.moreTabsPlural', { count: overflowTabs.length }) : t('tabs.moreTabsSingular', { count: overflowTabs.length })}
          >
            <ChevronDown size={14} />
            <span className="text-[10px] font-medium">{overflowTabs.length}</span>
          </button>
          {overflowMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOverflowMenuOpen(false)} />
              <div
                className="absolute right-0 top-full z-50 py-1 rounded-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--ctp-mantle)',
                  border: '1px solid var(--ctp-surface1)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  minWidth: 180,
                  maxWidth: 280,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {overflowTabs.map((tab) => {
                  const special = SPECIAL_TAB_LABELS[tab.path];
                  const fileNameRaw = tab.path.replace(/\\/g, '/').split('/').at(-1) ?? tab.path;
                  const pluginViewTypeOverflow = tab.path.startsWith('__plugin-view:') ? tab.path.slice('__plugin-view:'.length) : null;
                  const fileName = specialTabLabel(tab.path) ?? (pluginViewTypeOverflow ? pluginViewTypeOverflow : fileNameRaw.replace(/\.[^.]+$/, ''));
                  return (
                    <div
                      key={tab.path}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors hover:bg-[var(--ctp-surface0)]"
                      onClick={() => {
                        if (isPane) {
                          useEditorStore.getState().switchPaneTab(paneIndex!, tab.originalIndex);
                        } else {
                          useEditorStore.getState().switchTab(tab.originalIndex);
                        }
                        setOverflowMenuOpen(false);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTabMenu({ x: e.clientX, y: e.clientY, index: tab.originalIndex });
                      }}
                    >
                      {special ? (
                        <special.icon size={12} className="shrink-0" style={{ color: 'var(--ctp-overlay1)' }} />
                      ) : tab.type === 'image' ? (
                        <ImageIcon size={12} className="shrink-0" style={{ color: 'var(--ctp-overlay1)' }} />
                      ) : tab.type === 'pdf' ? (
                        <FileText size={12} className="shrink-0" style={{ color: 'var(--ctp-red)' }} />
                      ) : (
                        <FileText size={12} className="shrink-0" style={{ color: 'var(--ctp-overlay1)' }} />
                      )}
                      <span
                        className="text-xs truncate flex-1"
                        style={{ color: 'var(--ctp-text)' }}
                        title={fileName}
                      >
                        {fileName}
                      </span>
                      {tab.isDirty && (
                        <span style={{ color: 'var(--ctp-red)', fontSize: '0.625rem' }}>&#9679;</span>
                      )}
                      {!tab.isPinned && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.originalIndex);
                          }}
                          className="rounded p-0.5 transition-colors hover:bg-[var(--ctp-surface1)] opacity-0 hover:opacity-100"
                          style={{ color: 'var(--ctp-overlay1)' }}
                          title={t('tabs.closeTitle')}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
