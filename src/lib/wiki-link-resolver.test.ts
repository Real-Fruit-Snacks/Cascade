import { describe, it, expect } from 'vitest';
import { resolveWikiLink, parseWikiTarget } from './wiki-link-resolver';

describe('parseWikiTarget', () => {
  it('parses a plain file target', () => {
    const result = parseWikiTarget('My Note');
    expect(result.file).toBe('My Note');
    expect(result.heading).toBeNull();
    expect(result.blockId).toBeNull();
  });

  it('parses target with heading anchor', () => {
    const result = parseWikiTarget('Note#Section');
    expect(result.file).toBe('Note');
    expect(result.heading).toBe('Section');
    expect(result.blockId).toBeNull();
  });

  it('parses target with block ID', () => {
    const result = parseWikiTarget('Note^abc123');
    expect(result.file).toBe('Note');
    expect(result.heading).toBeNull();
    expect(result.blockId).toBe('abc123');
  });

  it('parses target with both heading and block ID', () => {
    const result = parseWikiTarget('Note#Section^block');
    expect(result.file).toBe('Note');
    expect(result.heading).toBe('Section');
    expect(result.blockId).toBe('block');
  });

  it('handles empty string', () => {
    const result = parseWikiTarget('');
    expect(result.file).toBe('');
    expect(result.heading).toBeNull();
    expect(result.blockId).toBeNull();
  });
});

describe('resolveWikiLink', () => {
  const files = [
    'notes/Hello.md',
    'journal/2024-01-01.md',
    'Project Plan.md',
    'archive/Old Note.md',
    'design.canvas',
  ];

  it('resolves exact path match', () => {
    expect(resolveWikiLink('notes/Hello.md', files)).toBe('notes/Hello.md');
  });

  it('resolves path with .md extension appended', () => {
    expect(resolveWikiLink('notes/Hello', files)).toBe('notes/Hello.md');
  });

  it('resolves case-insensitive match', () => {
    expect(resolveWikiLink('notes/hello', files)).toBe('notes/Hello.md');
  });

  it('resolves basename match (short link)', () => {
    expect(resolveWikiLink('Hello', files)).toBe('notes/Hello.md');
  });

  it('returns null for non-existent file', () => {
    expect(resolveWikiLink('DoesNotExist', files)).toBeNull();
  });

  it('strips heading anchor before resolving', () => {
    expect(resolveWikiLink('Hello#Section', files)).toBe('notes/Hello.md');
  });

  it('strips block ID before resolving', () => {
    expect(resolveWikiLink('Hello^block123', files)).toBe('notes/Hello.md');
  });

  it('resolves .canvas files', () => {
    expect(resolveWikiLink('design', files)).toBe('design.canvas');
  });

  it('normalizes backslashes', () => {
    expect(resolveWikiLink('notes\\Hello', files)).toBe('notes/Hello.md');
  });
});
