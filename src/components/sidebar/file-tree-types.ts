export const FOLDER_COLOR_KEY = 'cascade-folder-colors';

export const FOLDER_PALETTE = [
  { name: 'Blue', cssVar: 'var(--ctp-blue)' },
  { name: 'Mauve', cssVar: 'var(--ctp-mauve)' },
  { name: 'Pink', cssVar: 'var(--ctp-pink)' },
  { name: 'Red', cssVar: 'var(--ctp-red)' },
  { name: 'Peach', cssVar: 'var(--ctp-peach)' },
  { name: 'Yellow', cssVar: 'var(--ctp-yellow)' },
  { name: 'Green', cssVar: 'var(--ctp-green)' },
  { name: 'Teal', cssVar: 'var(--ctp-teal)' },
  { name: 'Sky', cssVar: 'var(--ctp-sky)' },
  { name: 'Lavender', cssVar: 'var(--ctp-lavender)' },
  { name: 'Flamingo', cssVar: 'var(--ctp-flamingo)' },
  { name: 'Rosewater', cssVar: 'var(--ctp-rosewater)' },
];

export function getFolderColors(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FOLDER_COLOR_KEY) || '{}');
  } catch { return {}; }
}

export function setFolderColor(path: string, cssVar: string | null) {
  const colors = getFolderColors();
  if (cssVar) {
    colors[path] = cssVar;
  } else {
    delete colors[path];
  }
  localStorage.setItem(FOLDER_COLOR_KEY, JSON.stringify(colors));
}

export interface TreeSettings {
  confirmBeforeDelete: boolean;
  showFileExtensions: boolean;
  showFolderIcons: boolean;
  showFileIcons: boolean;
  enableFolderColors: boolean;
  folderColorSubfolders: boolean;
  folderColorFiles: boolean;
  folderColorStyle: string;
  folderColorFileStyle: string;
  folderColorBold: boolean;
  folderColorOpacity: number;
  folderColorIcon: boolean;
  folderColorName: boolean;
  folderColorBackground: boolean;
  folderColorChevron: boolean;
  folderColorFileIcon: boolean;
  folderColorFileName: boolean;
  folderColorFileBackground: boolean;
  enableBookmarks: boolean;
  useTrash: boolean;
  vaultPath: string | null;
}

export interface StyleTargets {
  icon: boolean;
  name: boolean;
  bg: boolean;
  chevron: boolean;
  dot: boolean;
  accentBar: boolean;
}

export function resolveStyleTargets(
  style: string,
  custom: { icon: boolean; name: boolean; bg: boolean; chevron?: boolean },
): StyleTargets {
  switch (style) {
    case 'icon-only': return { icon: true, name: false, bg: false, chevron: false, dot: false, accentBar: false };
    case 'text': return { icon: true, name: true, bg: false, chevron: false, dot: false, accentBar: false };
    case 'background': return { icon: true, name: false, bg: true, chevron: false, dot: false, accentBar: false };
    case 'accent-bar': return { icon: true, name: false, bg: false, chevron: false, dot: false, accentBar: true };
    case 'full': return { icon: true, name: true, bg: true, chevron: false, dot: false, accentBar: false };
    case 'dot': return { icon: false, name: false, bg: false, chevron: false, dot: true, accentBar: false };
    case 'custom': return { icon: custom.icon, name: custom.name, bg: custom.bg, chevron: custom.chevron ?? false, dot: false, accentBar: false };
    default: return { icon: true, name: false, bg: false, chevron: false, dot: false, accentBar: false };
  }
}

export function getParentDir(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const i = normalized.lastIndexOf('/');
  return i > 0 ? normalized.slice(0, i) : '';
}
