import { computePluginChecksums, writeIntegrityFile, extractPluginZip, saveCustomTheme } from './tauri-commands';

export interface RegistryPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  minAppVersion: string;
  permissions: string[];
  sha256: string;
  downloadUrl: string;
  repo: string;
  registry: string; // source registry URL
}

export interface RegistryTheme {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  dark: boolean;
  sha256: string;
  downloadUrl: string;
  previewColors: { base: string; text: string; accent: string };
  registry: string;
}

function repoToRawUrl(repoUrl: string, file: string): string {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error(`Invalid GitHub repo URL: ${repoUrl}`);
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/${file}`;
}

export async function fetchPluginRegistry(repoUrls: string[]): Promise<RegistryPlugin[]> {
  const all: RegistryPlugin[] = [];
  for (const url of repoUrls) {
    try {
      const raw = await fetch(repoToRawUrl(url, 'registry.json'));
      if (!raw.ok) continue;
      const data = await raw.json() as { version?: unknown; plugins?: unknown[] };
      if (data.version !== 1 || !Array.isArray(data.plugins)) continue;
      for (const plugin of data.plugins) {
        all.push({ ...(plugin as RegistryPlugin), registry: url });
      }
    } catch {
      // Skip unavailable registries
    }
  }
  return all;
}

export async function fetchThemeRegistry(repoUrls: string[]): Promise<RegistryTheme[]> {
  const all: RegistryTheme[] = [];
  for (const url of repoUrls) {
    try {
      const raw = await fetch(repoToRawUrl(url, 'themes.json'));
      if (!raw.ok) continue;
      const data = await raw.json() as { version?: unknown; themes?: unknown[] };
      if (data.version !== 1 || !Array.isArray(data.themes)) continue;
      for (const theme of data.themes) {
        all.push({ ...(theme as RegistryTheme), registry: url });
      }
    } catch {
      // Skip unavailable registries
    }
  }
  return all;
}

export async function installPlugin(vaultRoot: string, plugin: RegistryPlugin): Promise<void> {
  // Download zip
  const response = await fetch(plugin.downloadUrl);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const data = Array.from(new Uint8Array(arrayBuffer));

  // Verify SHA-256 before extracting
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  if (hashHex !== plugin.sha256) {
    throw new Error('SHA-256 checksum mismatch — download may be corrupted or tampered');
  }

  // Extract
  await extractPluginZip(vaultRoot, plugin.id, data);

  // Compute and write integrity file
  const checksums = await computePluginChecksums(vaultRoot, plugin.id);
  await writeIntegrityFile(vaultRoot, plugin.id, plugin.registry, checksums);
}

export async function installTheme(vaultRoot: string, theme: RegistryTheme): Promise<void> {
  const response = await fetch(theme.downloadUrl);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  const cssContent = await response.text();

  // Verify SHA-256
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(cssContent));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (hashHex !== theme.sha256) {
    throw new Error('SHA-256 checksum mismatch — download may be corrupted or tampered');
  }

  // Save to .cascade/themes/
  await saveCustomTheme(vaultRoot, `${theme.id}.css`, cssContent);
}
