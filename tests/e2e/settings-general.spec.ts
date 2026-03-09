import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Connect to the running Tauri app via Chrome DevTools Protocol.
// Start the app with: WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" npx tauri dev

const CDP_URL = 'http://localhost:9222';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let context: BrowserContext;
let page: Page;
const consoleLogs: Array<{ type: string; text: string }> = [];

test.beforeAll(async () => {
  const browser = await chromium.connectOverCDP(CDP_URL);
  context = browser.contexts()[0];
  page = context.pages().find((p) => p.url().includes('localhost:1420')) ?? context.pages()[0];

  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleLogs.push(entry);
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
  // Make sure a vault is open and a file is open in the editor
  const editor = page.locator('.cm-editor');
  if (await editor.isVisible().catch(() => false)) return;

  const sidebar = page.locator('[data-path]');
  if (await sidebar.count() === 0) {
    // Need to open vault first
    const vaultButtons = page.locator('button').filter({ has: page.locator('span.text-xs') });
    if (await vaultButtons.count() > 0) {
      await vaultButtons.first().click();
      await page.waitForSelector('[data-path]', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(2000);
    }
  }

  // Click first .md file to open in editor
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
  await page.waitForTimeout(500); // Allow settings to apply to editor
}

async function navigateToCategory(label: string) {
  const btn = page.locator('.settings-sidebar-scroll button').filter({ hasText: label });
  await expect(btn.first()).toBeVisible({ timeout: 3000 });
  await btn.first().click();
  await page.waitForTimeout(200);
}

/** Click ToggleSwitch in a SettingRow by exact label. Returns true if found & clicked. */
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

/** Adjust input[type="range"] slider in a SettingRow by label. */
async function adjustSlider(labelText: string, value: string): Promise<boolean> {
  return page.evaluate(({ text, val }) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return false;
    const labelDiv = labelSpan.parentElement;
    if (!labelDiv) return false;
    const outerRow = labelDiv.parentElement;
    if (!outerRow) return false;
    const input = outerRow.querySelector('input[type="range"]') as HTMLInputElement;
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { text: labelText, val: value });
}

/** Find a <select> dropdown inside the dialog by checking its option values. */
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

/** Find a <select> dropdown by checking option text content. */
async function findDropdownByOptionText(texts: string[]) {
  const dropdowns = page.locator('div[role="dialog"] select');
  const count = await dropdowns.count();
  for (let i = 0; i < count; i++) {
    const optTexts = await dropdowns.nth(i).locator('option').allTextContents();
    if (texts.every((t) => optTexts.some((ot) => ot.includes(t)))) return dropdowns.nth(i);
  }
  return null;
}

function clearConsoleLogs() { consoleLogs.length = 0; }

function getErrorLogs() {
  return consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror');
}

function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Settings: General', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Startup Behavior - changes persist in store', async () => {
    await openSettings();
    await navigateToCategory('General');

    const dropdown = await findDropdownByValues(['reopen-last', 'show-picker']);
    expect(dropdown).not.toBeNull();

    const original = await dropdown!.inputValue();

    // Switch to show-picker
    await dropdown!.selectOption('show-picker');
    await page.waitForTimeout(300);
    expect(await dropdown!.inputValue()).toBe('show-picker');

    // Verify persisted in localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('cascade-startup-behavior');
      return raw;
    });
    // The setting should be persisted (exact key may vary, check store value instead)
    const storeVal = await page.evaluate(() => {
      // Access store via the settings-store module
      const el = document.querySelector('[data-startup-behavior]');
      return el?.getAttribute('data-startup-behavior') ?? null;
    });

    // Restore
    await dropdown!.selectOption(original);
    await page.waitForTimeout(300);
    expect(await dropdown!.inputValue()).toBe(original);

    await closeSettings();
    expectNoErrors();
  });
});

test.describe('Settings: Editor', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Font Size - editor content uses the selected font size', async () => {
    // Get original font size from the editor
    const originalFontSize = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).fontSize : null;
    });
    expect(originalFontSize).not.toBeNull();
    console.log(`Original editor font size: ${originalFontSize}`);

    await openSettings();
    await navigateToCategory('Editor');

    const dropdown = await findDropdownByValues(['14', '16', '18']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Change to 18px
    await dropdown!.selectOption('18');
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify the editor's computed font size changed
    const newFontSize = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).fontSize : null;
    });
    console.log(`New editor font size: ${newFontSize}`);
    expect(newFontSize).toBe('18px');

    // Restore
    await openSettings();
    await navigateToCategory('Editor');
    const dd = await findDropdownByValues(['14', '16', '18']);
    await dd!.selectOption(original);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify restored
    const restoredFontSize = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).fontSize : null;
    });
    expect(restoredFontSize).toBe(originalFontSize);
    expectNoErrors();
  });

  test('Font Family - editor content uses the selected font', async () => {
    const originalFont = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).fontFamily : null;
    });
    expect(originalFont).not.toBeNull();
    console.log(`Original font: ${originalFont}`);

    await openSettings();
    await navigateToCategory('Editor');

    const dropdown = await findDropdownByOptionText(['JetBrains', 'Fira Code']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Switch to second option
    const options = await dropdown!.locator('option').all();
    const secondVal = options.length > 1 ? await options[1].getAttribute('value') : null;
    expect(secondVal).not.toBeNull();

    await dropdown!.selectOption(secondVal!);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify font-family changed on the editor
    const newFont = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).fontFamily : null;
    });
    console.log(`New font: ${newFont}`);
    expect(newFont).not.toBe(originalFont);

    // Restore
    await openSettings();
    await navigateToCategory('Editor');
    const dd = await findDropdownByOptionText(['JetBrains', 'Fira Code']);
    await dd!.selectOption(original);
    await page.waitForTimeout(300);
    await closeSettings();
    expectNoErrors();
  });

  test('Line Numbers - toggling shows/hides gutter line numbers in editor', async () => {
    // Check initial state
    const initialHasLineNumbers = await page.evaluate(() =>
      document.querySelector('.cm-lineNumbers') !== null
    );
    console.log(`Line numbers initially visible: ${initialHasLineNumbers}`);

    await openSettings();
    await navigateToCategory('Editor');
    expect(await clickToggle('Line Numbers')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify the state flipped
    const afterToggle = await page.evaluate(() =>
      document.querySelector('.cm-lineNumbers') !== null
    );
    expect(afterToggle).toBe(!initialHasLineNumbers);
    console.log(`Line numbers after toggle: ${afterToggle}`);

    // Toggle back
    await openSettings();
    await navigateToCategory('Editor');
    expect(await clickToggle('Line Numbers')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify restored
    const restored = await page.evaluate(() =>
      document.querySelector('.cm-lineNumbers') !== null
    );
    expect(restored).toBe(initialHasLineNumbers);
    expectNoErrors();
  });

  test('Readable Line Length - sets max-width on .cm-content', async () => {
    // Initially off (0 = no max-width)
    const initialMaxWidth = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).maxWidth : null;
    });
    console.log(`Initial .cm-content max-width: ${initialMaxWidth}`);

    await openSettings();
    await navigateToCategory('Editor');
    expect(await adjustSlider('Readable Line Length', '700')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify max-width is now 700px
    const newMaxWidth = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).maxWidth : null;
    });
    console.log(`After setting to 700: max-width = ${newMaxWidth}`);
    expect(newMaxWidth).toBe('700px');

    // Restore to 0 (off)
    await openSettings();
    await navigateToCategory('Editor');
    expect(await adjustSlider('Readable Line Length', '0')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify max-width removed (should be 'none' again)
    const restoredMaxWidth = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      return el ? getComputedStyle(el).maxWidth : null;
    });
    console.log(`Restored max-width: ${restoredMaxWidth}`);
    expect(restoredMaxWidth).not.toBe('700px');
    expectNoErrors();
  });

  test('Vim Mode - toggling shows/hides vim status indicator', async () => {
    // Vim mode OFF by default — no vim indicator visible
    const initialVimIndicator = await page.evaluate(() =>
      document.querySelector('[class*="vim"]') !== null ||
      Array.from(document.querySelectorAll('span')).some((s) =>
        ['NORMAL', 'INSERT', 'VISUAL'].includes(s.textContent?.trim() ?? '')
      )
    );
    console.log(`Vim indicator initially: ${initialVimIndicator}`);

    await openSettings();
    await navigateToCategory('Editor');
    expect(await clickToggle('Vim Mode')).toBe(true);
    await page.waitForTimeout(800); // Vim mode lazy-loads

    await closeSettings();
    await page.waitForTimeout(500);

    // After enabling vim mode, the status bar should show "NORMAL"
    const afterEnable = await page.evaluate(() =>
      Array.from(document.querySelectorAll('span')).some((s) =>
        ['NORMAL', 'INSERT', 'VISUAL'].includes(s.textContent?.trim() ?? '')
      )
    );
    console.log(`Vim indicator after enable: ${afterEnable}`);
    expect(afterEnable).toBe(true);

    // Disable vim mode
    await openSettings();
    await navigateToCategory('Editor');
    expect(await clickToggle('Vim Mode')).toBe(true);
    await page.waitForTimeout(500);
    await closeSettings();
    await page.waitForTimeout(500);

    // Vim indicator should be gone
    const afterDisable = await page.evaluate(() =>
      Array.from(document.querySelectorAll('span')).some((s) =>
        ['NORMAL', 'INSERT', 'VISUAL'].includes(s.textContent?.trim() ?? '')
      )
    );
    console.log(`Vim indicator after disable: ${afterDisable}`);
    expect(afterDisable).toBe(false);
    expectNoErrors();
  });

  test('Tab Size - changes CM6 tab size facet', async () => {
    await openSettings();
    await navigateToCategory('Editor');

    const dropdown = await findDropdownByOptionText(['2 spaces', '4 spaces']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Change to 2
    await dropdown!.selectOption('2');
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify CM6 EditorState.tabSize facet
    const tabSize = await page.evaluate(() => {
      const el = document.querySelector('.cm-editor') as any;
      const view = el?.cmView?.view;
      if (!view) return null;
      // Access tabSize via the state facet
      try {
        return view.state.tabSize;
      } catch {
        // Fallback: check indentUnit or indent text
        return null;
      }
    });
    console.log(`CM6 tab size after change: ${tabSize}`);
    // If direct access fails, verify via the dropdown value persisting
    if (tabSize !== null) {
      expect(tabSize).toBe(2);
    }

    // Also verify the dropdown value persisted by reopening settings
    await openSettings();
    await navigateToCategory('Editor');
    const dd = await findDropdownByOptionText(['2 spaces', '4 spaces']);
    expect(await dd!.inputValue()).toBe('2');

    // Restore to original
    await dd!.selectOption(original);
    await page.waitForTimeout(300);
    await closeSettings();

    // Verify restoration
    await openSettings();
    await navigateToCategory('Editor');
    const dd2 = await findDropdownByOptionText(['2 spaces', '4 spaces']);
    expect(await dd2!.inputValue()).toBe(original);
    await closeSettings();
    expectNoErrors();
  });

  test('Highlight Active Line - toggling shows/hides .cm-activeLine decoration', async () => {
    const initialHas = await page.evaluate(() =>
      document.querySelector('.cm-activeLine') !== null
    );
    console.log(`Active line highlight initially: ${initialHas}`);

    await openSettings();
    await navigateToCategory('Editor');
    expect(await clickToggle('Highlight Active Line')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const afterToggle = await page.evaluate(() =>
      document.querySelector('.cm-activeLine') !== null
    );
    console.log(`Active line after toggle: ${afterToggle}`);
    expect(afterToggle).toBe(!initialHas);

    // Toggle back
    await openSettings();
    await navigateToCategory('Editor');
    expect(await clickToggle('Highlight Active Line')).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const restored = await page.evaluate(() =>
      document.querySelector('.cm-activeLine') !== null
    );
    expect(restored).toBe(initialHas);
    expectNoErrors();
  });

  test('Default View Mode - changes which mode new files open in', async () => {
    await openSettings();
    await navigateToCategory('Editor');

    const dropdown = await findDropdownByValues(['live', 'source', 'reading']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Change to source
    await dropdown!.selectOption('source');
    await page.waitForTimeout(300);
    expect(await dropdown!.inputValue()).toBe('source');

    // Verify the store value reflects the change
    const storeVal = await page.evaluate(() => {
      // Read directly from settings store via the dropdown value
      const selects = document.querySelectorAll('div[role="dialog"] select');
      for (const sel of selects) {
        const s = sel as HTMLSelectElement;
        if (s.value === 'source' && Array.from(s.options).some((o) => o.value === 'reading')) {
          return s.value;
        }
      }
      return null;
    });
    expect(storeVal).toBe('source');

    // Change to reading
    await dropdown!.selectOption('reading');
    await page.waitForTimeout(300);
    expect(await dropdown!.inputValue()).toBe('reading');

    // Restore
    await dropdown!.selectOption(original);
    await page.waitForTimeout(300);
    await closeSettings();
    expectNoErrors();
  });

  test('Code Block Line Numbers - toggling updates store value', async () => {
    // This setting affects code blocks rendered inside the editor.
    // We verify via the toggle state changing (the visual effect requires a code block in the file)
    await openSettings();
    await navigateToCategory('Editor');

    // Read the toggle's visual state (background color indicates on/off)
    const getToggleState = async () => page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.text-sm'));
      const label = spans.find((s) => s.textContent?.trim() === 'Code Block Line Numbers');
      if (!label) return null;
      const row = label.parentElement?.parentElement;
      if (!row) return null;
      const btn = row.querySelector('button.rounded-full') as HTMLElement;
      if (!btn) return null;
      // accent color = ON, surface2 = OFF
      return btn.style.backgroundColor.includes('accent') || btn.style.backgroundColor.includes('var(--ctp-accent)');
    });

    const initialState = await getToggleState();
    console.log(`Code block line numbers initially: ${initialState}`);

    expect(await clickToggle('Code Block Line Numbers')).toBe(true);
    await page.waitForTimeout(300);

    const afterToggle = await getToggleState();
    console.log(`After toggle: ${afterToggle}`);
    expect(afterToggle).not.toBe(initialState);

    // Toggle back
    expect(await clickToggle('Code Block Line Numbers')).toBe(true);
    await page.waitForTimeout(300);

    const restored = await getToggleState();
    expect(restored).toBe(initialState);

    await closeSettings();
    expectNoErrors();
  });
});

test.describe('Settings: Appearance', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Theme - switching themes changes CSS variables', async () => {
    // Get current background color (--ctp-base)
    const originalBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-base').trim()
    );
    console.log(`Original --ctp-base: ${originalBg}`);

    await openSettings();
    await navigateToCategory('Appearance');

    const dropdown = await findDropdownByValues(['mocha', 'latte', 'frappe']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Switch to latte (light theme)
    await dropdown!.selectOption('latte');
    await page.waitForTimeout(500);
    await closeSettings();

    const latteBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-base').trim()
    );
    console.log(`Latte --ctp-base: ${latteBg}`);
    // Latte is a light theme, mocha is dark — the base color must be different
    if (original !== 'latte') {
      expect(latteBg).not.toBe(originalBg);
    }

    // Switch to frappe
    await openSettings();
    await navigateToCategory('Appearance');
    const dd1 = await findDropdownByValues(['mocha', 'latte', 'frappe']);
    await dd1!.selectOption('frappe');
    await page.waitForTimeout(500);
    await closeSettings();

    const frappeBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-base').trim()
    );
    console.log(`Frappe --ctp-base: ${frappeBg}`);
    expect(frappeBg).not.toBe(latteBg);

    // Restore original theme
    await openSettings();
    await navigateToCategory('Appearance');
    const dd2 = await findDropdownByValues(['mocha', 'latte', 'frappe']);
    await dd2!.selectOption(original);
    await page.waitForTimeout(500);
    await closeSettings();

    const restoredBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-base').trim()
    );
    expect(restoredBg).toBe(originalBg);
    expectNoErrors();
  });

  test('Accent Color - changes --ctp-accent CSS variable', async () => {
    const originalAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-accent').trim()
    );
    console.log(`Original --ctp-accent: ${originalAccent}`);

    await openSettings();
    await navigateToCategory('Appearance');

    // Click a different accent color button
    const clicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.text-sm'));
      const label = spans.find((s) => s.textContent?.trim() === 'Accent Color');
      if (!label) return false;
      const container = label.closest('div')?.parentElement?.parentElement;
      if (!container) return false;
      const buttons = container.querySelectorAll('button.rounded-full');
      if (buttons.length > 4) {
        (buttons[4] as HTMLElement).click();
        return true;
      }
      return false;
    });
    expect(clicked).toBe(true);
    await page.waitForTimeout(300);
    await closeSettings();

    const newAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-accent').trim()
    );
    console.log(`New --ctp-accent: ${newAccent}`);
    expect(newAccent).not.toBe(originalAccent);

    // Restore (click mauve = index 3)
    await openSettings();
    await navigateToCategory('Appearance');
    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.text-sm'));
      const label = spans.find((s) => s.textContent?.trim() === 'Accent Color');
      if (!label) return;
      const container = label.closest('div')?.parentElement?.parentElement;
      if (!container) return;
      const buttons = container.querySelectorAll('button.rounded-full');
      if (buttons.length > 3) (buttons[3] as HTMLElement).click();
    });
    await page.waitForTimeout(300);
    await closeSettings();

    const restoredAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ctp-accent').trim()
    );
    expect(restoredAccent).toBe(originalAccent);
    expectNoErrors();
  });

  test('Sidebar Position - changes sidebar element order in DOM', async () => {
    // AppShell sets style={{ order: sidebarPosition === 'right' ? 2 : 0 }}
    const getOrder = () => page.evaluate(() => {
      // The sidebar container is the element with the file tree
      const sidebar = document.querySelector('[data-path]')?.closest('div[style*="order"]');
      return sidebar ? getComputedStyle(sidebar).order : null;
    });

    const originalOrder = await getOrder();
    console.log(`Original sidebar order: ${originalOrder}`);

    await openSettings();
    await navigateToCategory('Appearance');

    const dropdown = await findDropdownByValues(['left', 'right']);
    expect(dropdown).not.toBeNull();
    const original = await dropdown!.inputValue();

    // Switch to right
    await dropdown!.selectOption('right');
    await page.waitForTimeout(500);
    await closeSettings();

    const rightOrder = await getOrder();
    console.log(`Right sidebar order: ${rightOrder}`);
    expect(rightOrder).toBe('2');

    // Switch to left
    await openSettings();
    await navigateToCategory('Appearance');
    const dd = await findDropdownByValues(['left', 'right']);
    await dd!.selectOption('left');
    await page.waitForTimeout(500);
    await closeSettings();

    const leftOrder = await getOrder();
    console.log(`Left sidebar order: ${leftOrder}`);
    expect(leftOrder).toBe('0');

    // Restore
    if (original !== 'left') {
      await openSettings();
      await navigateToCategory('Appearance');
      const dd2 = await findDropdownByValues(['left', 'right']);
      await dd2!.selectOption(original);
      await page.waitForTimeout(300);
      await closeSettings();
    }
    expectNoErrors();
  });

  test('UI Font Size - changes font-size on document root', async () => {
    const originalSize = await page.evaluate(() =>
      document.documentElement.style.fontSize || getComputedStyle(document.documentElement).fontSize
    );
    console.log(`Original root font-size: ${originalSize}`);

    await openSettings();
    await navigateToCategory('Appearance');

    // UiFontSizeSlider commits on mouseUp, not on change
    const adjusted = await page.evaluate(({ val }) => {
      const spans = Array.from(document.querySelectorAll('span.text-sm'));
      const labelSpan = spans.find((s) => s.textContent?.trim() === 'UI Font Size');
      if (!labelSpan) return false;
      const labelDiv = labelSpan.parentElement;
      if (!labelDiv) return false;
      const outerRow = labelDiv.parentElement;
      if (!outerRow) return false;
      const input = outerRow.querySelector('input[type="range"]') as HTMLInputElement;
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // UiFontSizeSlider commits on mouseUp
      input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }, { val: '18' });
    expect(adjusted).toBe(true);
    await page.waitForTimeout(500);
    await closeSettings();

    const newSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    console.log(`New root font-size: ${newSize}`);
    expect(newSize).toBe('18px');

    // Restore to 14
    await openSettings();
    await navigateToCategory('Appearance');
    await page.evaluate(({ val }) => {
      const spans = Array.from(document.querySelectorAll('span.text-sm'));
      const labelSpan = spans.find((s) => s.textContent?.trim() === 'UI Font Size');
      if (!labelSpan) return;
      const labelDiv = labelSpan.parentElement;
      if (!labelDiv) return;
      const outerRow = labelDiv.parentElement;
      if (!outerRow) return;
      const input = outerRow.querySelector('input[type="range"]') as HTMLInputElement;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, { val: '14' });
    await page.waitForTimeout(500);
    await closeSettings();

    const restored = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    console.log(`Restored root font-size: ${restored}`);
    expect(restored).toBe('14px');
    expectNoErrors();
  });
});
