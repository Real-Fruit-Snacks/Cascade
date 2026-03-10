import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDateCustom, resolveTemplateIncludes, applyTemplateVariables } from './template-utils';

// Mock dynamic imports used inside applyTemplateVariables
vi.mock('../stores/vault-store', () => ({
  useVaultStore: { getState: () => ({ vaultPath: '/test/vault' }) },
}));
vi.mock('../stores/plugin-store', () => ({
  usePluginStore: { getState: () => ({ templateFunctions: new Map() }) },
}));

// ── formatDateCustom ──────────────────────────────────────────

describe('formatDateCustom', () => {
  // Use a fixed date: 2024-03-15 (Friday), 09:05:03
  const date = new Date(2024, 2, 15, 9, 5, 3); // month is 0-indexed

  it('formats YYYY', () => {
    expect(formatDateCustom(date, 'YYYY')).toBe('2024');
  });

  it('formats YY', () => {
    expect(formatDateCustom(date, 'YY')).toBe('24');
  });

  it('formats MM (zero-padded)', () => {
    expect(formatDateCustom(date, 'MM')).toBe('03');
  });

  it('formats DD (zero-padded)', () => {
    expect(formatDateCustom(date, 'DD')).toBe('15');
  });

  it('formats HH (zero-padded)', () => {
    expect(formatDateCustom(date, 'HH')).toBe('09');
  });

  it('formats mm (minutes, zero-padded)', () => {
    expect(formatDateCustom(date, 'mm')).toBe('05');
  });

  it('formats ss (seconds, zero-padded)', () => {
    expect(formatDateCustom(date, 'ss')).toBe('03');
  });

  it('formats ddd (short weekday)', () => {
    // 2024-03-15 is a Friday
    expect(formatDateCustom(date, 'ddd')).toBe('Fri');
  });

  it('formats dddd (long weekday)', () => {
    expect(formatDateCustom(date, 'dddd')).toBe('Friday');
  });

  it('formats MMM (short month)', () => {
    expect(formatDateCustom(date, 'MMM')).toBe('Mar');
  });

  it('formats MMMM (long month)', () => {
    expect(formatDateCustom(date, 'MMMM')).toBe('March');
  });

  it('formats Q (quarter)', () => {
    // March is Q1
    expect(formatDateCustom(date, 'Q')).toBe('1');
    // October is Q4
    expect(formatDateCustom(new Date(2024, 9, 1), 'Q')).toBe('4');
  });

  it('formats WW (ISO week, zero-padded)', () => {
    // 2024-03-15 is ISO week 11
    expect(formatDateCustom(date, 'WW')).toBe('11');
  });

  it('formats a composite pattern YYYY-MM-DD', () => {
    expect(formatDateCustom(date, 'YYYY-MM-DD')).toBe('2024-03-15');
  });

  it('formats YYYY-MM-DD HH:mm', () => {
    expect(formatDateCustom(date, 'YYYY-MM-DD HH:mm')).toBe('2024-03-15 09:05');
  });

  it('preserves bracketed literals', () => {
    expect(formatDateCustom(date, '[Today is] YYYY-MM-DD')).toBe('Today is 2024-03-15');
  });

  it('preserves literal that contains a token word', () => {
    // "YYYY" inside brackets should NOT be replaced
    expect(formatDateCustom(date, '[YYYY] is a year token')).toBe('YYYY is a year token');
  });

  it('handles empty format string', () => {
    expect(formatDateCustom(date, '')).toBe('');
  });

  it('handles format with no tokens', () => {
    expect(formatDateCustom(date, 'no tokens here')).toBe('no tokens here');
  });
});

// ── resolveTemplateIncludes ───────────────────────────────────

describe('resolveTemplateIncludes', () => {
  it('returns content unchanged when no includes', async () => {
    const content = 'Hello, world!';
    const result = await resolveTemplateIncludes(content, async () => '');
    expect(result).toBe('Hello, world!');
  });

  it('replaces a single include directive', async () => {
    const readFn = vi.fn().mockResolvedValue('PARTIAL');
    const result = await resolveTemplateIncludes('before {{include:partial.md}} after', readFn);
    expect(result).toBe('before PARTIAL after');
    expect(readFn).toHaveBeenCalledWith('partial.md');
  });

  it('replaces multiple include directives', async () => {
    const readFn = vi.fn()
      .mockResolvedValueOnce('A')
      .mockResolvedValueOnce('B');
    const result = await resolveTemplateIncludes('{{include:a.md}} and {{include:b.md}}', readFn);
    expect(result).toBe('A and B');
  });

  it('replaces missing include with error message', async () => {
    const readFn = vi.fn().mockRejectedValue(new Error('not found'));
    const result = await resolveTemplateIncludes('{{include:missing.md}}', readFn);
    expect(result).toContain('[Template not found: missing.md]');
  });

  it('stops recursion at depth 5', async () => {
    // Every call returns another include — should stop and return the raw token
    const readFn = vi.fn().mockResolvedValue('{{include:loop.md}}');
    const result = await resolveTemplateIncludes('{{include:loop.md}}', readFn);
    // After depth 5, recursion stops and raw content is returned
    expect(readFn).toHaveBeenCalled();
    // Should not throw / infinite loop
    expect(result).toBeDefined();
  });
});

// ── applyTemplateVariables ────────────────────────────────────

describe('applyTemplateVariables', () => {
  beforeEach(() => {
    // Provide a minimal clipboard mock
    Object.assign(navigator, {
      clipboard: { readText: vi.fn().mockResolvedValue('clipboard text') },
    });
  });

  it('replaces {{title}} with filename without extension', async () => {
    const { text } = await applyTemplateVariables('{{title}}', 'notes/My Note.md');
    expect(text).toBe('My Note');
  });

  it('replaces {{title}} when file is at vault root', async () => {
    const { text } = await applyTemplateVariables('{{title}}', 'Simple.md');
    expect(text).toBe('Simple');
  });

  it('replaces {{folder}} with the directory portion', async () => {
    const { text } = await applyTemplateVariables('{{folder}}', 'journal/2024/note.md');
    expect(text).toBe('journal/2024');
  });

  it('replaces {{folder}} with empty string when at vault root', async () => {
    const { text } = await applyTemplateVariables('{{folder}}', 'note.md');
    expect(text).toBe('');
  });

  it('replaces {{date}} with ISO date (YYYY-MM-DD)', async () => {
    const { text } = await applyTemplateVariables('{{date}}', 'file.md');
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('replaces {{time}} with HH:mm', async () => {
    const { text } = await applyTemplateVariables('{{time}}', 'file.md');
    expect(text).toMatch(/^\d{2}:\d{2}$/);
  });

  it('replaces {{datetime}}', async () => {
    const { text } = await applyTemplateVariables('{{datetime}}', 'file.md');
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('replaces {{date:YYYY}} with current year', async () => {
    const { text } = await applyTemplateVariables('{{date:YYYY}}', 'file.md');
    expect(text).toMatch(/^\d{4}$/);
    expect(Number(text)).toBeGreaterThanOrEqual(2024);
  });

  it('replaces {{clipboard}} with provided clipboard value', async () => {
    const { text } = await applyTemplateVariables('{{clipboard}}', 'file.md', 'my clipboard');
    expect(text).toBe('my clipboard');
  });

  it('replaces {{uuid}} with a UUID v4 pattern', async () => {
    const { text } = await applyTemplateVariables('{{uuid}}', 'file.md');
    expect(text).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('handles {{cursor}} and returns cursorOffset', async () => {
    const { text, cursorOffset } = await applyTemplateVariables('before{{cursor}}after', 'file.md');
    expect(text).toBe('beforeafter');
    expect(cursorOffset).toBe(6);
  });

  it('returns cursorOffset null when no {{cursor}}', async () => {
    const { cursorOffset } = await applyTemplateVariables('no cursor here', 'file.md');
    expect(cursorOffset).toBeNull();
  });

  it('is case-insensitive for variable names', async () => {
    const { text } = await applyTemplateVariables('{{TITLE}}', 'My File.md');
    expect(text).toBe('My File');
  });

  it('replaces multiple variables in one pass', async () => {
    const { text } = await applyTemplateVariables('{{title}} — {{date:YYYY}}', 'Report.md');
    expect(text).toMatch(/^Report — \d{4}$/);
  });

  it('replaces {{vault}} using mocked vault store', async () => {
    const { text } = await applyTemplateVariables('{{vault}}', 'file.md');
    expect(text).toBe('vault'); // last segment of '/test/vault'
  });
});
