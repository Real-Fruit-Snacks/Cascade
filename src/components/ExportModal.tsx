import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, X } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { useToastStore } from '../stores/toast-store';
import { flavors, isDarkTheme, isBuiltinFlavor, getCustomTheme } from '../styles/catppuccin-flavors';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, LevelFormat, convertInchesToTwip } from 'docx';
import { zipSync, strToU8 } from 'fflate';
import { exportFile, exportBinary, readFile, readFileBinary } from '../lib/tauri-commands';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';

interface RenderOptions {
  /** Map of wiki-link target (lowercase, no ext) → relative HTML path for resolution */
  wikiLinkMap?: Map<string, string>;
  /** Map to collect image paths into. Key = original src, Value = filename */
  imageCollector?: Map<string, string>;
  /** Prefix for rewritten image paths (e.g., "../assets/") */
  imagePrefix?: string;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  defaultScope?: 'current' | 'vault';
}

function markdownToHtml(md: string, options: RenderOptions = {}): string {
  // Simple markdown-to-HTML converter for common elements
  let html = md;

  // Remove YAML frontmatter
  if (html.startsWith('---')) {
    const end = html.indexOf('\n---', 3);
    if (end !== -1) {
      html = html.slice(end + 4).trim();
    }
  }

  const lines = html.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inlineFormat = (text: string): string => {
    let result = escapeHtml(text);
    // Images: ![alt](src)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      let finalSrc = src;
      if (options.imageCollector && !/^(https?:|data:)/i.test(src)) {
        const filename = src.replace(/\\/g, '/').split('/').pop() ?? src;
        options.imageCollector.set(src, filename);
        finalSrc = (options.imagePrefix ?? '') + filename;
      }
      return `<img src="${escapeHtmlAttr(finalSrc)}" alt="${escapeHtmlAttr(alt)}">`;
    });
    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');
    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Links (only allow safe URL schemes)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safeUrl = /^(https?:|mailto:)/i.test(url) ? escapeHtmlAttr(url) : '#';
      return `<a href="${safeUrl}">${text}</a>`;
    });
    // Wiki links
    result = result.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, target, alias) => {
      const display = alias || target;
      if (options.wikiLinkMap) {
        const key = target.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
        const resolved = options.wikiLinkMap.get(key);
        if (resolved) {
          return `<a href="${escapeHtmlAttr(resolved)}" class="wiki-link">${display}</a>`;
        }
      }
      return `<span class="wiki-link">${display}</span>`;
    });
    // Wiki image embeds: ![[image.png]]
    result = result.replace(/!\[\[([^\]]+)\]\]/g, (_, src) => {
      let finalSrc = src;
      if (options.imageCollector && !/^(https?:|data:)/i.test(src)) {
        const filename = src.replace(/\\/g, '/').split('/').pop() ?? src;
        options.imageCollector.set(src, filename);
        finalSrc = (options.imagePrefix ?? '') + filename;
      }
      return `<img src="${escapeHtmlAttr(finalSrc)}" alt="${escapeHtmlAttr(src)}">`;
    });
    // Tags
    result = result.replace(/(^|\s)#([a-zA-Z][\w/-]*)/g, '$1<span class="tag">#$2</span>');
    return result;
  };

  const closeList = () => {
    if (inList) {
      output.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }
  };

  for (const line of lines) {
    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      output.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      closeList();
      output.push('<hr>');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeList();
      output.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
      continue;
    }

    // Checkbox (must be checked before unordered list)
    const cbMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)/);
    if (cbMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        output.push('<ul class="checklist">');
        inList = true;
        listType = 'ul';
      }
      const checked = cbMatch[2] !== ' ' ? ' checked disabled' : ' disabled';
      output.push(`<li><input type="checkbox"${checked}> ${inlineFormat(cbMatch[3])}</li>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        output.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      output.push(`<li>${inlineFormat(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        output.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      output.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      closeList();
      continue;
    }

    // Paragraph
    closeList();
    output.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeList();
  if (inCodeBlock) {
    output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  return output.join('\n');
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildHtmlDocument(title: string, bodyHtml: string, style: 'themed' | 'minimal' = 'themed'): string {
  if (style === 'minimal') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttr(title)}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #fff;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.7;
  }
  h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em; color: #111; }
  a { color: #2563eb; }
  code {
    background: #f3f4f6;
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
  }
  pre {
    background: #f3f4f6;
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid #d1d5db;
    padding-left: 1em;
    color: #6b7280;
    font-style: italic;
  }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  .wiki-link { color: #7c3aed; font-weight: 500; }
  .tag { color: #2563eb; font-size: 0.9em; }
  img { max-width: 100%; border-radius: 8px; }
  .checklist { list-style: none; padding-left: 0.5em; }
  .checklist li { display: flex; align-items: center; gap: 0.5em; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  const themeId = useSettingsStore.getState().theme;
  const colors = isBuiltinFlavor(themeId) ? flavors[themeId] : (getCustomTheme(themeId)?.colors ?? flavors.mocha);
  const dark = isDarkTheme(themeId);

  return `<!DOCTYPE html>
<html lang="en" data-theme="${themeId}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttr(title)}</title>
<style>
  :root {
    --text: ${colors.text};
    --base: ${colors.base};
    --surface0: ${colors.surface0};
    --surface1: ${colors.surface1};
    --overlay0: ${colors.overlay0};
    --mauve: ${colors.mauve};
    --blue: ${colors.blue};
    --green: ${colors.green};
    --red: ${colors.red};
    --peach: ${colors.peach};
    --yellow: ${colors.yellow};
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--base);
    color: var(--text);
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.7;
  }
  h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em; }
  h1 { color: ${colors.red}; }
  h2 { color: ${colors.peach}; }
  h3 { color: ${colors.yellow}; }
  h4 { color: ${colors.green}; }
  h5 { color: ${colors.blue}; }
  h6 { color: ${colors.mauve}; }
  a { color: var(--blue); }
  code {
    background: var(--surface0);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
  }
  pre {
    background: var(--surface0);
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid var(--overlay0);
    padding-left: 1em;
    color: var(--overlay0);
    font-style: italic;
  }
  hr { border: none; border-top: 1px solid var(--surface1); margin: 2em 0; }
  .wiki-link { color: var(--mauve); font-weight: 500; }
  .tag { color: var(--blue); font-size: 0.9em; }
  img { max-width: 100%; border-radius: 8px; }
  .checklist { list-style: none; padding-left: 0.5em; }
  .checklist li { display: flex; align-items: center; gap: 0.5em; }
  @media print {
    body { background: ${dark ? '#fff' : 'var(--base)'}; color: ${dark ? '#1e1e2e' : 'var(--text)'}; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

type ExportFormat = 'html' | 'pdf' | 'markdown' | 'docx';

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  html: 'html',
  pdf: 'pdf',
  markdown: 'md',
  docx: 'docx',
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  html: 'HTML',
  pdf: 'PDF (Print)',
  markdown: 'Markdown',
  docx: 'Word Document',
};

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Process bold, italic, inline code in order
  const regex = /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(.+?)\*|_(.+?)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    if (match[2] !== undefined) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3] !== undefined) {
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4] !== undefined) {
      runs.push(new TextRun({ text: match[4], font: { name: 'Courier New' } }));
    } else if (match[5] !== undefined) {
      runs.push(new TextRun({ text: match[5], italics: true }));
    } else if (match[6] !== undefined) {
      runs.push(new TextRun({ text: match[6], italics: true }));
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }
  return runs;
}

async function markdownToDocx(md: string, title: string): Promise<Blob> {
  let body = md;

  // Strip YAML frontmatter
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) {
      body = body.slice(end + 4).trim();
    }
  }

  const lines = body.split('\n');
  const paragraphs: Paragraph[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: codeLines.join('\n'), font: { name: 'Courier New' }, size: 20 })],
          shading: { type: ShadingType.SOLID, color: 'F0F0F0' },
        }));
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingLevels = [
        HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
      ];
      paragraphs.push(new Paragraph({ text: headingMatch[2], heading: headingLevels[level - 1] }));
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
      }));
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2), italics: true })],
        indent: { left: convertInchesToTwip(0.5) },
      }));
      continue;
    }

    // Checkbox (must come before unordered list)
    const cbMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)/);
    if (cbMatch) {
      const checked = cbMatch[2] !== ' ';
      paragraphs.push(new Paragraph({
        text: `${checked ? '☑' : '☐'} ${cbMatch[3]}`,
        bullet: { level: 0 },
      }));
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      paragraphs.push(new Paragraph({ text: ulMatch[2], bullet: { level: 0 } }));
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      paragraphs.push(new Paragraph({
        text: olMatch[2],
        numbering: { reference: 'default-numbering', level: 0 },
      }));
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph with inline formatting
    paragraphs.push(new Paragraph({ children: parseInlineFormatting(line) }));
  }

  // Close unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: codeLines.join('\n'), font: { name: 'Courier New' }, size: 20 })],
      shading: { type: ShadingType.SOLID, color: 'F0F0F0' },
    }));
  }

  const doc = new Document({
    title,
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.START,
        }],
      }],
    },
    sections: [{
      children: paragraphs,
    }],
  });

  return Packer.toBlob(doc);
}

type BatchFormat = 'html-themed' | 'html-minimal' | 'markdown';

interface BatchExportOptions {
  vaultPath: string;
  files: string[];
  format: BatchFormat;
  includeImages: boolean;
  resolveWikiLinks: boolean;
  outputPath: string;
  onProgress: (current: number, total: number) => void;
  abortSignal?: { aborted: boolean };
}

function buildWikiLinkMap(files: string[], ext: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    const key = normalized.replace(/\.md$/i, '').toLowerCase();
    const outPath = normalized.replace(/\.md$/i, '.' + ext);
    map.set(key, outPath);
  }
  return map;
}

function deduplicateFilename(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  while (existing.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

async function performBatchExport(opts: BatchExportOptions): Promise<number> {
  const { vaultPath, files, format, includeImages, resolveWikiLinks, outputPath, onProgress, abortSignal } = opts;
  const isHtml = format.startsWith('html');
  const style = format === 'html-minimal' ? 'minimal' : 'themed';

  const wikiLinkMap = resolveWikiLinks && isHtml
    ? buildWikiLinkMap(files, 'html')
    : undefined;

  const zipEntries: Record<string, Uint8Array> = {};
  const imageMap = new Map<string, string>();
  const imageFilenames = new Set<string>();
  const pendingImages = new Map<string, string>();

  for (let i = 0; i < files.length; i++) {
    if (abortSignal?.aborted) break;
    onProgress(i + 1, files.length);

    const filePath = files[i];
    const content = await readFile(vaultPath, filePath);
    const normalized = filePath.replace(/\\/g, '/');

    if (format === 'markdown') {
      zipEntries[normalized] = strToU8(content);
    } else {
      const depth = normalized.split('/').length - 1;
      const toRoot = depth > 0 ? '../'.repeat(depth) : './';
      const imagePrefix = includeImages ? toRoot + 'assets/' : undefined;
      const imageCollector = includeImages ? new Map<string, string>() : undefined;

      let localWikiMap: Map<string, string> | undefined;
      if (wikiLinkMap) {
        localWikiMap = new Map<string, string>();
        const fileDir = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
        const fileDirParts = fileDir ? fileDir.split('/') : [];
        for (const [key, target] of wikiLinkMap) {
          const targetParts = target.split('/');
          let common = 0;
          while (common < fileDirParts.length && common < targetParts.length - 1 && fileDirParts[common] === targetParts[common]) {
            common++;
          }
          const ups = fileDirParts.length - common;
          const rel = (ups > 0 ? '../'.repeat(ups) : './') + targetParts.slice(common).join('/');
          localWikiMap.set(key, rel);
        }
      }

      const bodyHtml = markdownToHtml(content, {
        wikiLinkMap: localWikiMap,
        imageCollector,
        imagePrefix,
      });
      const title = normalized.split('/').pop()?.replace(/\.md$/i, '') ?? 'Note';
      const fullHtml = buildHtmlDocument(title, bodyHtml, style);
      const outPath = normalized.replace(/\.md$/i, '.html');
      zipEntries[outPath] = strToU8(fullHtml);

      if (imageCollector) {
        for (const [originalSrc, filename] of imageCollector) {
          if (!imageMap.has(originalSrc)) {
            const deduped = deduplicateFilename(filename, imageFilenames);
            imageFilenames.add(deduped);
            imageMap.set(originalSrc, deduped);
            const noteDir = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
            const resolved = noteDir ? noteDir + '/' + originalSrc : originalSrc;
            pendingImages.set(originalSrc, resolved);
          }
        }
      }
    }
  }

  if (includeImages && pendingImages.size > 0) {
    for (const [originalSrc, vaultRelPath] of pendingImages) {
      if (abortSignal?.aborted) break;
      try {
        const bytes = await readFileBinary(vaultPath, vaultRelPath);
        const deduped = imageMap.get(originalSrc)!;
        zipEntries['assets/' + deduped] = new Uint8Array(bytes);
      } catch {
        // Image not found — skip (link will be broken but export continues)
      }
    }
  }

  const zipped = zipSync(zipEntries);
  await exportBinary(outputPath, Array.from(zipped));

  return files.length;
}

export function ExportModal({ open, onClose, defaultScope }: ExportModalProps) {
  const { t } = useTranslation('export');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('html');
  const [batchFormat, setBatchFormat] = useState<BatchFormat>('html-themed');
  const [includeImages, setIncludeImages] = useState(true);
  const [resolveWikiLinks, setResolveWikiLinks] = useState(true);
  const [tagFilter, setTagFilter] = useState('');
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const content = useEditorStore((s) => s.content);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [scope, setScope] = useState<'current' | 'vault' | 'folder' | 'tag'>('current');
  const [selectedFolder, setSelectedFolder] = useState('');
  const fileTree = useVaultStore((s) => s.fileTree);
  const flatFiles = useVaultStore((s) => s.flatFiles);
  const tagIndex = useVaultStore((s) => s.tagIndex);

  const folders = useMemo(() => {
    if (!fileTree) return [];
    const result: string[] = [];
    const walk = (entries: typeof fileTree, prefix: string) => {
      for (const entry of entries) {
        if (entry.isDir) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          result.push(path);
          if (entry.children) walk(entry.children, path);
        }
      }
    };
    walk(fileTree, '');
    return result;
  }, [fileTree]);

  const fileName = activeFilePath?.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? 'export';

  useEffect(() => {
    if (open) {
      setScope(defaultScope ?? 'current');
    }
  }, [open, defaultScope]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (scope === 'current' && format !== 'html' && format !== 'markdown' && format !== 'pdf' && format !== 'docx') {
      setFormat('html');
    }
  }, [scope, format]);

  const handleExport = useCallback(async () => {
    if (!vaultPath) return;
    setExporting(true);
    try {
      // Batch export (vault, folder, or tag)
      if (scope !== 'current') {
        let exportFiles: string[];
        if (scope === 'vault') {
          exportFiles = flatFiles.filter((f) => /\.md$/i.test(f));
        } else if (scope === 'folder') {
          if (!selectedFolder) {
            useToastStore.getState().addToast(t('toast.selectFolder'), 'error');
            setExporting(false);
            return;
          }
          const folderPrefix = selectedFolder.replace(/\\/g, '/');
          exportFiles = flatFiles.filter((f) => {
            const normalized = f.replace(/\\/g, '/');
            return normalized.startsWith(folderPrefix + '/') && /\.md$/i.test(f);
          });
        } else {
          const tag = tagFilter.replace(/^#/, '').trim();
          if (!tag) {
            useToastStore.getState().addToast(t('toast.enterTag'), 'error');
            setExporting(false);
            return;
          }
          const tagFiles = tagIndex.get(tag);
          if (!tagFiles || tagFiles.size === 0) {
            useToastStore.getState().addToast(t('toast.noFilesForTag', { tag }), 'error');
            setExporting(false);
            return;
          }
          exportFiles = Array.from(tagFiles);
        }

        if (exportFiles.length === 0) {
          useToastStore.getState().addToast(t('toast.noFilesToExport'), 'error');
          setExporting(false);
          return;
        }

        const defaultName = scope === 'vault' ? 'vault-export' : scope === 'folder' ? selectedFolder : `tag-${tagFilter.replace(/^#/, '')}`;
        const savePath = await save({
          defaultPath: `${defaultName}.zip`,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        });
        if (!savePath) { setExporting(false); return; }

        abortRef.current = { aborted: false };
        setExportProgress({ current: 0, total: exportFiles.length });

        try {
          const count = await performBatchExport({
            vaultPath: vaultPath!,
            files: exportFiles,
            format: batchFormat,
            includeImages: batchFormat !== 'markdown' && includeImages,
            resolveWikiLinks: batchFormat !== 'markdown' && resolveWikiLinks,
            outputPath: savePath,
            onProgress: (current, total) => setExportProgress({ current, total }),
            abortSignal: abortRef.current,
          });
          if (!abortRef.current.aborted) {
            useToastStore.getState().addToast(t('toast.exportedFiles', { count }), 'success');
          }
        } finally {
          setExportProgress(null);
          setExporting(false);
          if (!abortRef.current.aborted) onClose();
        }
        return;
      }

      if (!activeFilePath) return;
      const ext = FORMAT_EXTENSIONS[format];
      const savePath = await save({
        defaultPath: `${fileName}.${ext}`,
        filters: [{ name: FORMAT_LABELS[format], extensions: [ext] }],
      });
      if (!savePath) { setExporting(false); return; }

      if (format === 'markdown') {
        await exportFile(vaultPath, savePath, content);
      } else if (format === 'html') {
        const bodyHtml = markdownToHtml(content);
        const fullHtml = buildHtmlDocument(fileName, bodyHtml);
        await exportFile(vaultPath, savePath, fullHtml);
      } else if (format === 'pdf') {
        const bodyHtml = markdownToHtml(content);
        const fullHtml = buildHtmlDocument(fileName, bodyHtml);
        // Open print dialog via hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;width:800px;height:600px;';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(fullHtml);
          doc.close();
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }
        setTimeout(() => document.body.removeChild(iframe), 1000);
      } else if (format === 'docx') {
        const blob = await markdownToDocx(content, fileName);
        const arrayBuf = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuf));
        await exportBinary(savePath, bytes);
      }

      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useToastStore.getState().addToast(t('toast.exportFailed', { message: msg }), 'error');
    } finally {
      setExporting(false);
    }
  }, [activeFilePath, vaultPath, content, fileName, onClose, format, scope, selectedFolder, flatFiles, tagIndex, batchFormat, includeImages, resolveWikiLinks, tagFilter]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogAriaLabel')}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 400,
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
        >
          <div className="flex items-center gap-2">
            <FileDown size={16} style={{ color: 'var(--ctp-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
              {scope === 'current' ? t('title.current') : scope === 'vault' ? t('title.vault') : scope === 'folder' ? t('title.folder') : t('title.tag')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-[var(--ctp-surface0)]"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {scope === 'current' ? (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.file')}</span>
              <span className="text-sm" style={{ color: 'var(--ctp-subtext0)' }}>
                {fileName}.md
              </span>
            </div>
          ) : null}

          {/* Export Scope */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.scope')}</span>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as 'current' | 'vault' | 'folder' | 'tag');
                if (e.target.value !== 'folder') setSelectedFolder('');
                if (e.target.value !== 'tag') setTagFilter('');
              }}
              className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                color: 'var(--ctp-subtext1)',
                border: '1px solid var(--ctp-surface1)',
              }}
            >
              <option value="current">{t('scope.current')}</option>
              <option value="vault">{t('scope.vault')}</option>
              <option value="folder">{t('scope.folder')}</option>
              <option value="tag">{t('scope.tag')}</option>
            </select>
          </div>

          {/* Folder selector - only shown when scope is 'folder' */}
          {scope === 'folder' && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.folder')}</span>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-subtext1)',
                  border: '1px solid var(--ctp-surface1)',
                }}
              >
                <option value="">{t('folder.selectPlaceholder')}</option>
                {folders.map((f: string) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {scope === 'tag' && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.tag')}</span>
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder={t('tag.placeholder')}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-subtext1)',
                  border: '1px solid var(--ctp-surface1)',
                  width: 160,
                }}
              />
            </div>
          )}

          {scope === 'current' ? (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.format')}</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-subtext1)',
                  border: '1px solid var(--ctp-surface1)',
                }}
              >
                <option value="html">{t('format.html')}</option>
                <option value="pdf">{t('format.pdf')}</option>
                <option value="markdown">{t('format.markdown')}</option>
                <option value="docx">{t('format.docx')}</option>
              </select>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.format')}</span>
                <select
                  value={batchFormat}
                  onChange={(e) => setBatchFormat(e.target.value as BatchFormat)}
                  className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--ctp-surface0)',
                    color: 'var(--ctp-subtext1)',
                    border: '1px solid var(--ctp-surface1)',
                  }}
                >
                  <option value="html-themed">{t('format.htmlThemed')}</option>
                  <option value="html-minimal">{t('format.htmlMinimal')}</option>
                  <option value="markdown">{t('format.markdown')}</option>
                </select>
              </div>

              {batchFormat !== 'markdown' && (
                <>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('options.includeImages')}</span>
                    <input
                      type="checkbox"
                      checked={includeImages}
                      onChange={(e) => setIncludeImages(e.target.checked)}
                      className="accent-[var(--ctp-accent)]"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('options.resolveWikiLinks')}</span>
                    <input
                      type="checkbox"
                      checked={resolveWikiLinks}
                      onChange={(e) => setResolveWikiLinks(e.target.checked)}
                      className="accent-[var(--ctp-accent)]"
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        {/* Progress bar */}
        {exportProgress && (
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                {t('progress.exporting', { current: exportProgress.current, total: exportProgress.total })}
              </span>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                {Math.round((exportProgress.current / exportProgress.total) * 100)}%
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 4, backgroundColor: 'var(--ctp-surface0)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                  backgroundColor: 'var(--ctp-accent)',
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          <button
            onClick={() => {
              if (exportProgress) {
                abortRef.current.aborted = true;
                setExportProgress(null);
                setExporting(false);
              } else {
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-subtext0)' }}
          >
            {exportProgress ? t('buttons.cancelExport') : t('common:cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={(scope === 'current' && !activeFilePath) || exporting}
            className="px-4 py-1.5 rounded-md text-xs transition-colors"
            style={{
              backgroundColor: (scope !== 'current' || activeFilePath) ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
              color: 'var(--ctp-base)',
              opacity: exporting ? 0.5 : 1,
            }}
          >
            {exporting ? t('buttons.exporting') : t('common:export')}
          </button>
        </div>
      </div>
    </div>
  );
}
