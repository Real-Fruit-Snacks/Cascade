const PROFILES_KEY = 'cascade-settings-profiles';

interface ProfileMapping {
  [vaultPath: string]: string;
}

const DEFAULT_SETTINGS_PATH = '.cascade/settings.json';

function loadMappings(): ProfileMapping {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMappings(mappings: ProfileMapping): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(mappings));
}

/** Get the active settings file path for a vault. */
export function getActiveProfile(vaultPath: string): string {
  const mappings = loadMappings();
  return mappings[vaultPath] || DEFAULT_SETTINGS_PATH;
}

/** Set the active settings file path for a vault. */
export function setActiveProfile(vaultPath: string, relativePath: string): void {
  const mappings = loadMappings();
  if (relativePath === DEFAULT_SETTINGS_PATH) {
    delete mappings[vaultPath];
  } else {
    mappings[vaultPath] = relativePath;
  }
  saveMappings(mappings);
}

/** Generate a profile filename from a display name, avoiding collisions. */
export function profileNameToPath(name: string, existingProfiles: string[] = []): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const baseSlug = slug || 'custom';
  let filename = `settings-${baseSlug}.json`;
  if (existingProfiles.includes(filename)) {
    let i = 2;
    while (existingProfiles.includes(`settings-${baseSlug}-${i}.json`)) i++;
    filename = `settings-${baseSlug}-${i}.json`;
  }
  return `.cascade/${filename}`;
}

export { DEFAULT_SETTINGS_PATH };
