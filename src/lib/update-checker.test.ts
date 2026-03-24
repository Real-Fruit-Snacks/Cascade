import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isNewVersion, markVersionSeen, fetchReleaseNotes } from './update-checker';

describe('update-checker', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('isNewVersion', () => {
    it('returns false when no previous version is stored (first launch)', () => {
      expect(isNewVersion('0.2.0')).toBe(false);
    });

    it('returns false when current version matches stored version', () => {
      markVersionSeen('0.2.0');
      expect(isNewVersion('0.2.0')).toBe(false);
    });

    it('returns true when current version differs from stored version', () => {
      markVersionSeen('0.1.0');
      expect(isNewVersion('0.2.0')).toBe(true);
    });

    it('returns true on downgrade too (any difference)', () => {
      markVersionSeen('0.3.0');
      expect(isNewVersion('0.2.0')).toBe(true);
    });
  });

  describe('markVersionSeen', () => {
    it('stores the version in localStorage', () => {
      markVersionSeen('0.2.5');
      expect(localStorage.getItem('cascade-last-seen-version')).toBe('0.2.5');
    });

    it('overwrites a previous version', () => {
      markVersionSeen('0.1.0');
      markVersionSeen('0.2.0');
      expect(localStorage.getItem('cascade-last-seen-version')).toBe('0.2.0');
    });
  });

  describe('fetchReleaseNotes', () => {
    it('returns release body on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ body: '## Bug Fixes\n- Fixed stuff' }),
      });

      const result = await fetchReleaseNotes('0.2.0');
      expect(result).toBe('## Bug Fixes\n- Fixed stuff');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/Real-Fruit-Snacks/Cascade/releases/tags/v0.2.0',
        expect.objectContaining({ headers: { Accept: 'application/vnd.github.v3+json' } }),
      );
    });

    it('returns null on 404', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      expect(await fetchReleaseNotes('99.99.99')).toBeNull();
    });

    it('returns null on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
      expect(await fetchReleaseNotes('0.2.0')).toBeNull();
    });

    it('returns null when body is missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      expect(await fetchReleaseNotes('0.2.0')).toBeNull();
    });
  });
});
