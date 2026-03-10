import { describe, it, expect } from 'vitest';
import { extractTags } from './tag-utils';

describe('extractTags', () => {
  it('extracts inline #tags from body text', () => {
    const tags = extractTags('Some text #hello and #world');
    expect(tags).toContain('hello');
    expect(tags).toContain('world');
  });

  it('returns tags lowercased', () => {
    const tags = extractTags('#MyTag');
    expect(tags).toContain('mytag');
  });

  it('deduplicates repeated tags', () => {
    const tags = extractTags('#foo #foo #foo');
    expect(tags.filter(t => t === 'foo')).toHaveLength(1);
  });

  it('does not match # followed by a number', () => {
    const tags = extractTags('#123 should not match');
    expect(tags).toHaveLength(0);
  });

  it('matches tags with hyphens and slashes', () => {
    const tags = extractTags('#project/sub-task');
    expect(tags).toContain('project/sub-task');
  });

  it('extracts tags from YAML frontmatter inline format', () => {
    const doc = '---\ntags: [alpha, beta]\n---\nBody text';
    const tags = extractTags(doc);
    expect(tags).toContain('alpha');
    expect(tags).toContain('beta');
  });

  it('extracts tags from YAML frontmatter list format', () => {
    const doc = '---\ntags:\n  - gamma\n  - delta\n---\nBody text';
    const tags = extractTags(doc);
    expect(tags).toContain('gamma');
    expect(tags).toContain('delta');
  });

  it('does not extract headings as tags', () => {
    // # at start of line followed by space is a heading, not a tag
    const tags = extractTags('# Heading\nSome text');
    expect(tags).toHaveLength(0);
  });

  it('returns empty array for text with no tags', () => {
    expect(extractTags('No tags here')).toEqual([]);
  });

  it('does not extract tags from inside frontmatter as inline tags', () => {
    const doc = '---\ntitle: Test\n---\n#real-tag';
    const tags = extractTags(doc);
    expect(tags).toContain('real-tag');
    // Should not have 'title' or other frontmatter keys
    expect(tags).not.toContain('title');
  });
});
