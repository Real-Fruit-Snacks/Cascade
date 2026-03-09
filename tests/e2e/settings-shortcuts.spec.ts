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

/** Dispatch a keyboard event directly on the focused key-capture div */
async function dispatchKeyCombo(key: string, ctrlKey: boolean, altKey: boolean, shiftKey: boolean) {
  await page.evaluate(({ key, ctrlKey, altKey, shiftKey }) => {
    const el = document.activeElement as HTMLElement;
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key, ctrlKey, altKey, shiftKey, bubbles: true, cancelable: true,
    }));
  }, { key, ctrlKey, altKey, shiftKey });
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe('Settings: Keyboard Shortcuts', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('All shortcut groups are displayed', async () => {
    await openSettings();
    await navigateToCategory('Keyboard Shortcuts');

    // SubHeader renders with CSS text-transform: uppercase, so "Files" → "FILES" visually,
    // but textContent stays "Files". Find divs with font-semibold + uppercase classes.
    const foundGroups = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return [] as string[];
      // SubHeader has class: text-[0.65rem] font-semibold uppercase tracking-wider
      // Look for small, semibold, uppercase divs
      const allDivs = dialog.querySelectorAll('div');
      const headers: string[] = [];
      for (const d of allDivs) {
        const cl = d.className;
        if (cl.includes('font-semibold') && cl.includes('uppercase') && cl.includes('tracking-wider')) {
          headers.push(d.textContent?.trim() ?? '');
        }
      }
      return headers;
    });

    // textContent will be the original case: "Files", "Tabs", etc.
    const expected = ['Files', 'Tabs', 'Navigation', 'Export', 'Sidebar', 'App'];
    console.log(`Found groups: ${foundGroups.join(', ')}`);
    for (const label of expected) {
      expect(foundGroups, `Group "${label}" should be present`).toContain(label);
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Each shortcut has a keybinding button displayed', async () => {
    await openSettings();
    await navigateToCategory('Keyboard Shortcuts');

    const shortcutRows = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return [];
      const rows = dialog.querySelectorAll('.flex.items-center.justify-between.gap-4');
      return Array.from(rows).map((row) => {
        const label = row.querySelector('span.text-sm')?.textContent?.trim() ?? '';
        const keyBtn = row.querySelector('button[title="Click to rebind"]');
        const keyText = keyBtn?.textContent?.trim() ?? '';
        return { label, keyText, hasButton: !!keyBtn };
      }).filter((r) => r.label && r.hasButton);
    });

    console.log(`Found ${shortcutRows.length} shortcut bindings`);
    expect(shortcutRows.length).toBeGreaterThanOrEqual(15);

    for (const row of shortcutRows) {
      expect(row.keyText.length, `Shortcut "${row.label}" should have a keybinding`).toBeGreaterThan(0);
      console.log(`  ${row.label}: ${row.keyText}`);
    }

    await closeSettings();
    expectNoErrors();
  });

  test('Clicking a shortcut opens the key capture input', async () => {
    await openSettings();
    await navigateToCategory('Keyboard Shortcuts');

    const firstKeyBtn = page.locator('button[title="Click to rebind"]').first();
    await expect(firstKeyBtn).toBeVisible({ timeout: 3000 });
    const originalText = await firstKeyBtn.textContent();
    console.log(`Clicking shortcut button: ${originalText}`);

    await firstKeyBtn.click();
    await page.waitForTimeout(300);

    // The key capture div should appear with "Press keys..."
    const captureVisible = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const divs = dialog.querySelectorAll('div[tabindex="0"]');
      return Array.from(divs).some((d) => d.textContent?.includes('Press keys'));
    });
    console.log(`Key capture input visible: ${captureVisible}`);
    expect(captureVisible).toBe(true);

    // Cancel button should be visible
    const cancelBtn = page.locator('button[title="Cancel"]');
    await expect(cancelBtn).toBeVisible({ timeout: 2000 });

    await cancelBtn.click();
    await page.waitForTimeout(300);

    await expect(firstKeyBtn).toBeVisible({ timeout: 2000 });

    await closeSettings();
    expectNoErrors();
  });

  test('Key capture accepts a new binding and shows Save button', async () => {
    await openSettings();
    await navigateToCategory('Keyboard Shortcuts');

    // Use the last shortcut to avoid rebinding critical ones
    const keyBtns = page.locator('button[title="Click to rebind"]');
    const count = await keyBtns.count();
    const lastBtn = keyBtns.nth(count - 1);
    const originalText = await lastBtn.textContent();
    console.log(`Editing last shortcut: ${originalText}`);

    await lastBtn.click();
    await page.waitForTimeout(300);

    // Dispatch a key combo directly on the focused capture div
    await dispatchKeyCombo('F12', true, false, true);
    await page.waitForTimeout(300);

    // Save button should appear — use exact text match to avoid matching "Auto-Save"
    const hasSave = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('button');
      return Array.from(buttons).some((b) => b.textContent?.trim() === 'Save');
    });
    console.log(`Save button visible after key press: ${hasSave}`);
    expect(hasSave).toBe(true);

    // Cancel instead of saving
    const cancelBtn = page.locator('button[title="Cancel"]');
    await cancelBtn.click();
    await page.waitForTimeout(300);

    await closeSettings();
    expectNoErrors();
  });

  test('Rebind and reset a shortcut', async () => {
    await openSettings();
    await navigateToCategory('Keyboard Shortcuts');

    const keyBtns = page.locator('button[title="Click to rebind"]');
    const count = await keyBtns.count();
    const targetBtn = keyBtns.nth(count - 1);
    const originalText = (await targetBtn.textContent())?.trim();
    console.log(`Original binding for last shortcut: ${originalText}`);

    // Click to edit
    await targetBtn.click();
    await page.waitForTimeout(300);

    // Dispatch key combo on capture div
    await dispatchKeyCombo('F11', true, true, false);
    await page.waitForTimeout(300);

    // Click Save button (exact match)
    const saved = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('button');
      const saveBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Save');
      if (!saveBtn) return false;
      (saveBtn as HTMLElement).click();
      return true;
    });
    expect(saved, 'Save button should be clickable').toBe(true);
    await page.waitForTimeout(500);

    // Verify the binding changed
    const newText = (await keyBtns.nth(count - 1).textContent())?.trim();
    console.log(`New binding: ${newText}`);
    expect(newText).not.toBe(originalText);

    // A reset button should appear for the customized binding
    const resetBtn = page.locator('button[title="Reset to default"]').last();
    const hasReset = await resetBtn.isVisible().catch(() => false);
    console.log(`Reset button visible: ${hasReset}`);
    expect(hasReset).toBe(true);

    // "default: ..." label should appear
    const showsDefault = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return false;
      const spans = dialog.querySelectorAll('span.text-xs');
      return Array.from(spans).some((s) => s.textContent?.trim().startsWith('default:'));
    });
    console.log(`Default label visible: ${showsDefault}`);
    expect(showsDefault).toBe(true);

    // Reset to default
    await resetBtn.click();
    await page.waitForTimeout(500);

    // Verify restored to original
    const restoredText = (await keyBtns.nth(count - 1).textContent())?.trim();
    console.log(`Restored binding: ${restoredText}`);
    expect(restoredText).toBe(originalText);

    await closeSettings();
    expectNoErrors();
  });
});
