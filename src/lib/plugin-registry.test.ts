import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPluginRegistry, installPlugin } from './plugin-registry';

// ── Mocks ──────────────────────────────────────────────────────

const mockExtractPluginZip = vi.fn();
const mockComputePluginChecksums = vi.fn();
const mockWriteIntegrityFile = vi.fn();

vi.mock('./tauri-commands', () => ({
  extractPluginZip: (...args: unknown[]) => mockExtractPluginZip(...args),
  computePluginChecksums: (...args: unknown[]) => mockComputePluginChecksums(...args),
  writeIntegrityFile: (...args: unknown[]) => mockWriteIntegrityFile(...args),
  saveCustomTheme: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

const VALID_SHA256 = 'a'.repeat(64);

function makeValidPlugin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'my-plugin',
    name: 'My Plugin',
    description: 'A test plugin',
    author: 'Tester',
    version: '1.0.0',
    minAppVersion: '0.1.0',
    permissions: [],
    sha256: VALID_SHA256,
    downloadUrl: 'https://example.com/plugin.zip',
    repo: 'https://github.com/user/my-plugin',
    registry: 'https://github.com/user/registry',
    ...overrides,
  };
}

function makeValidTheme(overrides: Record<string, unknown> = {}) {
  return {
    id: 'my-theme',
    name: 'My Theme',
    author: 'Tester',
    version: '1.0.0',
    description: 'A test theme',
    dark: true,
    sha256: VALID_SHA256,
    downloadUrl: 'https://example.com/theme.css',
    previewColors: { base: '#000', text: '#fff', accent: '#f00' },
    registry: 'https://github.com/user/registry',
    ...overrides,
  };
}

/** Build a fake fetch Response. */
function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

// ── isValidRegistryPlugin (tested via fetchPluginRegistry) ─────

describe('isValidRegistryPlugin', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('accepts a fully valid plugin object', async () => {
    const plugin = makeValidPlugin();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('my-plugin');
  });

  it('rejects a plugin with missing id', async () => {
    const plugin = makeValidPlugin({ id: undefined });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a plugin with id containing invalid characters', async () => {
    const plugin = makeValidPlugin({ id: 'My Plugin!' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a plugin with empty name', async () => {
    const plugin = makeValidPlugin({ name: '' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a plugin whose downloadUrl does not start with https://', async () => {
    const plugin = makeValidPlugin({ downloadUrl: 'http://example.com/plugin.zip' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a plugin with a sha256 that is not 64 hex characters', async () => {
    const plugin = makeValidPlugin({ sha256: 'deadbeef' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a plugin with sha256 containing non-hex characters', async () => {
    const plugin = makeValidPlugin({ sha256: 'z'.repeat(64) });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [plugin] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a non-object (null)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [null] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });
});

// ── isValidRegistryTheme (tested via fetchThemeRegistry) ───────

describe('isValidRegistryTheme', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('accepts a fully valid theme object', async () => {
    const { fetchThemeRegistry } = await import('./plugin-registry');
    const theme = makeValidTheme();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, themes: [theme] }),
    );
    const result = await fetchThemeRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('my-theme');
  });

  it('rejects a theme missing the id field', async () => {
    const { fetchThemeRegistry } = await import('./plugin-registry');
    const theme = makeValidTheme({ id: undefined });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, themes: [theme] }),
    );
    const result = await fetchThemeRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a theme whose downloadUrl does not start with https://', async () => {
    const { fetchThemeRegistry } = await import('./plugin-registry');
    const theme = makeValidTheme({ downloadUrl: 'ftp://example.com/theme.css' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, themes: [theme] }),
    );
    const result = await fetchThemeRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });

  it('rejects a theme with an invalid sha256', async () => {
    const { fetchThemeRegistry } = await import('./plugin-registry');
    const theme = makeValidTheme({ sha256: 'tooshort' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, themes: [theme] }),
    );
    const result = await fetchThemeRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(0);
  });
});

// ── fetchPluginRegistry ────────────────────────────────────────

describe('fetchPluginRegistry', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('constructs the raw GitHub URL from a repo string', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [] }),
    );
    await fetchPluginRegistry(['https://github.com/user/my-registry']);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/user/my-registry/main/registry.json',
    );
  });

  it('returns an empty array when the response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, false));
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toEqual([]);
  });

  it('returns an empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toEqual([]);
  });

  it('skips registries where version is not 1', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 2, plugins: [makeValidPlugin()] }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toEqual([]);
  });

  it('skips registries where plugins is not an array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: 'bad' }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toEqual([]);
  });

  it('attaches the registry URL to each returned plugin', async () => {
    const registryUrl = 'https://github.com/user/registry';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ version: 1, plugins: [makeValidPlugin()] }),
    );
    const result = await fetchPluginRegistry([registryUrl]);
    expect(result[0].registry).toBe(registryUrl);
  });

  it('aggregates valid plugins from multiple registries', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeResponse({ version: 1, plugins: [makeValidPlugin({ id: 'plugin-a' })] }))
      .mockResolvedValueOnce(makeResponse({ version: 1, plugins: [makeValidPlugin({ id: 'plugin-b' })] }));
    const result = await fetchPluginRegistry([
      'https://github.com/user/reg-a',
      'https://github.com/user/reg-b',
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['plugin-a', 'plugin-b']);
  });

  it('continues processing remaining registries when one fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(makeResponse({ version: 1, plugins: [makeValidPlugin({ id: 'plugin-b' })] }));
    const result = await fetchPluginRegistry([
      'https://github.com/user/reg-a',
      'https://github.com/user/reg-b',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('plugin-b');
  });

  it('filters out invalid plugins while keeping valid ones', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({
        version: 1,
        plugins: [
          makeValidPlugin({ id: 'good-plugin' }),
          makeValidPlugin({ id: 'Bad Plugin!' }), // invalid id
        ],
      }),
    );
    const result = await fetchPluginRegistry(['https://github.com/user/registry']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('good-plugin');
  });
});

// ── installPlugin ──────────────────────────────────────────────

describe('installPlugin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExtractPluginZip.mockClear().mockResolvedValue(undefined);
    mockComputePluginChecksums.mockClear().mockResolvedValue({ 'main.js': 'abc123' });
    mockWriteIntegrityFile.mockClear().mockResolvedValue(undefined);
  });

  async function makeHashedPlugin(): Promise<{
    plugin: ReturnType<typeof makeValidPlugin>;
    arrayBuffer: ArrayBuffer;
  }> {
    const arrayBuffer = new TextEncoder().encode('fake zip content').buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const plugin = makeValidPlugin({ sha256: hashHex });
    return { plugin, arrayBuffer };
  }

  it('downloads and installs a plugin when the SHA-256 checksum matches', async () => {
    const { plugin, arrayBuffer } = await makeHashedPlugin();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(arrayBuffer),
    } as unknown as Response);

    await expect(installPlugin('/vault', plugin)).resolves.toBeUndefined();
    expect(mockExtractPluginZip).toHaveBeenCalledWith('/vault', 'my-plugin', expect.any(Array));
    expect(mockComputePluginChecksums).toHaveBeenCalledWith('/vault', 'my-plugin');
    expect(mockWriteIntegrityFile).toHaveBeenCalledWith(
      '/vault',
      'my-plugin',
      plugin.registry,
      { 'main.js': 'abc123' },
    );
  });

  it('throws when the SHA-256 checksum does not match', async () => {
    const arrayBuffer = new TextEncoder().encode('corrupted content').buffer;
    const plugin = makeValidPlugin({ sha256: 'b'.repeat(64) }); // wrong hash
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(arrayBuffer),
    } as unknown as Response);

    await expect(installPlugin('/vault', plugin)).rejects.toThrow('SHA-256 checksum mismatch');
    expect(mockExtractPluginZip).not.toHaveBeenCalled();
  });

  it('throws when the download response is not ok', async () => {
    const plugin = makeValidPlugin();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    await expect(installPlugin('/vault', plugin)).rejects.toThrow('Failed to download: 404');
    expect(mockExtractPluginZip).not.toHaveBeenCalled();
  });

  it('throws when fetch rejects with a network error', async () => {
    const plugin = makeValidPlugin();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unreachable'));

    await expect(installPlugin('/vault', plugin)).rejects.toThrow('network unreachable');
  });
});
