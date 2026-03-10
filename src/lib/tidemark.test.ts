import { describe, it, expect } from 'vitest';
import {
  extractFrontmatter,
  parseFrontmatter,
  buildVariableRegex,
  findVariables,
  replaceVariables,
  scanDocumentVariables,
  updateFrontmatter,
  TIDEMARK_DEFAULTS,
} from './tidemark';

// ── extractFrontmatter ────────────────────────────────────────

describe('extractFrontmatter', () => {
  it('returns null when document does not start with ---', () => {
    expect(extractFrontmatter('just text')).toBeNull();
  });

  it('returns null when closing --- is missing', () => {
    expect(extractFrontmatter('---\nkey: value\n')).toBeNull();
  });

  it('extracts raw frontmatter content', () => {
    const doc = '---\nkey: value\n---\nbody';
    const result = extractFrontmatter(doc);
    expect(result).not.toBeNull();
    expect(result!.raw).toContain('key: value');
  });

  it('bodyStart points past the closing ---', () => {
    const doc = '---\nkey: value\n---\nbody text';
    const result = extractFrontmatter(doc);
    expect(doc.slice(result!.bodyStart)).toBe('body text');
  });

  it('skips one newline after closing ---', () => {
    // doc has ---\nkey: val\n---\nbody — one newline after closing delimiter
    const doc = '---\nkey: val\n---\nbody';
    const result = extractFrontmatter(doc);
    // bodyStart should point to 'b' of 'body'
    expect(doc[result!.bodyStart]).toBe('b');
  });

  it('handles empty frontmatter', () => {
    const doc = '---\n\n---\nbody';
    const result = extractFrontmatter(doc);
    expect(result).not.toBeNull();
    expect(result!.raw.trim()).toBe('');
  });
});

// ── parseFrontmatter ──────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('parses simple key: value pairs', () => {
    const result = parseFrontmatter('title: Hello\nauthor: Alice');
    expect(result.title).toBe('Hello');
    expect(result.author).toBe('Alice');
  });

  it('strips surrounding quotes from values', () => {
    const result = parseFrontmatter('title: "Quoted"\nauthor: \'Single\'');
    expect(result.title).toBe('Quoted');
    expect(result.author).toBe('Single');
  });

  it('skips empty lines and comments', () => {
    const raw = '# comment\ntitle: Test\n\nauthor: Bob';
    const result = parseFrontmatter(raw);
    expect(result.title).toBe('Test');
    expect(result.author).toBe('Bob');
  });

  it('parses array values', () => {
    const raw = 'tags:\n- alpha\n- beta';
    const result = parseFrontmatter(raw);
    expect(result.tags).toEqual(['alpha', 'beta']);
  });

  it('handles values with colons in them', () => {
    const raw = 'url: https://example.com';
    const result = parseFrontmatter(raw);
    expect(result.url).toBe('https://example.com');
  });
});

// ── buildVariableRegex ────────────────────────────────────────

describe('buildVariableRegex', () => {
  it('matches variables with default delimiters <name>', () => {
    const re = buildVariableRegex(TIDEMARK_DEFAULTS);
    expect('<hello>'.match(re)).not.toBeNull();
  });

  it('matches variables with default value <name:default>', () => {
    const re = buildVariableRegex(TIDEMARK_DEFAULTS);
    expect('<name:Alice>'.match(re)).not.toBeNull();
  });

  it('does not match when delimiters are wrong', () => {
    const re = buildVariableRegex(TIDEMARK_DEFAULTS);
    expect('[hello]'.match(re)).toBeNull();
  });

  it('uses global flag by default (case-sensitive)', () => {
    const re = buildVariableRegex(TIDEMARK_DEFAULTS);
    expect(re.flags).toContain('g');
    expect(re.flags).not.toContain('i');
  });

  it('uses gi flags when caseInsensitive is true', () => {
    const re = buildVariableRegex({ ...TIDEMARK_DEFAULTS, caseInsensitive: true });
    expect(re.flags).toContain('i');
  });

  it('supports custom delimiters', () => {
    const opts = { ...TIDEMARK_DEFAULTS, openDelimiter: '{{', closeDelimiter: '}}' };
    const re = buildVariableRegex(opts);
    expect('{{name}}'.match(re)).not.toBeNull();
    expect('<name>'.match(re)).toBeNull();
  });
});

// ── findVariables ─────────────────────────────────────────────

describe('findVariables', () => {
  const fm = { name: 'Alice', city: 'Paris' };

  it('finds a variable that exists in frontmatter', () => {
    const matches = findVariables('<name>', 0, fm, TIDEMARK_DEFAULTS);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('name');
    expect(matches[0].status).toBe('exists');
    expect(matches[0].resolvedValue).toBe('Alice');
  });

  it('finds multiple variables', () => {
    const matches = findVariables('<name> lives in <city>', 0, fm, TIDEMARK_DEFAULTS);
    expect(matches).toHaveLength(2);
  });

  it('marks missing variable with status missing', () => {
    const matches = findVariables('<unknown>', 0, fm, TIDEMARK_DEFAULTS);
    expect(matches[0].status).toBe('missing');
    expect(matches[0].resolvedValue).toBe(TIDEMARK_DEFAULTS.missingValueText);
  });

  it('uses default value when variable is missing', () => {
    const matches = findVariables('<unknown:fallback>', 0, fm, TIDEMARK_DEFAULTS);
    expect(matches[0].status).toBe('has-default');
    expect(matches[0].resolvedValue).toBe('fallback');
  });

  it('applies offset to from/to positions', () => {
    const matches = findVariables('<name>', 100, fm, TIDEMARK_DEFAULTS);
    expect(matches[0].from).toBe(100);
    expect(matches[0].to).toBe(106);
  });

  it('joins array values with arrayJoinSeparator', () => {
    const fmWithArray = { tags: ['a', 'b', 'c'] };
    const matches = findVariables('<tags>', 0, fmWithArray, TIDEMARK_DEFAULTS);
    expect(matches[0].resolvedValue).toBe('a, b, c');
  });

  it('preserves variable on missing when preserveOnMissing is true', () => {
    const opts = { ...TIDEMARK_DEFAULTS, preserveOnMissing: true };
    const matches = findVariables('<ghost>', 0, {}, opts);
    expect(matches[0].resolvedValue).toBe('<ghost>');
  });
});

// ── replaceVariables ──────────────────────────────────────────

describe('replaceVariables', () => {
  it('replaces a known variable', () => {
    const result = replaceVariables('Hello <name>!', { name: 'Bob' }, TIDEMARK_DEFAULTS);
    expect(result).toBe('Hello Bob!');
  });

  it('replaces multiple variables', () => {
    const result = replaceVariables('<greeting>, <name>!', { greeting: 'Hi', name: 'Eve' }, TIDEMARK_DEFAULTS);
    expect(result).toBe('Hi, Eve!');
  });

  it('uses default value for missing variable', () => {
    const result = replaceVariables('<color:blue>', {}, TIDEMARK_DEFAULTS);
    expect(result).toBe('blue');
  });

  it('uses missingValueText for unknown variable', () => {
    const result = replaceVariables('<ghost>', {}, TIDEMARK_DEFAULTS);
    expect(result).toBe(TIDEMARK_DEFAULTS.missingValueText);
  });

  it('preserves variable when preserveOnMissing is true', () => {
    const opts = { ...TIDEMARK_DEFAULTS, preserveOnMissing: true };
    const result = replaceVariables('<ghost>', {}, opts);
    expect(result).toBe('<ghost>');
  });

  it('joins array values', () => {
    const result = replaceVariables('<tags>', { tags: ['x', 'y'] }, TIDEMARK_DEFAULTS);
    expect(result).toBe('x, y');
  });

  it('does case-insensitive lookup when caseInsensitive is true', () => {
    const opts = { ...TIDEMARK_DEFAULTS, caseInsensitive: true };
    const result = replaceVariables('<NAME>', { name: 'Alice' }, opts);
    expect(result).toBe('Alice');
  });
});

// ── scanDocumentVariables ─────────────────────────────────────

describe('scanDocumentVariables', () => {
  it('deduplicates repeated variable references', () => {
    const text = '<name> and <name> again';
    const result = scanDocumentVariables(text, { name: 'Alice' }, TIDEMARK_DEFAULTS);
    expect(result).toHaveLength(1);
  });

  it('sorts: missing first, has-default second, exists last', () => {
    const text = '<exists> <unknown> <withDefault:val>';
    const fm = { exists: 'yes' };
    const result = scanDocumentVariables(text, fm, TIDEMARK_DEFAULTS);
    expect(result[0].status).toBe('missing');
    expect(result[1].status).toBe('has-default');
    expect(result[2].status).toBe('exists');
  });
});

// ── updateFrontmatter ─────────────────────────────────────────

describe('updateFrontmatter', () => {
  it('creates frontmatter when document has none', () => {
    const result = updateFrontmatter('body text', 'key', 'value');
    expect(result).toMatch(/^---\n/);
    expect(result).toContain('key: value');
    expect(result).toContain('body text');
  });

  it('updates an existing key in frontmatter', () => {
    const doc = '---\ntitle: Old\n---\nbody';
    const result = updateFrontmatter(doc, 'title', 'New');
    expect(result).toContain('title: New');
    expect(result).not.toContain('title: Old');
  });

  it('appends a new key to existing frontmatter', () => {
    const doc = '---\ntitle: Test\n---\nbody';
    const result = updateFrontmatter(doc, 'author', 'Alice');
    expect(result).toContain('title: Test');
    expect(result).toContain('author: Alice');
    expect(result).toContain('body');
  });

  it('handles nested key creation when parent missing', () => {
    const doc = '---\ntitle: Test\n---\nbody';
    const result = updateFrontmatter(doc, 'meta.version', '1.0');
    expect(result).toContain('meta:');
    expect(result).toContain('version: 1.0');
  });

  it('updates existing nested key', () => {
    const doc = '---\nmeta:\n  version: 1.0\n---\nbody';
    const result = updateFrontmatter(doc, 'meta.version', '2.0');
    expect(result).toContain('version: 2.0');
    expect(result).not.toContain('version: 1.0');
  });

  it('preserves body content after update', () => {
    const doc = '---\ntitle: Hello\n---\nmy body content';
    const result = updateFrontmatter(doc, 'title', 'World');
    expect(result).toContain('my body content');
  });
});
