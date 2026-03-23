import { getVersion } from '@tauri-apps/api/app';

const GITHUB_REPO = 'Real-Fruit-Snacks/Cascade';
const GITHUB_RELEASE_URL =
  `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const LAST_SEEN_VERSION_KEY = 'cascade-last-seen-version';

export interface UpdateInfo {
  version: string;
  url: string;
}

function compareVersions(current: string, latest: string): number {
  const a = current.split('.').map(Number);
  const b = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (b[i] || 0) - (a[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const currentVersion = await getVersion();

    const response = await fetch(GITHUB_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const tagName: string = data.tag_name ?? '';
    const latestVersion = tagName.replace(/^v/, '');

    // Skip pre-release tags
    if (latestVersion.includes('-')) return null;

    if (compareVersions(currentVersion, latestVersion) > 0) {
      return { version: latestVersion, url: data.html_url };
    }

    return null;
  } catch {
    // Network error, rate limit, etc. — fail silently
    return null;
  }
}

/** Check if this is the first launch after an update. */
export function isNewVersion(currentVersion: string): boolean {
  const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
  return lastSeen !== null && lastSeen !== currentVersion;
}

/** Mark the current version as seen. */
export function markVersionSeen(version: string): void {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

/** Fetch release notes for a specific version tag from GitHub. */
export async function fetchReleaseNotes(version: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.body ?? null;
  } catch {
    return null;
  }
}
