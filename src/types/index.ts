export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
  modified?: number;
}

export interface FsChangeEvent {
  kind: 'create' | 'modify' | 'remove' | 'bulk';
  path: string;
  newPath?: string;
}

export type ViewMode = 'live' | 'source' | 'reading';
