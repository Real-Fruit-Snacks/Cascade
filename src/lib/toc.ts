/** Generate a markdown Table of Contents from the document headings. */

interface Heading {
  level: number;
  text: string;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractHeadings(doc: string): Heading[] {
  const headings: Heading[] = [];
  const lines = doc.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        slug: slugify(match[2].trim()),
      });
    }
  }

  return headings;
}

export function generateToc(doc: string): string {
  const headings = extractHeadings(doc);
  if (headings.length === 0) return '';

  const minLevel = Math.min(...headings.map((h) => h.level));

  const lines = headings.map((h) => {
    const indent = '  '.repeat(h.level - minLevel);
    return `${indent}- [${h.text}](#${h.slug})`;
  });

  return `<!-- toc -->\n${lines.join('\n')}\n<!-- /toc -->`;
}

/** Find existing TOC markers and return their positions, or null if not found. */
export function findTocRange(doc: string): { from: number; to: number } | null {
  const startMarker = '<!-- toc -->';
  const endMarker = '<!-- /toc -->';

  const startIdx = doc.indexOf(startMarker);
  if (startIdx === -1) return null;

  const endIdx = doc.indexOf(endMarker, startIdx);
  if (endIdx === -1) return null;

  return { from: startIdx, to: endIdx + endMarker.length };
}

/** Update an existing TOC in the document, or return null if no TOC exists. */
export function updateTocInDoc(doc: string): { from: number; to: number; insert: string } | null {
  const range = findTocRange(doc);
  if (!range) return null;

  const newToc = generateToc(doc);
  return { from: range.from, to: range.to, insert: newToc };
}
