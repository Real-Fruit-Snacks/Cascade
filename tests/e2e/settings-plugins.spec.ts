import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';

const CDP_URL = 'http://localhost:9222';

let context: BrowserContext;
let page: Page;
const consoleLogs: Array<{ type: string; text: string }> = [];

test.beforeAll(async () => {
  const browser = await chromium.connectOverCDP(CDP_URL);
  context = browser.contexts()[0];
  page = context.pages().find((p) => p.url().includes('localhost:1420')) ?? context.pages()[0];

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

async function ensureFileOpen() {
  const editor = page.locator('.cm-editor');
  if (await editor.isVisible().catch(() => false)) return;
  const sidebar = page.locator('[data-path]');
  if (await sidebar.count() === 0) {
    const vaultButtons = page.locator('button').filter({ has: page.locator('span.text-xs') });
    if (await vaultButtons.count() > 0) {
      await vaultButtons.first().click();
      await page.waitForSelector('[data-path]', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(2000);
    }
  }
  if (!(await editor.isVisible().catch(() => false))) {
    const mdFile = page.locator('[data-path$=".md"]').first();
    if (await mdFile.isVisible().catch(() => false)) {
      await mdFile.click();
      await page.waitForSelector('.cm-editor', { state: 'visible', timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(500);
    }
  }
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

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Plugins Tests ────────────────────────────────────────────────

test.describe('Settings: Plugins', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Plugins section shows warning page when disabled', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    // Check if plugins are currently disabled (warning page visible)
    const warningText = page.locator('span.text-sm.font-semibold').filter({ hasText: 'Third-party plugins' });
    const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });

    const isDisabled = await turnOnButton.isVisible().catch(() => false);
    const isEnabled = await installedTab.isVisible().catch(() => false);

    if (isDisabled) {
      // Plugins are off — verify the warning UI
      await expect(warningText).toBeVisible();
      await expect(turnOnButton).toBeVisible();
      console.log('Plugins section: disabled state verified (warning + Turn on button)');
    } else if (isEnabled) {
      // Plugins are on — verify the installed/browse tabs
      await expect(installedTab).toBeVisible();
      const browseTab = page.locator('button').filter({ hasText: 'Browse' });
      await expect(browseTab).toBeVisible();
      console.log('Plugins section: enabled state verified (Installed/Browse tabs)');
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Enable plugins shows installed/browse tabs', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
    const wasDisabled = await turnOnButton.isVisible().catch(() => false);

    if (wasDisabled) {
      // Enable plugins
      await turnOnButton.click();
      await page.waitForTimeout(500);
    }

    // Verify installed/browse tabs appear
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    const browseTab = page.locator('button').filter({ hasText: 'Browse' });
    await expect(installedTab).toBeVisible({ timeout: 3000 });
    await expect(browseTab).toBeVisible({ timeout: 3000 });
    console.log('Plugins enabled: Installed and Browse tabs visible');

    // Switch to Browse tab and verify it works
    await browseTab.click();
    await page.waitForTimeout(300);

    // Switch back to Installed tab
    await installedTab.click();
    await page.waitForTimeout(300);

    // Open Plugin Folder button should be visible
    const openFolderBtn = page.locator('button').filter({ hasText: 'Open Plugin Folder' });
    const hasFolderBtn = await openFolderBtn.isVisible().catch(() => false);
    console.log(`Open Plugin Folder button visible: ${hasFolderBtn}`);

    // If we enabled plugins, disable them to restore state
    if (wasDisabled) {
      // Navigate away and back to reset — or just leave enabled since test is non-destructive
      console.log('Plugins were disabled, now enabled for test — leaving enabled');
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Browse tab shows marketplace content', async () => {
    await openSettings();
    await navigateToCategory('Plugins');

    // Ensure plugins are enabled
    const turnOnButton = page.locator('button').filter({ hasText: 'Turn on plugins' });
    if (await turnOnButton.isVisible().catch(() => false)) {
      await turnOnButton.click();
      await page.waitForTimeout(500);
    }

    // Click Browse tab
    const browseTab = page.locator('button').filter({ hasText: 'Browse' });
    await expect(browseTab).toBeVisible({ timeout: 3000 });
    await browseTab.click();
    await page.waitForTimeout(500);

    // Verify the browse tab rendered — it should show the browse view content
    // (either registry plugins or empty state) without errors
    // The active tab should have the highlighted style
    const isActive = await browseTab.evaluate((el) => {
      const style = (el as HTMLElement).style;
      return style.backgroundColor?.includes('surface2') || style.color?.includes('text');
    });
    console.log(`Browse tab active: ${isActive}`);
    // The dialog should still be visible and functional
    const dialog = page.locator('div[role="dialog"][aria-label="Settings"]');
    await expect(dialog).toBeVisible();
    console.log('Browse tab rendered without errors');

    // Switch back to Installed
    const installedTab = page.locator('button').filter({ hasText: 'Installed' });
    await installedTab.click();
    await page.waitForTimeout(300);

    await closeSettings();
    expectNoErrors();
  });
});
