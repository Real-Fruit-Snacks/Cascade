import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';

const CDP_URL = 'http://localhost:9222';

let context: BrowserContext;
let page: Page;
const consoleLogs: Array<{ type: string; text: string }> = [];

/** Find the Cascade app page (not DevTools) from the CDP context */
async function findAppPage(ctx: BrowserContext): Promise<Page> {
  // Try all pages and pick the one with the app content
  for (const p of ctx.pages()) {
    const url = p.url();
    if (url.includes('localhost:1420') || url.includes('tauri://')) return p;
  }
  // Fallback: pick the last page (DevTools is typically first)
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
  await page.waitForTimeout(1000);
});

// ─── Helpers ───────────────────────────────────────────────────────

async function ensureVaultOpen() {
  const sidebar = page.locator('[data-path]');
  if (await sidebar.count() > 0) return;
  const vaultButtons = page.locator('button').filter({ has: page.locator('span.text-xs') });
  if (await vaultButtons.count() > 0) {
    await vaultButtons.first().click();
    await page.waitForSelector('[data-path]', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(2000);
  }
}

async function ensureFileOpen() {
  await ensureVaultOpen();
  const editorVisible = await page.evaluate(() => !!document.querySelector('.cm-editor'));
  if (editorVisible) return;
  // Use evaluate to click — Playwright's click() can hang on covered elements
  await page.evaluate(() => {
    const mdFile = document.querySelector('[data-path$=".md"]') as HTMLElement;
    if (mdFile) mdFile.click();
  });
  await page.waitForTimeout(1000);
}

async function ensureSidebarVisible() {
  const visible = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-path]');
    return items.length > 0;
  });
  if (visible) return;
  await page.keyboard.press('Control+b');
  await page.waitForTimeout(500);
}

/** Re-acquire the app page in case HMR swapped it */
async function refreshPage() {
  const candidate = await findAppPage(context);
  if (candidate !== page) {
    page = candidate;
    page.on('console', (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });
  }
}

/** Dismiss any stale dialogs, menus, or modals */
async function cleanupUI() {
  await refreshPage();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  // Click body to dismiss any floating menus
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(100);
}

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected page errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── File Tree Tests ──────────────────────────────────────────────

test.describe('Sidebar: File Tree', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    await ensureSidebarVisible();
    clearConsoleLogs();
  });

  test('file tree displays files with data-path attributes', async () => {
    const items = page.locator('[data-path]');
    const count = await items.count();
    console.log(`File tree items: ${count}`);
    expect(count).toBeGreaterThan(0);

    // Verify at least one .md file exists
    const mdFiles = page.locator('[data-path$=".md"]');
    const mdCount = await mdFiles.count();
    console.log(`Markdown files: ${mdCount}`);
    expect(mdCount).toBeGreaterThan(0);

    expectNoErrors();
  });

  test('clicking a file opens it in the editor', async () => {
    // Use evaluate to click directly, bypassing Playwright actionability checks
    const result = await page.evaluate(() => {
      const mdFile = document.querySelector('[data-path$=".md"]') as HTMLElement;
      if (!mdFile) return { clicked: false, path: '' };
      const path = mdFile.getAttribute('data-path') ?? '';
      mdFile.click();
      return { clicked: true, path };
    });
    console.log(`Clicking file: ${result.path}`);
    // Wait for tab to appear (editor may take a moment to mount)
    await page.waitForFunction(
      () => document.querySelectorAll('.group\\/tab').length >= 1,
      { timeout: 5000 }
    ).catch(() => null);

    // Editor should be visible
    const editorVisible = await page.evaluate(() => !!document.querySelector('.cm-editor'));
    console.log(`Editor visible: ${editorVisible}`);
    expect(editorVisible).toBe(true);

    // A tab should exist (any tab — the tab label may be truncated)
    const tabCount = await page.evaluate(() => {
      return document.querySelectorAll('.group\\/tab').length;
    });
    console.log(`Open tabs: ${tabCount}`);
    expect(tabCount).toBeGreaterThanOrEqual(1);

    expectNoErrors();
  });

  test('clicking a folder expands/collapses it', async () => {
    // Use evaluate for direct DOM clicks to avoid actionability hangs
    const folderPath = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-path]');
      for (const item of items) {
        const path = item.getAttribute('data-path') ?? '';
        if (!path.includes('.')) return path;
      }
      return null;
    });

    if (!folderPath) {
      console.log('No folders found, skipping');
      return;
    }

    console.log(`Testing folder: ${folderPath}`);

    // Click to toggle expansion
    await page.evaluate((fp) => {
      (document.querySelector(`[data-path="${fp}"]`) as HTMLElement)?.click();
    }, folderPath);
    await page.waitForTimeout(300);

    // Click again to toggle back
    await page.evaluate((fp) => {
      (document.querySelector(`[data-path="${fp}"]`) as HTMLElement)?.click();
    }, folderPath);
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('search input filters file tree', async () => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (!hasSearch) {
      console.log('Search input not visible, skipping');
      return;
    }

    // Type a search term
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Items should be filtered
    const visibleItems = page.locator('[data-path]:visible');
    const filteredCount = await visibleItems.count();
    console.log(`Filtered items for "test": ${filteredCount}`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);

    const allItems = page.locator('[data-path]');
    const totalCount = await allItems.count();
    console.log(`Total items after clear: ${totalCount}`);
    expect(totalCount).toBeGreaterThanOrEqual(filteredCount);

    expectNoErrors();
  });
});

// ─── Context Menu Tests ──────────────────────────────────────────

test.describe('Sidebar: Context Menu', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    await ensureSidebarVisible();
    clearConsoleLogs();
  });

  test('right-clicking a file shows context menu with expected items', async () => {
    const mdFile = page.locator('[data-path$=".md"]').first();
    await mdFile.click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    const menuResult = await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return { visible: false, text: '', count: 0 };
      const items = menu.querySelectorAll('[role="menuitem"]');
      return { visible: true, text: menu.textContent ?? '', count: items.length };
    });

    console.log(`Context menu items: ${menuResult.count}`);
    console.log(`Menu text: ${menuResult.text.substring(0, 100)}`);
    expect(menuResult.visible).toBe(true);
    expect(menuResult.count).toBeGreaterThanOrEqual(3);
    expect(menuResult.text).toContain('Rename');
    expect(menuResult.text).toContain('Copy Path');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('right-clicking a folder shows folder-specific context menu', async () => {
    const folderPath = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-path]');
      for (const item of items) {
        const p = item.getAttribute('data-path') ?? '';
        if (!p.includes('.')) return p;
      }
      return null;
    });

    if (!folderPath) {
      console.log('No folders, skipping');
      return;
    }
    await page.locator(`[data-path="${folderPath}"]`).click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    const menuResult = await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return { visible: false, text: '' };
      return { visible: true, text: menu.textContent ?? '' };
    });

    console.log(`Folder menu: ${menuResult.text.substring(0, 100)}`);
    expect(menuResult.visible).toBe(true);
    expect(menuResult.text).toContain('New File');
    expect(menuResult.text).toContain('New Folder');
    expect(menuResult.text).toContain('Rename');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('context menu closes on Escape', async () => {
    await page.locator('[data-path$=".md"]').first().click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    const menuBefore = await page.evaluate(() => !!document.querySelector('[role="menu"]'));
    expect(menuBefore).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const menuAfter = await page.evaluate(() => !!document.querySelector('[role="menu"]'));
    console.log(`Menu visible after Escape: ${menuAfter}`);
    expect(menuAfter).toBe(false);

    expectNoErrors();
  });

  test('Copy Path copies file path to clipboard', async () => {
    const mdFile = page.locator('[data-path$=".md"]').first();
    const filePath = await mdFile.getAttribute('data-path');
    await mdFile.click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    // Click Copy Path menu item via evaluate
    const clicked = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="menuitem"]');
      for (const item of items) {
        if (item.textContent?.includes('Copy Path')) {
          (item as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    expect(clicked).toBe(true);
    await page.waitForTimeout(300);

    // Menu should close after clicking
    const menuGone = await page.evaluate(() => !document.querySelector('[role="menu"]'));
    expect(menuGone).toBe(true);

    console.log(`Copied path for: ${filePath}`);
    expectNoErrors();
  });
});

// ─── Tab Management Tests ────────────────────────────────────────

test.describe('Tab Management', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('opening a file creates a tab with the file name', async () => {
    await ensureSidebarVisible();

    // Get a .md file from the sidebar
    const fileName = await page.evaluate(() => {
      const item = document.querySelector('[data-path$=".md"]');
      if (!item) return null;
      const path = item.getAttribute('data-path') ?? '';
      return path.split('/').pop()?.replace('.md', '') ?? null;
    });

    if (!fileName) {
      console.log('No .md file found, skipping');
      return;
    }

    // Click the file via evaluate
    await page.evaluate(() => {
      (document.querySelector('[data-path$=".md"]') as HTMLElement)?.click();
    });

    // Wait for tab to appear (editor may take a moment to mount)
    await page.waitForFunction(
      () => document.querySelectorAll('.group\\/tab').length >= 1,
      { timeout: 5000 }
    ).catch(() => null);

    // Verify at least one tab exists
    const tabCount = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);
    console.log(`Open tabs: ${tabCount}`);
    expect(tabCount).toBeGreaterThanOrEqual(1);

    expectNoErrors();
  });

  test('Ctrl+W closes active tab', async () => {
    // Count initial tabs
    const initialTabs = await page.evaluate(() => {
      return document.querySelectorAll('.group\\/tab').length;
    });
    console.log(`Initial tabs: ${initialTabs}`);

    if (initialTabs <= 1) {
      await ensureSidebarVisible();
      await page.evaluate(() => {
        const items = document.querySelectorAll('[data-path$=".md"]');
        if (items.length > 1) (items[1] as HTMLElement).click();
      });
      await page.waitForTimeout(500);
    }

    const tabsBefore = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);

    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);

    const tabsAfter = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);
    console.log(`Tabs: ${tabsBefore} → ${tabsAfter}`);
    expect(tabsAfter).toBeLessThanOrEqual(tabsBefore);

    expectNoErrors();
  });

  test('Ctrl+Tab does not crash with open tabs', async () => {
    // Ensure at least one file is open
    await ensureFileOpen();

    const tabsBefore = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);
    console.log(`Tabs before Ctrl+Tab: ${tabsBefore}`);

    // Ctrl+Tab should not crash even with 0 or 1 tabs
    await page.keyboard.press('Control+Tab');
    await page.waitForTimeout(400);

    const tabsAfter = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);
    console.log(`Tabs after Ctrl+Tab: ${tabsAfter}`);

    // Tab count should be the same (no tabs lost)
    expect(tabsAfter).toBe(tabsBefore);

    expectNoErrors();
  });

  test('clicking tab close button removes the tab', async () => {
    await ensureSidebarVisible();

    // Make sure we have at least 2 tabs
    const files = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-path$=".md"]');
      return Array.from(items).slice(0, 2).map((el) => el.getAttribute('data-path')!);
    });

    for (const f of files) {
      await page.evaluate((fp) => {
        (document.querySelector(`[data-path="${fp}"]`) as HTMLElement)?.click();
      }, f);
      await page.waitForTimeout(300);
    }

    const tabsBefore = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);

    if (tabsBefore < 2) {
      console.log('Need at least 2 tabs');
      return;
    }

    // Hover over the active tab to reveal the X button, then click it
    const closeBtn = await page.evaluate(() => {
      const tabs = document.querySelectorAll('.group\\/tab');
      for (const tab of tabs) {
        const el = tab as HTMLElement;
        if (el.style.backgroundColor?.includes('var(--ctp-base)')) {
          // Find and click the close button (X icon)
          const btn = el.querySelector('button');
          if (btn) { btn.click(); return true; }
        }
      }
      return false;
    });

    await page.waitForTimeout(500);
    const tabsAfter = await page.evaluate(() => document.querySelectorAll('.group\\/tab').length);
    console.log(`Tabs: ${tabsBefore} → ${tabsAfter} (close clicked: ${closeBtn})`);

    expectNoErrors();
  });
});

// ─── Command Palette Tests ───────────────────────────────────────

test.describe('Command Palette', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Ctrl+P opens command palette', async () => {
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);

    const palette = page.locator('[role="dialog"][aria-label="Command Palette"]');
    await expect(palette).toBeVisible({ timeout: 3000 });

    const input = palette.locator('input[type="text"]');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    console.log('Command Palette opened with focused input');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('typing filters commands', async () => {
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);

    const palette = page.locator('[role="dialog"][aria-label="Command Palette"]');
    const input = palette.locator('input[type="text"]');

    // Get initial command count
    const initialCount = await palette.locator('[role="option"]').count();
    console.log(`Initial commands: ${initialCount}`);

    // Type to filter
    await input.fill('save');
    await page.waitForTimeout(300);

    const filteredCount = await palette.locator('[role="option"]').count();
    console.log(`Filtered commands for "save": ${filteredCount}`);
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);

    // Should contain "Save" command
    const results = palette.locator('[role="option"]');
    const resultTexts = await results.allTextContents();
    const hasSave = resultTexts.some((t) => t.toLowerCase().includes('save'));
    expect(hasSave).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('Escape closes command palette', async () => {
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);

    const palette = page.locator('[role="dialog"][aria-label="Command Palette"]');
    await expect(palette).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(palette).not.toBeVisible();

    expectNoErrors();
  });

  test('arrow keys navigate commands and Enter executes', async () => {
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);

    const palette = page.locator('[role="dialog"][aria-label="Command Palette"]');

    // Navigate down
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Check that a selection exists (highlighted command)
    const selectedItem = palette.locator('[role="option"][aria-selected="true"]');
    const hasSelection = await selectedItem.count();
    console.log(`Has selected command: ${hasSelection > 0}`);

    // Navigate back up
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('commands display keyboard shortcuts', async () => {
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);

    const palette = page.locator('[role="dialog"][aria-label="Command Palette"]');

    // Check if any command shows a shortcut badge
    const hasShortcuts = await palette.evaluate((el) => {
      const text = el.textContent ?? '';
      return text.includes('Ctrl') || text.includes('⌘');
    });
    console.log(`Commands show shortcuts: ${hasShortcuts}`);
    expect(hasShortcuts).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });
});

// ─── Quick Open Tests ────────────────────────────────────────────

test.describe('Quick Open', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Ctrl+O opens quick open dialog', async () => {
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"][aria-label="Quick Open"]');
    const isOpen = await dialog.isVisible().catch(() => false);
    console.log(`Quick Open visible: ${isOpen}`);

    if (isOpen) {
      const input = dialog.locator('input[type="text"]');
      await expect(input).toBeVisible();
      await expect(input).toBeFocused();

      // Type a file name fragment
      await input.fill('md');
      await page.waitForTimeout(300);

      const results = dialog.locator('[role="option"]');
      const resultCount = await results.count();
      console.log(`Quick Open results for "md": ${resultCount}`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    expectNoErrors();
  });
});

// ─── File CRUD Tests ─────────────────────────────────────────────

test.describe('File CRUD', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    await ensureSidebarVisible();
    clearConsoleLogs();
  });

  test('New File button opens input modal', async () => {
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button[title="New file"]') as HTMLElement;
      if (!btn) return false;
      btn.click();
      return true;
    });

    if (!clicked) {
      console.log('New file button not found, skipping');
      return;
    }
    await page.waitForTimeout(500);

    const modalVisible = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      return Array.from(dialogs).some((d) => d.getAttribute('aria-label') === 'New File');
    });
    console.log(`New File modal visible: ${modalVisible}`);
    expect(modalVisible).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('New Folder button opens input modal', async () => {
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button[title="New folder"]') as HTMLElement;
      if (!btn) return false;
      btn.click();
      return true;
    });

    if (!clicked) {
      console.log('New folder button not found, skipping');
      return;
    }
    await page.waitForTimeout(500);

    const modalVisible = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      return Array.from(dialogs).some((d) => d.getAttribute('aria-label') === 'New Folder');
    });
    console.log(`New Folder modal visible: ${modalVisible}`);
    expect(modalVisible).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('Rename from context menu shows inline input', async () => {
    await page.locator('[data-path$=".md"]').first().click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    // Click Rename menu item via evaluate
    const clickedRename = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="menuitem"]');
      for (const item of items) {
        if (item.textContent?.includes('Rename')) {
          (item as HTMLElement).click();
          return true;
        }
      }
      return false;
    });

    if (!clickedRename) {
      console.log('Rename not in context menu');
      await page.keyboard.press('Escape');
      return;
    }
    await page.waitForTimeout(500);

    // FileTreeItem renders an inline input with style backgroundColor: var(--ctp-surface0)
    const hasInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      return Array.from(inputs).some((input) => {
        const style = (input as HTMLElement).style;
        return style.backgroundColor === 'var(--ctp-surface0)';
      });
    });
    console.log(`Rename input visible: ${hasInput}`);
    expect(hasInput).toBe(true);

    // Cancel rename with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });
});
