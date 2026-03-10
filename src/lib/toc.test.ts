import { describe, it, expect } from 'vitest';
import { extractHeadings, generateToc, findTocRange, updateTocInDoc } from './toc';

describe('extractHeadings', () => {
  it('extracts a single h1', () => {
    const headings = extractHeadings('# Hello');
    expect(headings).toEqual([{ level: 1, text: 'Hello', slug: 'hello' }]);
  });

  it('extracts multiple headings of different levels', () => {
    const doc = '# H1\n## H2\n### H3';
    const headings = extractHeadings(doc);
    expect(headings).toHaveLength(3);
    expect(headings[0].level).toBe(1);
    expect(headings[1].level).toBe(2);
    expect(headings[2].level).toBe(3);
  });

  it('returns empty array for document with no headings', () => {
    expect(extractHeadings('Just some text\nNo headings here')).toEqual([]);
  });

  it('ignores headings inside code blocks', () => {
    const doc = '```\n# Not a heading\n```\n# Real heading';
    const headings = extractHeadings(doc);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Real heading');
  });

  it('handles nested code blocks toggling correctly', () => {
    const doc = '```\n# inside\n```\n## after\n```\n# inside2\n```';
    const headings = extractHeadings(doc);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('after');
  });

  it('slugifies heading text', () => {
    const headings = extractHeadings('## Hello World!');
    expect(headings[0].slug).toBe('hello-world');
  });

  it('slugifies with special characters stripped', () => {
    const headings = extractHeadings('## C++ & Rust');
    expect(headings[0].slug).toBe('c-rust');
  });

  it('collapses multiple spaces/hyphens in slug', () => {
    const headings = extractHeadings('## Hello   World');
    expect(headings[0].slug).toBe('hello-world');
  });

  it('handles all 6 heading levels', () => {
    const doc = ['# h1', '## h2', '### h3', '#### h4', '##### h5', '###### h6'].join('\n');
    const headings = extractHeadings(doc);
    expect(headings.map(h => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('does not match headings missing a space after #', () => {
    const headings = extractHeadings('#NoSpace');
    expect(headings).toEqual([]);
  });

  it('trims trailing whitespace from heading text', () => {
    const headings = extractHeadings('# Hello   ');
    expect(headings[0].text).toBe('Hello');
  });
});

describe('generateToc', () => {
  it('returns empty string for document with no headings', () => {
    expect(generateToc('no headings here')).toBe('');
  });

  it('wraps output in toc markers', () => {
    const toc = generateToc('# Hello');
    expect(toc).toMatch(/^<!-- toc -->/);
    expect(toc).toMatch(/<!-- \/toc -->$/);
  });

  it('generates correct link for a single heading', () => {
    const toc = generateToc('# Hello World');
    expect(toc).toContain('- [Hello World](#hello-world)');
  });

  it('indents nested headings relative to minimum level', () => {
    const doc = '## H2\n### H3';
    const toc = generateToc(doc);
    const lines = toc.split('\n').filter(l => l.startsWith('-') || l.startsWith(' '));
    // H2 is min level → no indent; H3 → 2 spaces
    expect(toc).toContain('- [H2](#h2)');
    expect(toc).toContain('  - [H3](#h3)');
  });

  it('uses minimum heading level as zero indent', () => {
    const doc = '### A\n#### B';
    const toc = generateToc(doc);
    expect(toc).toContain('- [A](#a)');
    expect(toc).toContain('  - [B](#b)');
  });

  it('handles multiple h1s without extra indentation', () => {
    const doc = '# One\n# Two\n# Three';
    const toc = generateToc(doc);
    const listLines = toc.split('\n').filter(l => l.includes('- ['));
    expect(listLines).toHaveLength(3);
    listLines.forEach(l => expect(l).toMatch(/^- \[/));
  });
});

describe('findTocRange', () => {
  it('returns null when no TOC markers exist', () => {
    expect(findTocRange('just text')).toBeNull();
  });

  it('returns null when start marker exists but no end marker', () => {
    expect(findTocRange('<!-- toc -->\nsome text')).toBeNull();
  });

  it('finds range when both markers exist', () => {
    const doc = 'before\n<!-- toc -->\n- item\n<!-- /toc -->\nafter';
    const range = findTocRange(doc);
    expect(range).not.toBeNull();
    expect(doc.slice(range!.from, range!.to)).toBe('<!-- toc -->\n- item\n<!-- /toc -->');
  });

  it('from points to start of <!-- toc --> marker', () => {
    const doc = '<!-- toc -->\n- x\n<!-- /toc -->';
    const range = findTocRange(doc);
    expect(range!.from).toBe(0);
  });

  it('to points to end of <!-- /toc --> marker', () => {
    const doc = '<!-- toc -->\n<!-- /toc -->';
    const range = findTocRange(doc);
    expect(range!.to).toBe(doc.length);
  });
});

describe('updateTocInDoc', () => {
  it('returns null when no TOC exists in document', () => {
    expect(updateTocInDoc('# Hello\nsome text')).toBeNull();
  });

  it('returns replacement info when TOC exists', () => {
    const doc = '# Heading\n<!-- toc -->\n- old\n<!-- /toc -->\ntext';
    const result = updateTocInDoc(doc);
    expect(result).not.toBeNull();
    expect(result!.insert).toContain('<!-- toc -->');
    expect(result!.insert).toContain('<!-- /toc -->');
    expect(result!.insert).toContain('[Heading](#heading)');
  });

  it('from and to span the old TOC block', () => {
    const doc = '# H\n<!-- toc -->\n- old\n<!-- /toc -->';
    const result = updateTocInDoc(doc);
    const original = doc.slice(result!.from, result!.to);
    expect(original).toBe('<!-- toc -->\n- old\n<!-- /toc -->');
  });
});
