import type { FileEntry, FsChangeEvent } from '../types';

export interface CascadePlugin {
  id: string;
  name: string;
  version: string;
  onLoad(): Promise<void>;
  onUnload(): Promise<void>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  entrypoint: string;
  permissions: PluginPermission[];
  minAppVersion: string;
}

export type PluginPermission =
  | 'vault.read' | 'vault.write'
  | 'editor.read' | 'editor.write'
  | 'ui.commands' | 'ui.sidebar' | 'ui.statusbar' | 'ui.contextmenu' | 'ui.ribbon' | 'ui.views' | 'ui.settings'
  | 'events'
  | 'templates'
  | 'settings';

export interface PluginContext {
  vault: VaultAPI;
  editor: EditorAPI;
  ui: UIAPI;
  events: EventsAPI;
  settings: SettingsAPI;
  templates: TemplatesAPI;
}

export interface VaultAPI {
  getFiles(): FileEntry[];
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  onFileChange(cb: (event: FsChangeEvent) => void): () => void;
}

export interface EditorAPI {
  getSelection(): string;
  replaceSelection(text: string): void;
  getCursor(): { line: number; col: number };
  getActiveFile(): string | null;
  getContent(): string;
  setContent(content: string): void;
  insertAtCursor(text: string): void;
}

export interface UIAPI {
  addCommand(cmd: Command): () => void;
  addStatusBarItem(item: { id: string; text: string; onClick?: () => void }): () => void;
  removeStatusBarItem(id: string): void;
  addSidebarPanel(id: string, html: string): () => void;
  removeSidebarPanel(id: string): void;
  registerView(viewType: string, html: string): () => void;
  openView(viewType: string): void;
  addContextMenuItem(item: ContextMenuItem): () => void;
  removeContextMenuItem(id: string): void;
  addRibbonIcon(item: RibbonIcon): () => void;
  removeRibbonIcon(id: string): void;
  addSettingsTab(id: string, label: string, html: string): () => void;
  removeSettingsTab(id: string): void;
  showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
}

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

export interface EventsAPI {
  on(event: string, cb: (data: unknown) => void): () => void;
  emit(event: string, data: unknown): void;
}

export interface SettingsAPI {
  get<T = unknown>(key: string, defaultValue?: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  context: 'file' | 'editor' | 'tab';
  run: () => void;
}

export interface RibbonIcon {
  id: string;
  icon: string;
  tooltip: string;
  run: () => void;
}

export interface TemplatesAPI {
  registerFunction(name: string, fn: () => Promise<string>): () => void;
  unregisterFunction(name: string): void;
}
