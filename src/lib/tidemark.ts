/**
 * Tidemark — Dynamic variable replacement engine.
 *
 * Parses YAML frontmatter and resolves variable references in document body.
 * Default syntax: <Variable> (configurable delimiters).
 */

export interface TidemarkOptions {
  openDelimiter: string;
  closeDelimiter: string;
  defaultSeparator: string;
  missingValueText: string;
  supportNesting: boolean;
  caseInsensitive: boolean;
  arrayJoinSeparator: string;
  preserveOnMissing: boolean;
}

export const TIDEMARK_DEFAULTS: TidemarkOptions = {
  openDelimiter: '<',
  closeDelimiter: '>',
  defaultSeparator: ':',
  missingValueText: '[MISSING]',
  supportNesting: true,
  caseInsensitive: false,
  arrayJoinSeparator: ', ',
  preserveOnMissing: false,
};

export interface VariableMatch {
  /** Full match including delimiters */
  full: string;
  /** Variable name (without delimiters or default value) */
  name: string;
  /** Default value if specified (after separator) */
  defaultValue: string | null;
  /** Start offset in the document body (after frontmatter) */
  from: number;
  /** End offset */
  to: number;
  /** Resolution status */
  status: 'exists' | 'has-default' | 'missing';
  /** Resolved value (or missing text) */
  resolvedValue: string;
}

// ── Frontmatter Parsing ──────────────────────────────────────

/** Extract raw frontmatter string and its end position from a document. */
export function extractFrontmatter(doc: string): { raw: string; bodyStart: number } | null {
  if (!doc.startsWith('---')) return null;
  const endIdx = doc.indexOf('\n---', 3);
  if (endIdx === -1) return null;
  const raw = doc.slice(4, endIdx); // skip opening ---\n
  const bodyStart = endIdx + 4; // skip \n---
  // Skip optional newline after closing ---
  return { raw, bodyStart: bodyStart < doc.length && doc[bodyStart] === '\n' ? bodyStart + 1 : bodyStart };
}

/**
 * Parse simple YAML frontmatter into a flat key-value map.
 * Supports:
 *   - key: value
 *   - nested objects (key.subkey via indentation)
 *   - simple arrays (- item)
 */
export function parseFrontmatter(raw: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = raw.split('\n');
  let currentKey = '';
  let currentIndent = 0;
  const keyStack: string[] = [];

  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      if (currentKey) {
        const fullKey = [...keyStack, currentKey].join('.');
        const existing = result[fullKey];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[fullKey] = [value];
        }
      }
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    // Adjust key stack based on indentation
    while (keyStack.length > 0 && indent <= currentIndent - 2) {
      keyStack.pop();
      currentIndent -= 2;
    }

    if (value === '' || value === '|' || value === '>') {
      // This is a parent key for nested values
      if (indent > currentIndent && currentKey) {
        keyStack.push(currentKey);
      }
      currentKey = key;
      currentIndent = indent;
      continue;
    }

    // Strip quotes from values
    const cleanValue = value.replace(/^["']|["']$/g, '');

    if (indent > 0 && keyStack.length > 0) {
      const fullKey = [...keyStack, key].join('.');
      result[fullKey] = cleanValue;
    } else {
      // Reset stack for top-level keys
      keyStack.length = 0;
      currentIndent = 0;
    }

    currentKey = key;
    currentIndent = indent;
    const fullKey = keyStack.length > 0 ? [...keyStack, key].join('.') : key;
    result[fullKey] = cleanValue;
  }

  return result;
}

// ── Variable Detection & Resolution ──────────────────────────

/** Build a regex to find variables with the given delimiters. */
export function buildVariableRegex(opts: TidemarkOptions): RegExp {
  const open = escapeRegex(opts.openDelimiter);
  const close = escapeRegex(opts.closeDelimiter);
  // Match: <open>name<close> or <open>name:default<close>
  // Variable names: word chars, dots (nesting), brackets (arrays)
  const flags = opts.caseInsensitive ? 'gi' : 'g';
  return new RegExp(`${open}([\\w.\\[\\]]+(?:${escapeRegex(opts.defaultSeparator)}[^${close}]*)?)${close}`, flags);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find all variable references in a text string. */
export function findVariables(
  text: string,
  offset: number,
  frontmatter: Record<string, string | string[]>,
  opts: TidemarkOptions,
): VariableMatch[] {
  const re = buildVariableRegex(opts);
  re.lastIndex = 0;
  const matches: VariableMatch[] = [];
  let m: RegExpExecArray | null;

  const deadline = performance.now() + 50;
  while ((m = re.exec(text)) !== null) {
    if (performance.now() > deadline) break;

    const inner = m[1];
    const sepIdx = inner.indexOf(opts.defaultSeparator);
    let name: string;
    let defaultValue: string | null = null;

    if (sepIdx !== -1) {
      name = inner.slice(0, sepIdx);
      defaultValue = inner.slice(sepIdx + opts.defaultSeparator.length);
    } else {
      name = inner;
    }

    const lookupKey = opts.caseInsensitive ? name.toLowerCase() : name;
    const fmValue = resolveValue(lookupKey, frontmatter, opts);

    let status: VariableMatch['status'];
    let resolvedValue: string;

    if (fmValue !== undefined) {
      status = 'exists';
      resolvedValue = Array.isArray(fmValue) ? fmValue.join(opts.arrayJoinSeparator) : fmValue;
    } else if (defaultValue !== null) {
      status = 'has-default';
      resolvedValue = defaultValue;
    } else {
      status = 'missing';
      resolvedValue = opts.preserveOnMissing ? m[0] : opts.missingValueText;
    }

    matches.push({
      full: m[0],
      name,
      defaultValue,
      from: offset + m.index,
      to: offset + m.index + m[0].length,
      status,
      resolvedValue,
    });
  }

  return matches;
}

/** Resolve a variable name against frontmatter, supporting dot notation. */
function resolveValue(
  name: string,
  frontmatter: Record<string, string | string[]>,
  opts: TidemarkOptions,
): string | string[] | undefined {
  // Direct lookup first
  if (opts.caseInsensitive) {
    const lower = name.toLowerCase();
    for (const key of Object.keys(frontmatter)) {
      if (key.toLowerCase() === lower) return frontmatter[key];
    }
  } else {
    if (name in frontmatter) return frontmatter[name];
  }

  // Try nested lookup with dot notation
  if (opts.supportNesting && name.includes('.')) {
    if (opts.caseInsensitive) {
      const lower = name.toLowerCase();
      for (const key of Object.keys(frontmatter)) {
        if (key.toLowerCase() === lower) return frontmatter[key];
      }
    }
  }

  return undefined;
}

/** Detect which variable (if any) is at a given character offset in body text. */
export function getVariableAtPosition(
  bodyText: string,
  offset: number,
  frontmatter: Record<string, string | string[]>,
  opts: TidemarkOptions,
): VariableMatch | null {
  const matches = findVariables(bodyText, 0, frontmatter, opts);
  for (const m of matches) {
    if (offset >= m.from && offset <= m.to) return m;
  }
  return null;
}

/** Scan all unique variables in a document body and return them grouped by status. */
export function scanDocumentVariables(
  bodyText: string,
  frontmatter: Record<string, string | string[]>,
  opts: TidemarkOptions,
): VariableMatch[] {
  const all = findVariables(bodyText, 0, frontmatter, opts);
  // Deduplicate by variable name, keeping first occurrence
  const seen = new Set<string>();
  const unique: VariableMatch[] = [];
  for (const m of all) {
    const key = opts.caseInsensitive ? m.name.toLowerCase() : m.name;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }
  // Sort: missing first, then has-default, then exists
  const order: Record<string, number> = { missing: 0, 'has-default': 1, exists: 2 };
  unique.sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0));
  return unique;
}

/**
 * Update or insert a key in YAML frontmatter.
 * Returns the new full document string.
 */
export function updateFrontmatter(doc: string, key: string, value: string): string {
  const fm = extractFrontmatter(doc);
  if (!fm) {
    // No frontmatter — create one
    return `---\n${key}: ${value}\n---\n${doc}`;
  }

  const lines = fm.raw.split('\n');
  let found = false;

  // Handle nested keys (e.g. "target.ip")
  const parts = key.split('.');
  if (parts.length === 1) {
    // Simple key — find and replace or append
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*)([\w.-]+)\s*:/);
      if (match && match[2] === key) {
        lines[i] = `${match[1]}${key}: ${value}`;
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}: ${value}`);
    }
  } else {
    // Nested key — find parent, then child
    const parent = parts[0];
    const child = parts.slice(1).join('.');
    let parentIdx = -1;
    let parentIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*)([\w.-]+)\s*:/);
      if (match && match[2] === parent) {
        parentIdx = i;
        parentIndent = match[1].length;
        break;
      }
    }

    if (parentIdx === -1) {
      // Parent doesn't exist — add both
      lines.push(`${parent}:`);
      lines.push(`  ${child}: ${value}`);
    } else {
      // Look for child under parent
      const childIndent = parentIndent + 2;
      let childFound = false;
      for (let i = parentIdx + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const lineIndent = lines[i].length - lines[i].trimStart().length;
        if (lineIndent <= parentIndent && trimmed !== '') break;
        const match = lines[i].match(/^(\s*)([\w.-]+)\s*:/);
        if (match && match[2] === child && match[1].length === childIndent) {
          lines[i] = `${' '.repeat(childIndent)}${child}: ${value}`;
          childFound = true;
          break;
        }
      }
      if (!childFound) {
        lines.splice(parentIdx + 1, 0, `${' '.repeat(childIndent)}${child}: ${value}`);
      }
    }
    found = true;
  }

  const newFm = lines.join('\n');
  // bodyStart points to where body begins (after closing --- and optional newline)
  // The closing delimiter is "\n---" which ends just before bodyStart
  // We want to preserve everything from the closing --- onward
  const closingStart = 4 + fm.raw.length; // index of "\n---"
  return `---\n${newFm}${doc.slice(closingStart)}`;
}

/** Replace all variables in text with their resolved values. */
export function replaceVariables(
  text: string,
  frontmatter: Record<string, string | string[]>,
  opts: TidemarkOptions,
): string {
  const re = buildVariableRegex(opts);
  re.lastIndex = 0;

  return text.replace(re, (match, inner: string) => {
    const sepIdx = inner.indexOf(opts.defaultSeparator);
    let name: string;
    let defaultValue: string | null = null;

    if (sepIdx !== -1) {
      name = inner.slice(0, sepIdx);
      defaultValue = inner.slice(sepIdx + opts.defaultSeparator.length);
    } else {
      name = inner;
    }

    const lookupKey = opts.caseInsensitive ? name.toLowerCase() : name;
    const fmValue = resolveValue(lookupKey, frontmatter, opts);

    if (fmValue !== undefined) {
      return Array.isArray(fmValue) ? fmValue.join(opts.arrayJoinSeparator) : fmValue;
    }
    if (defaultValue !== null) return defaultValue;
    return opts.preserveOnMissing ? match : opts.missingValueText;
  });
}
