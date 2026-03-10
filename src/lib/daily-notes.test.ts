import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  openDailyNote,
  openWeeklyNote,
  openMonthlyNote,
  openQuarterlyNote,
  openYearlyNote,
} from './daily-notes';

// ── Mocks ──────────────────────────────────────────────────────

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockCreateFolder = vi.fn();

vi.mock('./tauri-commands', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  createFolder: (...args: unknown[]) => mockCreateFolder(...args),
}));

const mockOpenFile = vi.fn();
const mockEditorViewRef = { current: null };

vi.mock('../stores/editor-store', () => ({
  useEditorStore: {
    getState: () => ({
      openFile: mockOpenFile,
      editorViewRef: mockEditorViewRef,
    }),
  },
}));

const mockSettings = {
  dailyNotesFolder: 'daily',
  dailyNotesFormat: 'YYYY-MM-DD',
  dailyNotesTemplate: '',
  weeklyNotesFolder: 'weekly',
  weeklyNotesFormat: 'YYYY-[W]WW',
  weeklyNotesTemplate: '',
  monthlyNotesFolder: 'monthly',
  monthlyNotesFormat: 'YYYY-MM',
  monthlyNotesTemplate: '',
  quarterlyNotesFolder: 'quarterly',
  quarterlyNotesFormat: 'YYYY-[Q]Q',
  quarterlyNotesTemplate: '',
  yearlyNotesFolder: 'yearly',
  yearlyNotesFormat: 'YYYY',
  yearlyNotesTemplate: '',
};

vi.mock('../stores/settings-store', () => ({
  useSettingsStore: {
    getState: () => mockSettings,
  },
}));

const mockFormatDateCustom = vi.fn();
const mockApplyTemplateVariables = vi.fn();
const mockResolveTemplateIncludes = vi.fn();

vi.mock('./template-utils', () => ({
  formatDateCustom: (...args: unknown[]) => mockFormatDateCustom(...args),
  applyTemplateVariables: (...args: unknown[]) => mockApplyTemplateVariables(...args),
  resolveTemplateIncludes: (...args: unknown[]) => mockResolveTemplateIncludes(...args),
}));

// ── Helpers ────────────────────────────────────────────────────

const VAULT = '/vault';

beforeEach(() => {
  vi.clearAllMocks();
  mockFormatDateCustom.mockReturnValue('2024-03-15');
  mockCreateFolder.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockOpenFile.mockResolvedValue(undefined);
  mockResolveTemplateIncludes.mockImplementation((content: string) =>
    Promise.resolve(content),
  );
  mockApplyTemplateVariables.mockResolvedValue({ text: '', cursorOffset: null });

  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: vi.fn().mockResolvedValue('') },
    writable: true,
    configurable: true,
  });
});

// ── Tests ──────────────────────────────────────────────────────

describe('openDailyNote', () => {
  it('opens existing daily note without creating it', async () => {
    mockReadFile.mockResolvedValue('existing content');

    await openDailyNote(VAULT);

    expect(mockReadFile).toHaveBeenCalledWith(VAULT, 'daily/2024-03-15.md');
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockCreateFolder).not.toHaveBeenCalled();
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'daily/2024-03-15.md');
  });

  it('creates new daily note when file does not exist (no template)', async () => {
    mockReadFile.mockRejectedValue(new Error('not found'));

    await openDailyNote(VAULT);

    expect(mockCreateFolder).toHaveBeenCalledWith(VAULT, 'daily');
    expect(mockWriteFile).toHaveBeenCalledWith(VAULT, 'daily/2024-03-15.md', '');
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'daily/2024-03-15.md');
  });

  it('creates new daily note with template processing', async () => {
    mockSettings.dailyNotesTemplate = 'templates/daily.md';
    // First call (existence check) rejects; second call (template read) succeeds
    mockReadFile
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce('# {{date}}\n{{cursor}}');
    mockResolveTemplateIncludes.mockResolvedValue('# {{date}}\n{{cursor}}');
    mockApplyTemplateVariables.mockResolvedValue({
      text: '# 2024-03-15\n',
      cursorOffset: 14,
    });

    await openDailyNote(VAULT);

    expect(mockReadFile).toHaveBeenCalledWith(VAULT, 'templates/daily.md');
    expect(mockResolveTemplateIncludes).toHaveBeenCalled();
    expect(mockApplyTemplateVariables).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(
      VAULT,
      'daily/2024-03-15.md',
      '# 2024-03-15\n',
    );
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'daily/2024-03-15.md');

    // Restore
    mockSettings.dailyNotesTemplate = '';
  });

  it('falls back to empty content when template read fails', async () => {
    mockSettings.dailyNotesTemplate = 'templates/missing.md';
    mockReadFile.mockRejectedValue(new Error('not found'));

    await openDailyNote(VAULT);

    expect(mockWriteFile).toHaveBeenCalledWith(VAULT, 'daily/2024-03-15.md', '');

    mockSettings.dailyNotesTemplate = '';
  });
});

describe('note type folder and format settings', () => {
  beforeEach(() => {
    // File does not exist so we can observe createFolder calls
    mockReadFile.mockRejectedValue(new Error('not found'));
  });

  it('openWeeklyNote uses weekly folder and format', async () => {
    mockFormatDateCustom.mockReturnValue('2024-W11');

    await openWeeklyNote(VAULT);

    expect(mockFormatDateCustom).toHaveBeenCalledWith(
      expect.any(Date),
      'YYYY-[W]WW',
    );
    expect(mockCreateFolder).toHaveBeenCalledWith(VAULT, 'weekly');
    expect(mockWriteFile).toHaveBeenCalledWith(VAULT, 'weekly/2024-W11.md', '');
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'weekly/2024-W11.md');
  });

  it('openMonthlyNote uses monthly folder and format', async () => {
    mockFormatDateCustom.mockReturnValue('2024-03');

    await openMonthlyNote(VAULT);

    expect(mockFormatDateCustom).toHaveBeenCalledWith(
      expect.any(Date),
      'YYYY-MM',
    );
    expect(mockCreateFolder).toHaveBeenCalledWith(VAULT, 'monthly');
    expect(mockWriteFile).toHaveBeenCalledWith(VAULT, 'monthly/2024-03.md', '');
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'monthly/2024-03.md');
  });

  it('openQuarterlyNote uses quarterly folder and format', async () => {
    mockFormatDateCustom.mockReturnValue('2024-Q1');

    await openQuarterlyNote(VAULT);

    expect(mockFormatDateCustom).toHaveBeenCalledWith(
      expect.any(Date),
      'YYYY-[Q]Q',
    );
    expect(mockCreateFolder).toHaveBeenCalledWith(VAULT, 'quarterly');
    expect(mockWriteFile).toHaveBeenCalledWith(VAULT, 'quarterly/2024-Q1.md', '');
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'quarterly/2024-Q1.md');
  });

  it('openYearlyNote uses yearly folder and format', async () => {
    mockFormatDateCustom.mockReturnValue('2024');

    await openYearlyNote(VAULT);

    expect(mockFormatDateCustom).toHaveBeenCalledWith(
      expect.any(Date),
      'YYYY',
    );
    expect(mockCreateFolder).toHaveBeenCalledWith(VAULT, 'yearly');
    expect(mockWriteFile).toHaveBeenCalledWith(VAULT, 'yearly/2024.md', '');
    expect(mockOpenFile).toHaveBeenCalledWith(VAULT, 'yearly/2024.md');
  });
});
