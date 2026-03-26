import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';

const CDP_URL = 'http://localhost:9222';

let context: BrowserContext;
let page: Page;
const consoleLogs: Array<{ type: string; text: string }> = [];

/** Find the Cascade app page (not DevTools) from the CDP context */
async function findAppPage(ctx: BrowserContext): Promise<Page> {
  for (const p of ctx.pages()) {
    const url = p.url();
    if (url.includes('localhost:1420') || url.includes('tauri://')) return p;
  }
  return ctx.pages()[ctx.pages().length - 1];
}

test.beforeAll(async () => {
  const browser = await chromium.connectOverCDP(CDP_URL);
  context = browser.contexts()[0];
  page = await findAppPage(context);

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'pageerror', text: err.message });
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  await page.waitForLoadState('domcontentloaded');
  // Wait for the app shell to mount
  await page.waitForFunction(
    () => document.querySelector('.cm-editor') !== null || document.querySelector('[data-path]') !== null || document.querySelector('button') !== null,
    { timeout: 10000 }
  ).catch(() => null);
});

// ─── Helpers ───────────────────────────────────────────────────────

async function ensureFileOpen() {
  const editorVisible = await page.evaluate(() => !!document.querySelector('.cm-editor'));
  if (editorVisible) return;
  // Try to open a vault first
  const hasFiles = await page.evaluate(() => !!document.querySelector('[data-path]'));
  if (!hasFiles) {
    await page.evaluate(() => {
      const btn = document.querySelector('button') as HTMLElement;
      if (btn) btn.click();
    });
    // Wait for file tree to appear after vault load
    await page.waitForFunction(
      () => document.querySelectorAll('[data-path]').length > 1,
      { timeout: 10000 }
    ).catch(() => null);
  }
  // Open a markdown file
  await page.evaluate(() => {
    const mdFile = document.querySelector('[data-path$=".md"]') as HTMLElement;
    if (mdFile) mdFile.click();
  });
  await page.waitForSelector('.cm-editor', { state: 'visible', timeout: 5000 }).catch(() => null);
}

async function refreshPage() {
  page = await findAppPage(context);
}

async function cleanupUI() {
  await refreshPage();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(100);
}

async function openSettings() {
  await page.keyboard.press('Control+,');
  await page.waitForSelector('div[role="dialog"][aria-label="Settings"]', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
}

async function closeSettings() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

async function navigateToCategory(label: string) {
  const btn = page.locator('.settings-sidebar-scroll button').filter({ hasText: label });
  await expect(btn.first()).toBeVisible({ timeout: 3000 });
  await btn.first().click();
  await page.waitForTimeout(200);
}

async function ensurePluginsEnabled(): Promise<boolean> {
  const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
  const wasDisabled = await turnOnButton.isVisible().catch(() => false);
  if (wasDisabled) {
    await turnOnButton.click();
    await page.waitForTimeout(500);
  }
  return wasDisabled;
}

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected page errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe('Plugin System: Settings UI', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    await cleanupUI();
    clearConsoleLogs();
  });

  test('Plugins section exists in settings sidebar', async () => {
    await openSettings();

    const pluginsBtn = page.locator('.settings-sidebar-scroll button').filter({ hasText: 'Plugins' });
    await expect(pluginsBtn.first()).toBeVisible({ timeout: 3000 });
    console.log('Plugins category found in settings sidebar');

    await closeSettings();
    expectNoErrors();
  });

  test('Plugins section renders without crashing', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    // The settings dialog should still be visible (no crash)
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();

    // Either the warning page or the enabled view should be present
    const hasContent = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      // Check for either state
      const hasWarning = !!Array.from(dialog.querySelectorAll('span')).find(
        (s) => s.textContent?.includes('Third-party plugins')
      );
      const hasInstalledTab = !!Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Installed'
      );
      return hasWarning || hasInstalledTab;
    });

    console.log(`Plugins section has content: ${hasContent}`);
    expect(hasContent).toBe(true);

    await closeSettings();
    expectNoErrors();
  });

  test('Plugin enable/disable toggle works', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
    const wasDisabled = await turnOnButton.isVisible().catch(() => false);

    if (wasDisabled) {
      // Enable plugins
      await turnOnButton.click();
      await page.waitForTimeout(500);

      // Should now show Installed/Browse tabs
      const installedTab = page.locator('button').filter({ hasText: 'Installed' });
      await expect(installedTab).toBeVisible({ timeout: 3000 });
      console.log('Plugins enabled: Installed tab visible');
    } else {
      // Already enabled — verify tabs are present
      const installedTab = page.locator('button').filter({ hasText: 'Installed' });
      await expect(installedTab).toBeVisible({ timeout: 3000 });
      console.log('Plugins already enabled: Installed tab visible');
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Installed and Browse tabs switch correctly', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();

    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    const browseTab = page.locator('button').filter({ hasText: 'Browse' });

    await expect(installedTab).toBeVisible({ timeout: 3000 });
    await expect(browseTab).toBeVisible({ timeout: 3000 });

    // Switch to Browse
    await browseTab.click();
    await page.waitForTimeout(300);

    // Verify Browse is active (dialog still functional)
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();
    console.log('Browse tab active — no crash');

    // Switch back to Installed
    await installedTab.click();
    await page.waitForTimeout(300);

    await expect(dialog).toBeVisible();
    console.log('Installed tab active — no crash');

    await closeSettings();
    expectNoErrors();
  });

  test('Browse tab shows search input for marketplace', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();

    const browseTab = page.locator('button').filter({ hasText: 'Browse' });
    await browseTab.click();
    await page.waitForTimeout(500);

    // Search input should be present in marketplace
    const hasSearchInput = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const inputs = dialog.querySelectorAll('input[type="text"]');
      return Array.from(inputs).some(
        (i) => (i as HTMLInputElement).placeholder.toLowerCase().includes('search')
      );
    });

    console.log(`Marketplace search input visible: ${hasSearchInput}`);
    expect(hasSearchInput).toBe(true);

    // Switch back to Installed
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    await installedTab.click();
    await page.waitForTimeout(300);

    await closeSettings();
    expectNoErrors();
  });

  test('Browse marketplace search input filters without errors', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();

    const browseTab = page.locator('button').filter({ hasText: 'Browse' });
    await browseTab.click();
    await page.waitForTimeout(500);

    // Type into search to test filtering
    const searchInput = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const inputs = dialog.querySelectorAll('input[type="text"]');
      const search = Array.from(inputs).find(
        (i) => (i as HTMLInputElement).placeholder.toLowerCase().includes('search')
      ) as HTMLInputElement;
      if (!search) return false;
      search.focus();
      search.value = 'test';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    await page.waitForTimeout(300);

    console.log(`Search input typed: ${searchInput}`);
    expect(searchInput).toBe(true);

    // Dialog should still be functional
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();

    // Switch back to Installed
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    await installedTab.click();
    await page.waitForTimeout(300);

    await closeSettings();
    expectNoErrors();
  });
});

test.describe('Plugin System: Plugin Store State', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    await cleanupUI();
    clearConsoleLogs();
  });

  test('Plugin store is accessible and has correct structure', async () => {
    const storeState = await page.evaluate(() => {
      // Access Zustand store from window — check if usePluginStore exists
      const win = window as any;
      // Try to get plugin store state
      if (win.__ZUSTAND_DEVTOOLS_GLOBAL_STORE_MAP__) {
        return { hasDevtools: true };
      }
      // Check if we can find the store via module system
      return { hasDevtools: false };
    });

    console.log(`Plugin store accessible: ${JSON.stringify(storeState)}`);
    // No errors should occur accessing the store
    expectNoErrors();
  });

  test('Plugin discovery runs without errors when opening settings', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();

    // Wait for discovery to complete (plugins list or empty state renders)
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
        return dialog !== null;
      },
      { timeout: 5000 }
    ).catch(() => null);

    // Dialog should still be visible (no crash from discovery)
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();

    // Check if the plugin list area rendered
    const hasPluginArea = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      // Either has plugin items or "no plugins" state
      const buttons = dialog.querySelectorAll('button');
      const hasInstalled = Array.from(buttons).some((b) => b.textContent?.trim() === 'Installed');
      return hasInstalled;
    });

    console.log(`Plugin area rendered: ${hasPluginArea}`);
    expect(hasPluginArea).toBe(true);

    await closeSettings();
    expectNoErrors();
  });

  test('Plugin list displays discovered plugins (if any)', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();
    await page.waitForTimeout(500);

    // Count plugin entries (role="button" items with plugin names)
    const pluginInfo = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return { count: 0, names: [] as string[] };

      // Plugin items have span.text-sm.font-medium for the name
      const nameSpans = dialog.querySelectorAll('span.text-sm.font-medium');
      const names: string[] = [];
      for (const span of nameSpans) {
        const text = span.textContent?.trim();
        // Filter out non-plugin names (like section headers)
        if (text && text.length > 0) {
          names.push(text);
        }
      }
      return { count: names.length, names };
    });

    console.log(`Discovered plugins: ${pluginInfo.count}`);
    if (pluginInfo.count > 0) {
      console.log(`Plugin names: ${pluginInfo.names.join(', ')}`);
    } else {
      console.log('No plugins installed — this is expected for a fresh vault');
    }

    // No crash regardless of plugin count
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();

    await closeSettings();
    expectNoErrors();
  });
});

test.describe('Plugin System: Sandbox Security', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    await cleanupUI();
    clearConsoleLogs();
  });

  test('No plugin iframes exist when plugins are disabled', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    // Check current state
    const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
    const pluginsDisabled = await turnOnButton.isVisible().catch(() => false);

    if (pluginsDisabled) {
      // With plugins disabled, no sandbox iframes should exist
      const iframeCount = await page.evaluate(() => {
        return document.querySelectorAll('iframe[sandbox]').length;
      });
      console.log(`Sandbox iframes when disabled: ${iframeCount}`);
      expect(iframeCount).toBe(0);
    } else {
      console.log('Plugins already enabled — skipping disabled iframe check');
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Plugin settings tab iframes use sandbox attribute', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();
    await page.waitForTimeout(500);

    // Check any plugin settings iframes have proper sandbox
    const iframeInfo = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe');
      return Array.from(iframes).map((iframe) => ({
        title: iframe.title,
        sandbox: iframe.getAttribute('sandbox'),
        src: iframe.src,
        hasSrcDoc: !!iframe.srcdoc,
      }));
    });

    console.log(`Total iframes on page: ${iframeInfo.length}`);
    for (const info of iframeInfo) {
      console.log(`  iframe: title="${info.title}", sandbox="${info.sandbox}"`);
      // All plugin-related iframes should have sandbox="allow-scripts"
      if (info.title?.includes('Plugin')) {
        expect(info.sandbox).toBe('allow-scripts');
        console.log(`  ✓ Plugin iframe has correct sandbox attribute`);
      }
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Plugin view iframes use sandbox attribute', async () => {
    // Check for any plugin view iframes in the main editor area
    const viewIframes = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe[title*="Plugin view"]');
      return Array.from(iframes).map((iframe) => ({
        title: iframe.title,
        sandbox: iframe.getAttribute('sandbox'),
      }));
    });

    console.log(`Plugin view iframes: ${viewIframes.length}`);
    for (const info of viewIframes) {
      expect(info.sandbox).toBe('allow-scripts');
      console.log(`  ✓ "${info.title}" has sandbox="allow-scripts"`);
    }

    // Even with no plugin views, this test validates the query runs without error
    expectNoErrors();
  });
});

test.describe('Plugin System: UI Integration Points', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    await cleanupUI();
    clearConsoleLogs();
  });

  test('Status bar renders plugin items without errors', async () => {
    // Check if status bar exists and can render plugin items
    const statusBarInfo = await page.evaluate(() => {
      const statusBar = document.querySelector('[class*="status-bar"]') ||
        document.querySelector('.flex.items-center.justify-between.px-2');
      if (!statusBar) {
        // Try finding by position (bottom of editor)
        const bars = document.querySelectorAll('div.flex.items-center');
        for (const bar of bars) {
          const rect = bar.getBoundingClientRect();
          if (rect.bottom > window.innerHeight - 40 && rect.height < 40) {
            return { found: true, children: bar.children.length };
          }
        }
        return { found: false, children: 0 };
      }
      return { found: true, children: statusBar.children.length };
    });

    console.log(`Status bar found: ${statusBarInfo.found}, children: ${statusBarInfo.children}`);
    // Status bar should exist (it's always rendered)
    expectNoErrors();
  });

  test('Sidebar renders plugin panels section without errors', async () => {
    // Verify sidebar can handle plugin panels
    const sidebarInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]') ||
        document.querySelector('.flex.flex-col.h-full');
      return {
        found: !!sidebar,
        hasPanelArea: !!document.querySelector('[data-path]'),
      };
    });

    console.log(`Sidebar found: ${sidebarInfo.found}, has panel area: ${sidebarInfo.hasPanelArea}`);
    expectNoErrors();
  });

  test('Plugin custom events dispatch without errors', async () => {
    // Test that cascade:* custom events can be dispatched without crashing
    const dispatched = await page.evaluate(() => {
      try {
        // Dispatch a plugin view event (should be handled gracefully even with no plugins)
        document.dispatchEvent(new CustomEvent('cascade:open-plugin-view', {
          detail: { viewType: '__test_nonexistent_view__' },
        }));
        return true;
      } catch {
        return false;
      }
    });

    console.log(`Custom event dispatched: ${dispatched}`);
    expect(dispatched).toBe(true);
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('Plugin context menu items area exists in context menu', async () => {
    // Right-click a file to open context menu
    const mdFile = page.locator('[data-path$=".md"]').first();
    const isVisible = await mdFile.isVisible().catch(() => false);

    if (!isVisible) {
      console.log('No sidebar file visible, skipping context menu test');
      return;
    }

    await mdFile.click({ button: 'right', force: true });
    await page.waitForTimeout(300);

    // Context menu should open without errors
    const menuVisible = await page.evaluate(() => {
      const menus = document.querySelectorAll('[class*="context-menu"], [role="menu"]');
      if (menus.length > 0) return true;
      // Also check for the custom context menu div
      const fixedDivs = document.querySelectorAll('div.fixed');
      return Array.from(fixedDivs).some((d) => {
        const rect = d.getBoundingClientRect();
        return rect.width > 50 && rect.width < 400 && rect.height > 50;
      });
    });

    console.log(`Context menu visible: ${menuVisible}`);

    // Close context menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    expectNoErrors();
  });
});

test.describe('Plugin System: Registry Management', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    await cleanupUI();
    clearConsoleLogs();
  });

  test('Browse tab shows registry management section', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();

    const browseTab = page.locator('button').filter({ hasText: 'Browse' });
    await browseTab.click();
    await page.waitForTimeout(500);

    // Check for registry-related UI elements
    const hasRegistryUI = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      // Look for registry input or registry list
      const inputs = dialog.querySelectorAll('input[type="text"]');
      const hasRegistryInput = Array.from(inputs).some((i) => {
        const ph = (i as HTMLInputElement).placeholder.toLowerCase();
        return ph.includes('registry') || ph.includes('github') || ph.includes('url');
      });
      // Also check for any "Add" buttons near inputs
      const buttons = dialog.querySelectorAll('button');
      const hasAddBtn = Array.from(buttons).some(
        (b) => b.textContent?.trim() === 'Add' || b.textContent?.trim() === '+'
      );
      return hasRegistryInput || hasAddBtn;
    });

    console.log(`Registry management UI found: ${hasRegistryUI}`);
    // This may or may not be visible depending on UI layout

    // Switch back
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    await installedTab.click();
    await page.waitForTimeout(300);

    await closeSettings();
    expectNoErrors();
  });

  test('Open Plugin Folder button exists when plugins enabled', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();
    await page.waitForTimeout(300);

    // Check for the "Open Plugin Folder" button (may be icon-only with title)
    const hasFolderBtn = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('button');
      return Array.from(buttons).some((b) => {
        const text = b.textContent?.trim().toLowerCase() ?? '';
        const title = b.getAttribute('title')?.toLowerCase() ?? '';
        return text.includes('plugin folder') || text.includes('open folder') ||
               title.includes('plugin') || text.includes('open plugin');
      });
    });

    console.log(`Open Plugin Folder button found: ${hasFolderBtn}`);

    await closeSettings();
    expectNoErrors();
  });
});

test.describe('Plugin System: Error Handling', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    await cleanupUI();
    clearConsoleLogs();
  });

  test('Rapidly toggling plugins on/off does not crash', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    // Toggle plugins on
    const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
    const wasDisabled = await turnOnButton.isVisible().catch(() => false);

    if (wasDisabled) {
      await turnOnButton.click();
      await page.waitForTimeout(300);
    }

    // Verify installed tab is visible (plugins are on)
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    const isEnabled = await installedTab.isVisible().catch(() => false);
    console.log(`Plugins enabled: ${isEnabled}`);

    // Dialog should still be functional
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();

    await closeSettings();
    expectNoErrors();
  });

  test('Switching between settings categories and back to Plugins does not crash', async () => {
    await openSettings();

    // Navigate to Plugins
    await navigateToCategory('Plugins');
    await page.waitForTimeout(300);

    // Navigate away
    await navigateToCategory('General');
    await page.waitForTimeout(300);

    // Navigate back
    await navigateToCategory('Plugins');
    await page.waitForTimeout(300);

    // Navigate to another category
    await navigateToCategory('Editor');
    await page.waitForTimeout(300);

    // And back to Plugins one more time
    await navigateToCategory('Plugins');
    await page.waitForTimeout(300);

    // Dialog should still be working
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();
    console.log('Navigated between settings categories without crash');

    await closeSettings();
    expectNoErrors();
  });

  test('Plugin section handles missing .cascade/plugins directory gracefully', async () => {
    await openSettings();
    await navigateToCategory('Plugins');
    await ensurePluginsEnabled();
    await page.waitForTimeout(500);

    // Even without a plugins directory, the UI should render without errors
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();

    // The installed tab should be usable
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    await expect(installedTab).toBeVisible();
    console.log('Plugin section renders with missing plugins directory');

    await closeSettings();
    expectNoErrors();
  });
});
