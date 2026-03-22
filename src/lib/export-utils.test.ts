import { describe, it, expect } from 'vitest';
import { escapeHtmlAttr, buildWikiLinkMap, deduplicateFilename, markdownToHtml } from './export-utils';

// ---------------------------------------------------------------------------
// escapeHtmlAttr
// ---------------------------------------------------------------------------

describe('escapeHtmlAttr', () => {
  it('passes plain text through unchanged', () => {
    expect(escapeHtmlAttr('hello world')).toBe('hello world');
  });

  it('escapes ampersand', () => {
    expect(escapeHtmlAttr('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtmlAttr('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtmlAttr('a > b')).toBe('a &gt; b');
  });

  it('escapes double quote', () => {
    expect(escapeHtmlAttr('"value"')).toBe('&quot;value&quot;');
  });

  it("escapes single quote", () => {
    expect(escapeHtmlAttr("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters together', () => {
    expect(escapeHtmlAttr('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtmlAttr('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildWikiLinkMap
// ---------------------------------------------------------------------------

describe('buildWikiLinkMap', () => {
  it('maps .md files to .html paths', () => {
    const map = buildWikiLinkMap(['notes/intro.md', 'notes/overview.md'], 'html');
    expect(map.get('notes/intro')).toBe('notes/intro.html');
    expect(map.get('notes/overview')).toBe('notes/overview.html');
  });

  it('converts backslashes in Windows paths to forward slashes', () => {
    const map = buildWikiLinkMap(['folder\\sub\\note.md'], 'html');
    expect(map.get('folder/sub/note')).toBe('folder/sub/note.html');
  });

  it('stores keys in lowercase', () => {
    const map = buildWikiLinkMap(['Notes/MyNote.md'], 'html');
    expect(map.get('notes/mynote')).toBe('Notes/MyNote.html');
    expect(map.has('Notes/MyNote')).toBe(false);
  });

  it('uses the supplied extension instead of html', () => {
    const map = buildWikiLinkMap(['doc.md'], 'txt');
    expect(map.get('doc')).toBe('doc.txt');
  });

  it('handles a flat file list with no subdirectories', () => {
    const map = buildWikiLinkMap(['alpha.md', 'beta.md'], 'html');
    expect(map.size).toBe(2);
    expect(map.get('alpha')).toBe('alpha.html');
    expect(map.get('beta')).toBe('beta.html');
  });

  it('returns an empty map for an empty file list', () => {
    expect(buildWikiLinkMap([], 'html').size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deduplicateFilename
// ---------------------------------------------------------------------------

describe('deduplicateFilename', () => {
  it('returns the name unchanged when it is not in the existing set', () => {
    expect(deduplicateFilename('image.png', new Set())).toBe('image.png');
  });

  it('appends -1 when the name already exists', () => {
    expect(deduplicateFilename('image.png', new Set(['image.png']))).toBe('image-1.png');
  });

  it('appends -2 when both the name and the -1 variant exist', () => {
    expect(deduplicateFilename('image.png', new Set(['image.png', 'image-1.png']))).toBe('image-2.png');
  });

  it('appends -3 when -1 and -2 variants are also taken', () => {
    const existing = new Set(['image.png', 'image-1.png', 'image-2.png']);
    expect(deduplicateFilename('image.png', existing)).toBe('image-3.png');
  });

  it('works with a name that has no extension', () => {
    expect(deduplicateFilename('readme', new Set(['readme']))).toBe('readme-1');
  });

  it('preserves the full extension (not just the last dot segment)', () => {
    expect(deduplicateFilename('archive.tar.gz', new Set(['archive.tar.gz']))).toBe('archive.tar-1.gz');
  });
});

// ---------------------------------------------------------------------------
// markdownToHtml
// ---------------------------------------------------------------------------

describe('markdownToHtml', () => {
  it('converts h1 through h6 headings', () => {
    for (let i = 1; i <= 6; i++) {
      const hashes = '#'.repeat(i);
      const result = markdownToHtml(`${hashes} Heading ${i}`);
      expect(result).toContain(`<h${i}>`);
      expect(result).toContain(`Heading ${i}`);
      expect(result).toContain(`</h${i}>`);
    }
  });

  it('converts **bold** to <strong>', () => {
    const result = markdownToHtml('This is **bold** text.');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('converts __bold__ to <strong>', () => {
    const result = markdownToHtml('This is __bold__ text.');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('converts *italic* to <em>', () => {
    const result = markdownToHtml('This is *italic* text.');
    expect(result).toContain('<em>italic</em>');
  });

  it('converts _italic_ to <em>', () => {
    const result = markdownToHtml('This is _italic_ text.');
    expect(result).toContain('<em>italic</em>');
  });

  it('wraps fenced code blocks in <pre><code>', () => {
    const md = '```\nconst x = 1;\n```';
    const result = markdownToHtml(md);
    expect(result).toContain('<pre><code>');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('</code></pre>');
  });

  it('converts unordered lists', () => {
    const md = '- item one\n- item two';
    const result = markdownToHtml(md);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('item one');
    expect(result).toContain('item two');
    expect(result).toContain('</ul>');
  });

  it('converts ordered lists', () => {
    const md = '1. first\n2. second';
    const result = markdownToHtml(md);
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>');
    expect(result).toContain('first');
    expect(result).toContain('second');
    expect(result).toContain('</ol>');
  });

  it('converts [text](url) links with safe http/https URLs', () => {
    const result = markdownToHtml('[Click here](https://example.com)');
    expect(result).toContain('<a href="https://example.com">Click here</a>');
  });

  it('replaces unsafe URL schemes with #', () => {
    const result = markdownToHtml('[bad](javascript:alert(1))');
    expect(result).toContain('href="#"');
  });

  it('converts blockquotes', () => {
    const result = markdownToHtml('> This is a quote');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('This is a quote');
    expect(result).toContain('</blockquote>');
  });

  it('converts --- to <hr>', () => {
    const result = markdownToHtml('---');
    expect(result).toContain('<hr>');
  });

  it('converts ___ to <hr>', () => {
    const result = markdownToHtml('___');
    expect(result).toContain('<hr>');
  });

  it('converts *** to <hr>', () => {
    const result = markdownToHtml('***');
    expect(result).toContain('<hr>');
  });

  it('strips YAML frontmatter', () => {
    const md = '---\ntitle: My Note\ndate: 2024-01-01\n---\n\n# Actual Content';
    const result = markdownToHtml(md);
    expect(result).not.toContain('title: My Note');
    expect(result).not.toContain('date: 2024-01-01');
    expect(result).toContain('<h1>');
    expect(result).toContain('Actual Content');
  });

  it('does not strip a leading --- that has no closing ---', () => {
    const md = '---\nno closing fence\nsome text';
    const result = markdownToHtml(md);
    // The incomplete frontmatter is left as-is and rendered as paragraphs
    expect(result).toContain('no closing fence');
  });

  it('renders wiki links without a map as a <span class="wiki-link">', () => {
    const result = markdownToHtml('See [[My Note]] for details.');
    expect(result).toContain('<span class="wiki-link">My Note</span>');
  });

  it('renders wiki links with an alias using the alias text', () => {
    const result = markdownToHtml('See [[my-note|My Note Alias]] here.');
    expect(result).toContain('My Note Alias');
    expect(result).not.toContain('my-note');
  });

  it('resolves wiki links to hrefs when a wikiLinkMap is provided', () => {
    // The key is derived from the target text lowercased (spaces preserved)
    const wikiLinkMap = new Map([['my note', 'my-note.html']]);
    const result = markdownToHtml('See [[My Note]] for details.', { wikiLinkMap });
    expect(result).toContain('<a href="my-note.html" class="wiki-link">My Note</a>');
  });

  it('resolves wiki links case-insensitively against the map', () => {
    const wikiLinkMap = new Map([['my note', 'my-note.html']]);
    const result = markdownToHtml('[[MY NOTE]]', { wikiLinkMap });
    expect(result).toContain('href="my-note.html"');
  });

  it('falls back to <span> when wiki link target is not in the map', () => {
    const wikiLinkMap = new Map([['other', 'other.html']]);
    const result = markdownToHtml('[[Unknown Note]]', { wikiLinkMap });
    expect(result).toContain('<span class="wiki-link">Unknown Note</span>');
  });

  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
  });

  it('escapes HTML special characters in plain paragraphs', () => {
    const result = markdownToHtml('a < b & c > d');
    expect(result).toContain('&lt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&gt;');
  });
});
