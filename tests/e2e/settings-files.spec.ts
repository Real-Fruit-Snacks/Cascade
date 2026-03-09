import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'url';

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

async function clickToggle(labelText: string): Promise<boolean> {
  return page.evaluate((text) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return false;
    const labelDiv = labelSpan.parentElement;
    if (!labelDiv) return false;
    const outerRow = labelDiv.parentElement;
    if (!outerRow) return false;
    const btn = outerRow.querySelector('button.rounded-full') as HTMLElement;
    if (!btn) return false;
    btn.click();
    return true;
  }, labelText);
}

async function getToggleState(labelText: string): Promise<boolean | null> {
  return page.evaluate((text) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return null;
    const labelDiv = labelSpan.parentElement;
    if (!labelDiv) return null;
    const outerRow = labelDiv.parentElement;
    if (!outerRow) return null;
    const btn = outerRow.querySelector('button.rounded-full') as HTMLElement;
    if (!btn) return null;
    // accent color = ON, surface2 = OFF
    return btn.style.backgroundColor.includes('var(--ctp-accent)');
  }, labelText);
}

async function findDropdownByValues(values: string[]) {
  const dropdowns = page.locator('div[role="dialog"] select');
  const count = await dropdowns.count();
  for (let i = 0; i < count; i++) {
    const vals = await dropdowns.nth(i).locator('option').evaluateAll((opts) =>
      (opts as HTMLOptionElement[]).map((o) => o.value)
    );
    if (values.every((v) => vals.includes(v))) return dropdowns.nth(i);
  }
  return null;
}

async function getInputValue(labelText: string): Promise<string | null> {
  return page.evaluate((text) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return null;
    const labelDiv = labelSpan.parentElement;
    if (!labelDiv) return null;
    const outerRow = labelDiv.parentElement;
    if (!outerRow) return null;
    const input = outerRow.querySelector('input[type="text"]') as HTMLInputElement;
    if (!input) return null;
    return input.value;
  }, labelText);
}

async function setInputValue(labelText: string, value: string): Promise<boolean> {
  return page.evaluate(({ text, val }) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return false;
    const labelDiv = labelSpan.parentElement;
    if (!labelDiv) return false;
    const outerRow = labelDiv.parentElement;
    if (!outerRow) return false;
    const input = outerRow.querySelector('input[type="text"]') as HTMLInputElement;
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }, { text: labelText, val: value });
}

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Settings: Files', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Sort Order - changing sort order reorders sidebar file list', async () => {
    // Capture initial file order
    const getFileOrder = () => page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-path]'));
      return items.map((el) => el.getAttribute('data-path'));
    });

    const initialOrder = await getFileOrder();
    console.log(`Initial file count: ${initialOrder.length}, first: ${initialOrder[0]}`);
    expect(initialOrder.length).toBeGreaterThan(0);

    await openSettings();
    await navigateToCategory('Files');

    const dropdown = await findDropdownByValues(['name-asc', 'name-desc', 'modified-newest']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Switch to name-desc (reverse alphabetical)
    await dropdown!.selectOption('name-desc');
    await page.waitForTimeout(500);
    await closeSettings();

    const reversedOrder = await getFileOrder();
    console.log(`After name-desc, first: ${reversedOrder[0]}`);
    // The order should be different from the initial (unless only 1 file)
    if (initialOrder.length > 1) {
      expect(reversedOrder[0]).not.toBe(initialOrder[0]);
    }

    // Switch to modified-newest
    await openSettings();
    await navigateToCategory('Files');
    const dd2 = await findDropdownByValues(['name-asc', 'name-desc', 'modified-newest']);
    await dd2!.selectOption('modified-newest');
    await page.waitForTimeout(500);
    await closeSettings();

    const modifiedOrder = await getFileOrder();
    console.log(`After modified-newest, first: ${modifiedOrder[0]}`);

    // Restore
    await openSettings();
    await navigateToCategory('Files');
    const dd3 = await findDropdownByValues(['name-asc', 'name-desc', 'modified-newest']);
    await dd3!.selectOption(original);
    await page.waitForTimeout(300);
    await closeSettings();
    expectNoErrors();
  });

  test('Show File Extensions - toggling shows/hides .md in sidebar file names', async () => {
    // Check if any sidebar file item's truncate span ends with an extension
    const hasExtensions = () => page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-path$=".md"]'));
      return items.some((el) => {
        // The file name is in a span.truncate inside the data-path element
        const nameSpan = el.querySelector('span.truncate');
        return nameSpan?.textContent?.endsWith('.md');
      });
    });

    const initialState = await hasExtensions();
    console.log(`File extensions initially visible: ${initialState}`);

    await openSettings();
    await navigateToCategory('Files');
    expect(await clickToggle('Show File Extensions')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const afterToggle = await hasExtensions();
    console.log(`File extensions after toggle: ${afterToggle}`);
    expect(afterToggle).toBe(!initialState);

    // Toggle back
    await openSettings();
    await navigateToCategory('Files');
    expect(await clickToggle('Show File Extensions')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const restored = await hasExtensions();
    expect(restored).toBe(initialState);
    expectNoErrors();
  });

  test('Show Folder Icons - toggling shows/hides folder icons in sidebar', async () => {
    // Folder icons are lucide SVGs inside folder rows (entries that have children/are directories)
    const hasFolderIcons = () => page.evaluate(() => {
      // Folder items have data-path but are directories (contain expand chevrons or folder icons)
      // The folder icon is a <svg> lucide icon (FolderOpen or FolderClosed) near the folder name
      const folderRows = Array.from(document.querySelectorAll('[data-path]')).filter((el) => {
        // Directory rows typically have a chevron and folder icon
        return el.querySelector('svg.lucide-folder-open, svg.lucide-folder-closed, svg.lucide-folder') !== null;
      });
      return folderRows.length > 0;
    });

    const initialState = await hasFolderIcons();
    console.log(`Folder icons initially visible: ${initialState}`);

    await openSettings();
    await navigateToCategory('Files');
    expect(await clickToggle('Show Folder Icons')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const afterToggle = await hasFolderIcons();
    console.log(`Folder icons after toggle: ${afterToggle}`);
    expect(afterToggle).toBe(!initialState);

    // Toggle back
    await openSettings();
    await navigateToCategory('Files');
    expect(await clickToggle('Show Folder Icons')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const restored = await hasFolderIcons();
    expect(restored).toBe(initialState);
    expectNoErrors();
  });

  test('Show File Icons - toggling shows/hides file icons in sidebar', async () => {
    // File icons are <svg> lucide File icon next to file names
    const hasFileIcons = () => page.evaluate(() => {
      const fileRows = Array.from(document.querySelectorAll('[data-path$=".md"]'));
      return fileRows.some((el) =>
        el.querySelector('svg.lucide-file') !== null
      );
    });

    const initialState = await hasFileIcons();
    console.log(`File icons initially visible: ${initialState}`);

    await openSettings();
    await navigateToCategory('Files');
    expect(await clickToggle('Show File Icons')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const afterToggle = await hasFileIcons();
    console.log(`File icons after toggle: ${afterToggle}`);
    expect(afterToggle).toBe(!initialState);

    // Toggle back
    await openSettings();
    await navigateToCategory('Files');
    expect(await clickToggle('Show File Icons')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const restored = await hasFileIcons();
    expect(restored).toBe(initialState);
    expectNoErrors();
  });

  test('Confirm Before Delete - toggle state persists', async () => {
    // This is behavioral (shows confirm dialog on delete) — verify toggle state round-trips
    await openSettings();
    await navigateToCategory('Files');

    const initial = await getToggleState('Confirm Before Delete');
    console.log(`Confirm before delete initially: ${initial}`);
    expect(initial).not.toBeNull();

    expect(await clickToggle('Confirm Before Delete')).toBe(true);
    await page.waitForTimeout(300);

    const afterToggle = await getToggleState('Confirm Before Delete');
    expect(afterToggle).toBe(!initial);

    // Toggle back
    expect(await clickToggle('Confirm Before Delete')).toBe(true);
    await page.waitForTimeout(300);

    const restored = await getToggleState('Confirm Before Delete');
    expect(restored).toBe(initial);

    await closeSettings();
    expectNoErrors();
  });

  test('Move to Trash - toggle state persists', async () => {
    // Behavioral: controls whether delete uses OS trash or permanent delete
    await openSettings();
    await navigateToCategory('Files');

    const initial = await getToggleState('Move to Trash');
    console.log(`Move to trash initially: ${initial}`);
    expect(initial).not.toBeNull();

    expect(await clickToggle('Move to Trash')).toBe(true);
    await page.waitForTimeout(300);

    const afterToggle = await getToggleState('Move to Trash');
    expect(afterToggle).toBe(!initial);

    // Toggle back
    expect(await clickToggle('Move to Trash')).toBe(true);
    await page.waitForTimeout(300);

    const restored = await getToggleState('Move to Trash');
    expect(restored).toBe(initial);

    await closeSettings();
    expectNoErrors();
  });

  test('Templates Folder - text input updates and persists', async () => {
    await openSettings();
    await navigateToCategory('Files');

    const original = await getInputValue('Templates Folder');
    console.log(`Templates folder initially: ${original}`);
    expect(original).not.toBeNull();

    // Change to a different value
    expect(await setInputValue('Templates Folder', 'my-templates')).toBe(true);
    await page.waitForTimeout(300);

    // Close and reopen to verify persistence
    await closeSettings();
    await openSettings();
    await navigateToCategory('Files');

    const persisted = await getInputValue('Templates Folder');
    console.log(`Templates folder after change: ${persisted}`);
    expect(persisted).toBe('my-templates');

    // Restore
    expect(await setInputValue('Templates Folder', original!)).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify restoration
    await openSettings();
    await navigateToCategory('Files');
    const restored = await getInputValue('Templates Folder');
    expect(restored).toBe(original);
    await closeSettings();
    expectNoErrors();
  });

  test('Attachment Location - dropdown changes and persists', async () => {
    await openSettings();
    await navigateToCategory('Files');

    const dropdown = await findDropdownByValues(['vault-folder', 'same-folder']);
    expect(dropdown).not.toBeNull();

    const original = await dropdown!.inputValue();
    console.log(`Attachment location initially: ${original}`);

    // Switch to opposite
    const newVal = original === 'vault-folder' ? 'same-folder' : 'vault-folder';
    await dropdown!.selectOption(newVal);
    await page.waitForTimeout(300);

    // Close and reopen to verify persistence
    await closeSettings();
    await openSettings();
    await navigateToCategory('Files');
    const dd2 = await findDropdownByValues(['vault-folder', 'same-folder']);
    expect(await dd2!.inputValue()).toBe(newVal);

    // Restore
    await dd2!.selectOption(original);
    await page.waitForTimeout(300);
    await closeSettings();
    expectNoErrors();
  });

  test('Attachments Folder - text input updates when vault-folder is selected', async () => {
    await openSettings();
    await navigateToCategory('Files');

    // Ensure attachment location is 'vault-folder' so the input is visible
    const dropdown = await findDropdownByValues(['vault-folder', 'same-folder']);
    expect(dropdown).not.toBeNull();
    const originalLocation = await dropdown!.inputValue();
    if (originalLocation !== 'vault-folder') {
      await dropdown!.selectOption('vault-folder');
      await page.waitForTimeout(300);
    }

    const original = await getInputValue('Attachments Folder');
    console.log(`Attachments folder initially: ${original}`);
    expect(original).not.toBeNull();

    // Change value
    expect(await setInputValue('Attachments Folder', 'my-assets')).toBe(true);
    await page.waitForTimeout(300);

    // Close and reopen
    await closeSettings();
    await openSettings();
    await navigateToCategory('Files');

    // Make sure vault-folder is still selected
    const dd2 = await findDropdownByValues(['vault-folder', 'same-folder']);
    if (await dd2!.inputValue() !== 'vault-folder') {
      await dd2!.selectOption('vault-folder');
      await page.waitForTimeout(300);
    }

    const persisted = await getInputValue('Attachments Folder');
    console.log(`Attachments folder after change: ${persisted}`);
    expect(persisted).toBe('my-assets');

    // Restore
    expect(await setInputValue('Attachments Folder', original!)).toBe(true);
    await page.waitForTimeout(300);

    // Restore attachment location if changed
    if (originalLocation !== 'vault-folder') {
      const dd3 = await findDropdownByValues(['vault-folder', 'same-folder']);
      await dd3!.selectOption(originalLocation);
      await page.waitForTimeout(300);
    }

    await closeSettings();
    expectNoErrors();
  });
});
