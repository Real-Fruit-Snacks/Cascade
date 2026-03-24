import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveProfile, setActiveProfile, profileNameToPath, DEFAULT_SETTINGS_PATH } from './settings-profiles';

describe('settings-profiles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getActiveProfile', () => {
    it('returns default path when no profile is set', () => {
      expect(getActiveProfile('/vault/path')).toBe(DEFAULT_SETTINGS_PATH);
    });

    it('returns the stored profile path for a vault', () => {
      setActiveProfile('/vault/path', '.cascade/settings-matt.json');
      expect(getActiveProfile('/vault/path')).toBe('.cascade/settings-matt.json');
    });

    it('returns default for a different vault that has no profile', () => {
      setActiveProfile('/vault/a', '.cascade/settings-matt.json');
      expect(getActiveProfile('/vault/b')).toBe(DEFAULT_SETTINGS_PATH);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('cascade-settings-profiles', 'not json');
      expect(getActiveProfile('/vault/path')).toBe(DEFAULT_SETTINGS_PATH);
    });
  });

  describe('setActiveProfile', () => {
    it('stores a custom profile path', () => {
      setActiveProfile('/vault/path', '.cascade/settings-sarah.json');
      expect(getActiveProfile('/vault/path')).toBe('.cascade/settings-sarah.json');
    });

    it('removes the mapping when set to the default path', () => {
      setActiveProfile('/vault/path', '.cascade/settings-matt.json');
      setActiveProfile('/vault/path', DEFAULT_SETTINGS_PATH);
      expect(getActiveProfile('/vault/path')).toBe(DEFAULT_SETTINGS_PATH);
      // Verify it's actually removed, not just set to default
      const raw = localStorage.getItem('cascade-settings-profiles');
      const parsed = JSON.parse(raw!);
      expect(parsed['/vault/path']).toBeUndefined();
    });

    it('supports multiple vaults with different profiles', () => {
      setActiveProfile('/vault/a', '.cascade/settings-matt.json');
      setActiveProfile('/vault/b', '.cascade/settings-sarah.json');
      expect(getActiveProfile('/vault/a')).toBe('.cascade/settings-matt.json');
      expect(getActiveProfile('/vault/b')).toBe('.cascade/settings-sarah.json');
    });

    it('overwrites an existing profile mapping', () => {
      setActiveProfile('/vault/path', '.cascade/settings-matt.json');
      setActiveProfile('/vault/path', '.cascade/settings-sarah.json');
      expect(getActiveProfile('/vault/path')).toBe('.cascade/settings-sarah.json');
    });
  });

  describe('profileNameToPath', () => {
    it('converts a name to a slug-based path', () => {
      expect(profileNameToPath('Matt')).toBe('.cascade/settings-matt.json');
    });

    it('handles spaces and special characters', () => {
      expect(profileNameToPath('John Doe')).toBe('.cascade/settings-john-doe.json');
    });

    it('handles uppercase', () => {
      expect(profileNameToPath('SARAH')).toBe('.cascade/settings-sarah.json');
    });

    it('strips leading/trailing hyphens', () => {
      expect(profileNameToPath('--test--')).toBe('.cascade/settings-test.json');
    });

    it('collapses multiple hyphens', () => {
      expect(profileNameToPath('a   b   c')).toBe('.cascade/settings-a-b-c.json');
    });

    it('falls back to "custom" for empty/invalid names', () => {
      expect(profileNameToPath('')).toBe('.cascade/settings-custom.json');
      expect(profileNameToPath('!!!!')).toBe('.cascade/settings-custom.json');
    });

    it('avoids collision with existing profiles', () => {
      const existing = ['settings-matt.json'];
      expect(profileNameToPath('Matt', existing)).toBe('.cascade/settings-matt-2.json');
    });

    it('increments the number for multiple collisions', () => {
      const existing = ['settings-matt.json', 'settings-matt-2.json', 'settings-matt-3.json'];
      expect(profileNameToPath('Matt', existing)).toBe('.cascade/settings-matt-4.json');
    });

    it('does not collide when no match exists', () => {
      const existing = ['settings-sarah.json'];
      expect(profileNameToPath('Matt', existing)).toBe('.cascade/settings-matt.json');
    });

    it('handles empty existing list', () => {
      expect(profileNameToPath('Matt', [])).toBe('.cascade/settings-matt.json');
    });
  });

  describe('DEFAULT_SETTINGS_PATH', () => {
    it('is the standard .cascade/settings.json', () => {
      expect(DEFAULT_SETTINGS_PATH).toBe('.cascade/settings.json');
    });
  });
});
