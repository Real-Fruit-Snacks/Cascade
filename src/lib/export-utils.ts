import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, LevelFormat, convertInchesToTwip } from 'docx';
import { zipSync, strToU8 } from 'fflate';
import { exportBinary, readFile, readFileBinary } from './tauri-commands';
import { useSettingsStore } from '../stores/settings-store';
import { flavors, isDarkTheme, isBuiltinFlavor, getCustomTheme } from '../styles/catppuccin-flavors';

export interface RenderOptions {
  /** Map of wiki-link target (lowercase, no ext) → relative HTML path for resolution */
  wikiLinkMap?: Map<string, string>;
  /** Map to collect image paths into. Key = original src, Value = filename */
  imageCollector?: Map<string, string>;
  /** Prefix for rewritten image paths (e.g., "../assets/") */
  imagePrefix?: string;
}

export function markdownToHtml(md: string, options: RenderOptions = {}): string {
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
    result = result.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');
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

export function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildHtmlDocument(title: string, bodyHtml: string, style: 'themed' | 'minimal' = 'themed'): string {
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

export function parseInlineFormatting(text: string): TextRun[] {
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

export async function markdownToDocx(md: string, title: string): Promise<Blob> {
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

export type BatchFormat = 'html-themed' | 'html-minimal' | 'markdown';

export interface BatchExportOptions {
  vaultPath: string;
  files: string[];
  format: BatchFormat;
  includeImages: boolean;
  resolveWikiLinks: boolean;
  outputPath: string;
  onProgress: (current: number, total: number) => void;
  abortSignal?: { aborted: boolean };
}

export function buildWikiLinkMap(files: string[], ext: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    const key = normalized.replace(/\.md$/i, '').toLowerCase();
    const outPath = normalized.replace(/\.md$/i, '.' + ext);
    map.set(key, outPath);
  }
  return map;
}

export function deduplicateFilename(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  while (existing.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

export async function performBatchExport(opts: BatchExportOptions): Promise<number> {
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
