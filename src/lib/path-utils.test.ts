import { describe, it, expect } from 'vitest';
import { parseFileParts } from './path-utils';

describe('parseFileParts', () => {
  it('extracts filename and directory from a nested path', () => {
    const result = parseFileParts('journal/2024/note.md');
    expect(result.fileName).toBe('note');
    expect(result.dir).toBe('journal/2024');
  });

  it('strips .md extension from filename', () => {
    const result = parseFileParts('folder/My Note.md');
    expect(result.fileName).toBe('My Note');
  });

  it('returns null dir for root-level files', () => {
    const result = parseFileParts('readme.md');
    expect(result.fileName).toBe('readme');
    expect(result.dir).toBeNull();
  });

  it('normalizes backslashes to forward slashes', () => {
    const result = parseFileParts('folder\\subfolder\\file.md');
    expect(result.dir).toBe('folder/subfolder');
    expect(result.fileName).toBe('file');
  });

  it('handles files without .md extension', () => {
    const result = parseFileParts('folder/image.png');
    expect(result.fileName).toBe('image.png');
    expect(result.dir).toBe('folder');
  });

  it('handles empty string', () => {
    const result = parseFileParts('');
    expect(result.fileName).toBe('');
    expect(result.dir).toBeNull();
  });

  it('handles multiple dots in filename', () => {
    const result = parseFileParts('folder/my.note.v2.md');
    expect(result.fileName).toBe('my.note.v2');
    expect(result.dir).toBe('folder');
  });
});
