import { EditorView } from '@codemirror/view';
import type { ViewMode } from '../types/index';

export type TabType = 'markdown' | 'image' | 'pdf' | 'canvas';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const CANVAS_EXTENSIONS = new Set(['.canvas']);

export function getTabType(path: string): TabType {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (CANVAS_EXTENSIONS.has(ext)) return 'canvas';
  return 'markdown';
}

export interface Tab {
  path: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isPinned?: boolean;
  cursorPos?: number;
  scrollTop?: number;
  type?: TabType;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface Pane {
  tabs: Tab[];
  activeTabIndex: number;
  editorViewRef: { current: EditorView | null };
}

export interface EditorState {
  tabs: Tab[];
  activeTabIndex: number;
  justSaved: boolean;
  viewMode: ViewMode;
  editorViewRef: { current: EditorView | null };
  recentFiles: string[];
  isFileLoading: boolean;
  pendingScrollLine: number | null;
  pendingScrollHeading: string | null;
  pendingScrollBlockId: string | null;
  focusModeActive: boolean;
  dirtyPaths: Set<string>;
  panes: Pane[];
  activePaneIndex: number;
  splitDirection: SplitDirection | null;
}

export interface EditorActions {
  openFile: (vaultRoot: string, path: string, newTab?: boolean, background?: boolean) => Promise<void>;
  addRecentFile: (vaultRoot: string, path: string) => void;
  loadRecentFiles: (vaultRoot: string) => void;
  openSpecialTab: (id: string) => void;
  closeTab: (index: number, force?: boolean) => void;
  closeActiveTab: () => void;
  hasDirtyTabs: () => boolean;
  closeFile: () => void;
  switchTab: (index: number) => void;
  nextTab: () => void;
  prevTab: () => void;
  moveTab: (from: number, to: number) => void;
  pinTab: (index: number) => void;
  unpinTab: (index: number) => void;
  updateContent: (content: string) => void;
  saveFile: (vaultRoot: string) => Promise<void>;
  handleExternalChange: (vaultRoot: string, relPath: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  setEditorView: (view: EditorView | null) => void;
  toggleFocusMode: () => void;
  splitPane: (direction: SplitDirection) => void;
  closeSplit: () => void;
  setActivePaneIndex: (index: number) => void;
  openFileInPane: (paneIndex: number, vaultRoot: string, path: string, newTab?: boolean) => Promise<void>;
  switchPaneTab: (paneIndex: number, tabIndex: number) => void;
  closePaneTab: (paneIndex: number, tabIndex: number, force?: boolean) => void;
  updatePaneContent: (paneIndex: number, content: string) => void;
  savePaneFile: (paneIndex: number, vaultRoot: string) => Promise<void>;
  setPaneEditorView: (paneIndex: number, view: EditorView | null) => void;
  moveTabToPane: (tabIndex: number, fromPane: number, toPane: number) => void;
}

export interface EditorDerived {
  activeFilePath: string | null;
  content: string;
  isDirty: boolean;
}

export const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
