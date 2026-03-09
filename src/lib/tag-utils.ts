// Matches #tag patterns — must start with a letter after #, can contain letters, numbers, underscores, hyphens, slashes
const TAG_RE = /(?:^|(?<=\s))#([a-zA-Z][\w-/]*)/g;

// Matches YAML frontmatter block
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Extract YAML frontmatter tags (from tags/categories/keywords lists). */
function extractFrontmatterTags(text: string): string[] {
  const fm = FRONTMATTER_RE.exec(text);
  if (!fm) return [];
  const yaml = fm[1];
  const tags: string[] = [];

  // Match "tags: [a, b, c]" inline format
  const inlineMatch = yaml.match(/^(?:tags|categories|keywords)\s*:\s*\[([^\]]*)\]/m);
  if (inlineMatch) {
    for (const item of inlineMatch[1].split(',')) {
      const t = item.trim().replace(/^['"]|['"]$/g, '');
      if (t) tags.push(t.toLowerCase());
    }
  }

  // Match "tags:\n  - a\n  - b" list format
  const listMatch = yaml.match(/^(tags|categories|keywords)\s*:\s*\r?\n((?:\s+-\s+.+\r?\n?)*)/m);
  if (listMatch) {
    const lines = listMatch[2].split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s+-\s+(.+)/);
      if (m) {
        const t = m[1].trim().replace(/^['"]|['"]$/g, '');
        if (t) tags.push(t.toLowerCase());
      }
    }
  }

  return tags;
}

/** Extract all unique tags from a document string. Returns tags without the # prefix. */
export function extractTags(text: string): string[] {
  const tags = new Set<string>();

  // Inline #tag patterns (skip frontmatter section)
  const body = text.replace(FRONTMATTER_RE, '');
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(body)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  // YAML frontmatter tags
  for (const tag of extractFrontmatterTags(text)) {
    tags.add(tag);
  }

  return [...tags];
}

/** The regex for matching tags in CM6 visible ranges. */
export const TAG_PATTERN = /(?:^|(?<=\s))#([a-zA-Z][\w-/]*)/g;
