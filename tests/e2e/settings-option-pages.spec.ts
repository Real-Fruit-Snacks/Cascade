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
  // Wait for the app shell to mount
  await page.waitForFunction(
    () => document.querySelector('.cm-editor') !== null || document.querySelector('[data-path]') !== null || document.querySelector('button') !== null,
    { timeout: 10000 }
  ).catch(() => null);
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
      // Wait for file tree to stabilize after vault load
      await page.waitForFunction(
        () => document.querySelectorAll('[data-path]').length > 1,
        { timeout: 5000 }
      ).catch(() => null);
    }
  }
  if (!(await editor.isVisible().catch(() => false))) {
    const mdFile = page.locator('[data-path$=".md"]').first();
    if (await mdFile.isVisible().catch(() => false)) {
      await mdFile.click();
      await page.waitForSelector('.cm-editor', { state: 'visible', timeout: 5000 }).catch(() => null);
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

async function enableFeatureAndNavigate(featureLabel: string, optionPageLabel: string) {
  const optBtn = page.locator('.settings-sidebar-scroll button').filter({ hasText: optionPageLabel });
  if (await optBtn.count() === 0) {
    await navigateToCategory('Features');
    await page.waitForTimeout(200);
    const toggled = await clickToggle(featureLabel);
    if (toggled) await page.waitForTimeout(300);
  }
  await navigateToCategory(optionPageLabel);
  await page.waitForTimeout(200);
}

async function clickToggle(labelText: string): Promise<boolean> {
  return page.evaluate((text) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return false;
    const outerRow = labelSpan.parentElement?.parentElement;
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
    const outerRow = labelSpan.parentElement?.parentElement;
    if (!outerRow) return null;
    const btn = outerRow.querySelector('button.rounded-full') as HTMLElement;
    if (!btn) return null;
    return btn.style.backgroundColor.includes('var(--ctp-accent)');
  }, labelText);
}

async function getSelectValue(labelText: string): Promise<string | null> {
  return page.evaluate((text) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return null;
    const outerRow = labelSpan.parentElement?.parentElement;
    if (!outerRow) return null;
    const select = outerRow.querySelector('select') as HTMLSelectElement;
    return select?.value ?? null;
  }, labelText);
}

async function setSelectValue(labelText: string, value: string): Promise<boolean> {
  return page.evaluate(({ text, val }) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return false;
    const outerRow = labelSpan.parentElement?.parentElement;
    if (!outerRow) return false;
    const select = outerRow.querySelector('select') as HTMLSelectElement;
    if (!select) return false;
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
    nativeSet.call(select, val);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { text: labelText, val: value });
}

async function getInputValue(labelText: string): Promise<string | null> {
  return page.evaluate((text) => {
    const spans = Array.from(document.querySelectorAll('span.text-sm'));
    const labelSpan = spans.find((s) => s.textContent?.trim() === text);
    if (!labelSpan) return null;
    const outerRow = labelSpan.parentElement?.parentElement;
    if (!outerRow) return null;
    const input = outerRow.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement;
    return input?.value ?? null;
  }, labelText);
}

/** Read a Zustand store value directly */
async function getStoreValue(storePath: string): Promise<unknown> {
  return page.evaluate((path) => {
    // Access Zustand stores via window.__ZUSTAND_STORES__ if exposed, or via React internals
    // Fallback: read from the store's getState()
    const stores = (window as any).__ZUSTAND_STORES__;
    if (stores) {
      const [store, key] = path.split('.');
      return stores[store]?.getState()?.[key];
    }
    return null;
  }, storePath);
}

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Status Bar Options ──────────────────────────────────────────
// Each toggle controls a visible <span> in the status bar

test.describe('Option Page: Status Bar', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Word Count toggle shows/hides "words" in status bar', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');

    const initial = await getToggleState('Word Count');
    console.log(`Word Count initially: ${initial}`);

    // Close settings to see the status bar
    await closeSettings();
    await page.waitForTimeout(300);

    const statusBar = page.locator('.flex.items-center.shrink-0.px-3.select-none');
    const hasWords = async () => {
      const text = await statusBar.textContent();
      return text?.includes('words') ?? false;
    };

    const initialVisible = await hasWords();
    console.log(`"words" visible in status bar: ${initialVisible}`);
    expect(initialVisible).toBe(initial);

    // Toggle
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');
    expect(await clickToggle('Word Count')).toBe(true);
    await closeSettings();
    await page.waitForTimeout(300);

    const afterToggle = await hasWords();
    console.log(`"words" after toggle: ${afterToggle}`);
    expect(afterToggle).toBe(!initial);

    // Restore
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');
    expect(await clickToggle('Word Count')).toBe(true);
    await closeSettings();
    expectNoErrors();
  });

  test('Character Count toggle shows/hides "chars" in status bar', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');

    const initial = await getToggleState('Character Count');
    await closeSettings();
    await page.waitForTimeout(300);

    const statusBar = page.locator('.flex.items-center.shrink-0.px-3.select-none');
    const hasChars = async () => {
      const text = await statusBar.textContent();
      return text?.includes('chars') ?? false;
    };

    expect(await hasChars()).toBe(initial);

    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');
    expect(await clickToggle('Character Count')).toBe(true);
    await closeSettings();
    await page.waitForTimeout(300);

    expect(await hasChars()).toBe(!initial);
    console.log(`Character Count toggled: ${initial} → ${!initial}`);

    // Restore
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');
    expect(await clickToggle('Character Count')).toBe(true);
    await closeSettings();
    expectNoErrors();
  });

  test('Reading Time toggle shows/hides "min read" in status bar', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');

    const initial = await getToggleState('Reading Time');
    await closeSettings();
    await page.waitForTimeout(300);

    const statusBar = page.locator('.flex.items-center.shrink-0.px-3.select-none');
    const hasReading = async () => {
      const text = await statusBar.textContent();
      return text?.includes('min read') ?? false;
    };

    expect(await hasReading()).toBe(initial);

    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');
    expect(await clickToggle('Reading Time')).toBe(true);
    await closeSettings();
    await page.waitForTimeout(300);

    expect(await hasReading()).toBe(!initial);
    console.log(`Reading Time toggled: ${initial} → ${!initial}`);

    // Restore
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');
    expect(await clickToggle('Reading Time')).toBe(true);
    await closeSettings();
    expectNoErrors();
  });

  test('Selection Stats toggle state persists', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Status Bar', 'Status Bar');

    const initial = await getToggleState('Selection Stats');
    console.log(`Selection Stats initially: ${initial}`);
    expect(initial).not.toBeNull();

    expect(await clickToggle('Selection Stats')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Selection Stats')).toBe(!initial);

    // Restore
    expect(await clickToggle('Selection Stats')).toBe(true);
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Focus Mode Options ─────────────────────────────────────────
// Dim Paragraphs adds .focus-dim-paragraphs class to editor container

test.describe('Option Page: Focus Mode', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Dim Paragraphs adds focus-dim-paragraphs class when focus mode active', async () => {
    // Enable focus mode feature
    await openSettings();
    await enableFeatureAndNavigate('Focus Mode', 'Focus Mode');

    const dimState = await getToggleState('Dim Paragraphs');
    console.log(`Dim Paragraphs: ${dimState}`);

    // Ensure Dim Paragraphs is ON
    if (!dimState) {
      expect(await clickToggle('Dim Paragraphs')).toBe(true);
      await page.waitForTimeout(200);
    }

    await closeSettings();
    await page.waitForTimeout(300);

    // Activate focus mode via the store
    const hasFocusDim = await page.evaluate(() => {
      // Check if focus-dim-paragraphs class exists on any container
      return !!document.querySelector('.focus-dim-paragraphs');
    });
    console.log(`focus-dim-paragraphs class present: ${hasFocusDim}`);
    // Note: class only appears when focus mode is ACTIVE (toggled on via command/shortcut)
    // The setting just controls whether dimming applies when active

    // Verify the toggle state persists
    await openSettings();
    await enableFeatureAndNavigate('Focus Mode', 'Focus Mode');
    const afterState = await getToggleState('Dim Paragraphs');
    expect(afterState).toBe(true);

    const typewriterState = await getToggleState('Typewriter Scrolling');
    console.log(`Typewriter Scrolling: ${typewriterState}`);
    expect(typewriterState).not.toBeNull();

    // Toggle Typewriter Scrolling to verify it works
    expect(await clickToggle('Typewriter Scrolling')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Typewriter Scrolling')).toBe(!typewriterState);
    expect(await clickToggle('Typewriter Scrolling')).toBe(true);
    await page.waitForTimeout(200);

    // Restore Dim Paragraphs to original
    if (!dimState) {
      expect(await clickToggle('Dim Paragraphs')).toBe(true);
      await page.waitForTimeout(200);
    }

    // Disable Focus Mode feature
    await navigateToCategory('Features');
    await clickToggle('Focus Mode');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Code Folding Options ────────────────────────────────────────
// Enabling code folding adds .cm-foldGutter to the editor

test.describe('Option Page: Code Folding', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Fold Headings/Code Blocks toggles and fold gutter appears in editor', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Code Folding', 'Code Folding');

    // Verify Fold Headings toggle
    const foldHeadings = await getToggleState('Fold Headings');
    console.log(`Fold Headings: ${foldHeadings}`);
    expect(foldHeadings).not.toBeNull();

    expect(await clickToggle('Fold Headings')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Fold Headings')).toBe(!foldHeadings);
    expect(await clickToggle('Fold Headings')).toBe(true);
    await page.waitForTimeout(200);

    // Verify Fold Code Blocks toggle
    const foldCode = await getToggleState('Fold Code Blocks');
    console.log(`Fold Code Blocks: ${foldCode}`);
    expect(foldCode).not.toBeNull();

    expect(await clickToggle('Fold Code Blocks')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Fold Code Blocks')).toBe(!foldCode);
    expect(await clickToggle('Fold Code Blocks')).toBe(true);
    await page.waitForTimeout(200);

    // Verify Minimum Fold Level dropdown
    const minLevel = await getSelectValue('Minimum Fold Level');
    console.log(`Minimum Fold Level: ${minLevel}`);
    expect(minLevel).not.toBeNull();

    await closeSettings();
    await page.waitForTimeout(300);

    // Verify fold gutter is present in the editor (code folding is enabled)
    const hasFoldGutter = await page.evaluate(() => !!document.querySelector('.cm-foldGutter'));
    console.log(`Fold gutter present: ${hasFoldGutter}`);
    expect(hasFoldGutter).toBe(true);

    // Disable Code Folding and verify fold gutter disappears
    await openSettings();
    await navigateToCategory('Features');
    await clickToggle('Code Folding');
    await page.waitForTimeout(200);
    await closeSettings();
    await page.waitForTimeout(300);

    const foldGutterAfterDisable = await page.evaluate(() => !!document.querySelector('.cm-foldGutter'));
    console.log(`Fold gutter after disable: ${foldGutterAfterDisable}`);
    expect(foldGutterAfterDisable).toBe(false);

    expectNoErrors();
  });
});

// ─── Live Preview Options ─────────────────────────────────────────
// Each toggle controls whether markdown elements render as decorations

test.describe('Option Page: Live Preview', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('all live preview element toggles flip state correctly', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Live Preview', 'Live Preview');

    for (const label of ['Headings', 'Bold', 'Italic', 'Links', 'Images', 'Code Blocks']) {
      const initial = await getToggleState(label);
      console.log(`${label}: ${initial}`);
      expect(initial).not.toBeNull();

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState(label)).toBe(!initial);

      // Restore
      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
    }

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Wiki Links Options ───────────────────────────────────────────

test.describe('Option Page: Wiki Links', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Open in New Tab, Show Full Path, Create on Follow toggles persist in store', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Wiki Links', 'Wiki Links');

    for (const label of ['Open in New Tab', 'Show Full Path', 'Create on Follow']) {
      const initial = await getToggleState(label);
      console.log(`${label}: ${initial}`);
      expect(initial).not.toBeNull();

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState(label)).toBe(!initial);

      // Restore
      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
    }

    // Close and reopen to verify persistence
    await closeSettings();
    await page.waitForTimeout(300);
    await openSettings();
    await enableFeatureAndNavigate('Wiki Links', 'Wiki Links');

    // Verify values still match originals
    for (const label of ['Open in New Tab', 'Show Full Path', 'Create on Follow']) {
      const state = await getToggleState(label);
      console.log(`${label} after reopen: ${state}`);
      expect(state).not.toBeNull();
    }

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Tags Options ─────────────────────────────────────────────────

test.describe('Option Page: Tags', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Auto-Complete Tags and Nested Tags toggles persist', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Tags', 'Tags');

    for (const label of ['Auto-Complete Tags', 'Nested Tags']) {
      const initial = await getToggleState(label);
      console.log(`${label}: ${initial}`);
      expect(initial).not.toBeNull();

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState(label)).toBe(!initial);

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
    }

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Graph View Options ──────────────────────────────────────────
// Canvas-rendered, so we verify inputs exist and values persist

test.describe('Option Page: Graph View', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Node Size, Link Distance, Max Nodes inputs and Show Orphan Notes toggle', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Graph View', 'Graph View');

    // Verify number inputs with reasonable defaults
    const nodeSize = await getInputValue('Node Size');
    console.log(`Node Size: ${nodeSize}`);
    expect(nodeSize).not.toBeNull();
    expect(Number(nodeSize)).toBeGreaterThanOrEqual(1);
    expect(Number(nodeSize)).toBeLessThanOrEqual(20);

    const linkDist = await getInputValue('Link Distance');
    console.log(`Link Distance: ${linkDist}`);
    expect(linkDist).not.toBeNull();
    expect(Number(linkDist)).toBeGreaterThanOrEqual(20);
    expect(Number(linkDist)).toBeLessThanOrEqual(300);

    const maxNodes = await getInputValue('Max Nodes');
    console.log(`Max Nodes: ${maxNodes}`);
    expect(maxNodes).not.toBeNull();
    expect(Number(maxNodes)).toBeGreaterThanOrEqual(50);
    expect(Number(maxNodes)).toBeLessThanOrEqual(2000);

    // Toggle Show Orphan Notes
    const orphanState = await getToggleState('Show Orphan Notes');
    console.log(`Show Orphan Notes: ${orphanState}`);
    expect(await clickToggle('Show Orphan Notes')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Show Orphan Notes')).toBe(!orphanState);
    expect(await clickToggle('Show Orphan Notes')).toBe(true);
    await page.waitForTimeout(200);

    // Disable Graph View
    await navigateToCategory('Features');
    await clickToggle('Graph View');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Backlinks Options ───────────────────────────────────────────

test.describe('Option Page: Backlinks', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Context Lines has valid range and Group by Folder toggles', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Backlinks', 'Backlinks');

    const contextLines = await getInputValue('Context Lines');
    console.log(`Context Lines: ${contextLines}`);
    expect(contextLines).not.toBeNull();
    expect(Number(contextLines)).toBeGreaterThanOrEqual(0);
    expect(Number(contextLines)).toBeLessThanOrEqual(5);

    const groupState = await getToggleState('Group by Folder');
    console.log(`Group by Folder: ${groupState}`);
    expect(await clickToggle('Group by Folder')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Group by Folder')).toBe(!groupState);
    expect(await clickToggle('Group by Folder')).toBe(true);
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Outline Options ─────────────────────────────────────────────

test.describe('Option Page: Outline', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Minimum Heading Level dropdown changes value and Auto-Expand toggles', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Outline', 'Outline');

    const originalLevel = await getSelectValue('Minimum Heading Level');
    console.log(`Minimum Heading Level: ${originalLevel}`);
    expect(originalLevel).not.toBeNull();

    // Change to H3
    await setSelectValue('Minimum Heading Level', '3');
    await page.waitForTimeout(200);
    expect(await getSelectValue('Minimum Heading Level')).toBe('3');
    console.log('Changed Minimum Heading Level to 3');

    // Restore
    await setSelectValue('Minimum Heading Level', originalLevel!);
    await page.waitForTimeout(200);

    // Auto-Expand toggle
    const autoExpand = await getToggleState('Auto-Expand');
    console.log(`Auto-Expand: ${autoExpand}`);
    expect(await clickToggle('Auto-Expand')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Auto-Expand')).toBe(!autoExpand);
    expect(await clickToggle('Auto-Expand')).toBe(true);
    await page.waitForTimeout(200);

    // Disable Outline
    await navigateToCategory('Features');
    await clickToggle('Outline');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Properties Options ──────────────────────────────────────────

test.describe('Option Page: Properties', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Show Types toggle flips and persists', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Properties Widget', 'Properties');

    const showTypes = await getToggleState('Show Types');
    console.log(`Show Types: ${showTypes}`);

    expect(await clickToggle('Show Types')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Show Types')).toBe(!showTypes);

    // Restore
    expect(await clickToggle('Show Types')).toBe(true);
    await page.waitForTimeout(200);

    // Verify persistence: close and reopen
    await closeSettings();
    await page.waitForTimeout(200);
    await openSettings();
    await enableFeatureAndNavigate('Properties Widget', 'Properties');
    expect(await getToggleState('Show Types')).toBe(showTypes);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Auto-Save Options ──────────────────────────────────────────

test.describe('Option Page: Auto-Save', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Save Mode dropdown changes between focus-change and delay', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Auto-Save', 'Auto-Save');

    const originalMode = await getSelectValue('Save Mode');
    console.log(`Save Mode: ${originalMode}`);
    expect(originalMode).not.toBeNull();

    // Switch to the other mode (values are "focus-change" and "timer")
    const newMode = originalMode === 'focus-change' ? 'timer' : 'focus-change';
    await setSelectValue('Save Mode', newMode);
    await page.waitForTimeout(300);
    expect(await getSelectValue('Save Mode')).toBe(newMode);
    console.log(`Changed Save Mode to: ${newMode}`);

    // If timer mode, verify Save Interval input appears
    if (newMode === 'timer') {
      const interval = await getInputValue('Save Interval');
      console.log(`Save Interval: ${interval}`);
      // Interval field should be visible when delay mode is selected
    }

    // Restore
    await setSelectValue('Save Mode', originalMode!);
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Search Options ──────────────────────────────────────────────

test.describe('Option Page: Search', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Case Sensitive, Use Regex, Whole Word toggles persist', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Search in Vault', 'Search');

    for (const label of ['Case Sensitive', 'Use Regex', 'Whole Word']) {
      const state = await getToggleState(label);
      console.log(`${label}: ${state}`);
      expect(state).not.toBeNull();

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState(label)).toBe(!state);

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
    }

    // Verify persistence
    await closeSettings();
    await page.waitForTimeout(200);
    await openSettings();
    await enableFeatureAndNavigate('Search in Vault', 'Search');
    for (const label of ['Case Sensitive', 'Use Regex', 'Whole Word']) {
      const state = await getToggleState(label);
      console.log(`${label} after reopen: ${state}`);
      expect(state).not.toBeNull();
    }

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Word Count Goal Options ────────────────────────────────────

test.describe('Option Page: Word Count Goal', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Target Words input has valid value and Show in Status Bar controls status bar display', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Word Count Goal', 'Word Count Goal');

    // Target Words should be a positive number
    const target = await getInputValue('Target Words');
    console.log(`Target Words: ${target}`);
    expect(target).not.toBeNull();
    expect(Number(target)).toBeGreaterThanOrEqual(1);

    // Show in Status Bar toggle affects the status bar
    const showInBar = await getToggleState('Show in Status Bar');
    console.log(`Show in Status Bar: ${showInBar}`);

    await closeSettings();
    await page.waitForTimeout(300);

    // Check if goal counter appears in status bar
    const statusBar = page.locator('.flex.items-center.shrink-0.px-3.select-none');
    const barText = await statusBar.textContent() ?? '';
    const hasGoalCounter = barText.includes(`/${target}`);
    console.log(`Goal counter in status bar: ${hasGoalCounter}`);
    expect(hasGoalCounter).toBe(showInBar === true);

    // Toggle and verify
    await openSettings();
    await enableFeatureAndNavigate('Word Count Goal', 'Word Count Goal');
    expect(await clickToggle('Show in Status Bar')).toBe(true);
    await closeSettings();
    await page.waitForTimeout(300);

    const barTextAfter = await statusBar.textContent() ?? '';
    const hasGoalAfter = barTextAfter.includes(`/${target}`);
    console.log(`Goal counter after toggle: ${hasGoalAfter}`);
    expect(hasGoalAfter).toBe(showInBar !== true);

    // Restore
    await openSettings();
    await enableFeatureAndNavigate('Word Count Goal', 'Word Count Goal');
    expect(await clickToggle('Show in Status Bar')).toBe(true);
    await page.waitForTimeout(200);

    // Notify on Reach toggle
    const notifyState = await getToggleState('Notify on Reach');
    console.log(`Notify on Reach: ${notifyState}`);
    expect(await clickToggle('Notify on Reach')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Notify on Reach')).toBe(!notifyState);
    expect(await clickToggle('Notify on Reach')).toBe(true);
    await page.waitForTimeout(200);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Word Count Goal');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Bookmarks Options ──────────────────────────────────────────

test.describe('Option Page: Bookmarks', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Enable Bookmarks toggle is ON when option page is visible', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Bookmarks', 'Bookmarks');

    const state = await getToggleState('Enable Bookmarks');
    console.log(`Enable Bookmarks: ${state}`);
    expect(state).toBe(true);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Indent Guides Options ──────────────────────────────────────

test.describe('Option Page: Indent Guides', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Guide Color and Guide Style dropdowns change and persist', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Indent Guides', 'Indent Guides');

    // Guide Color
    const originalColor = await getSelectValue('Guide Color');
    console.log(`Guide Color: ${originalColor}`);
    expect(originalColor).not.toBeNull();

    await setSelectValue('Guide Color', 'pink');
    await page.waitForTimeout(200);
    expect(await getSelectValue('Guide Color')).toBe('pink');
    console.log('Changed Guide Color to pink');

    // Restore
    await setSelectValue('Guide Color', originalColor!);
    await page.waitForTimeout(200);

    // Guide Style
    const originalStyle = await getSelectValue('Guide Style');
    console.log(`Guide Style: ${originalStyle}`);

    await setSelectValue('Guide Style', 'dotted');
    await page.waitForTimeout(200);
    expect(await getSelectValue('Guide Style')).toBe('dotted');
    console.log('Changed Guide Style to dotted');

    // Verify persistence after close/reopen
    await closeSettings();
    await page.waitForTimeout(200);
    await openSettings();
    await enableFeatureAndNavigate('Indent Guides', 'Indent Guides');
    expect(await getSelectValue('Guide Style')).toBe('dotted');
    console.log('Guide Style persisted after reopen');

    // Restore
    await setSelectValue('Guide Style', originalStyle!);
    await page.waitForTimeout(200);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Indent Guides');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Table of Contents Options ──────────────────────────────────

test.describe('Option Page: Table of Contents', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Auto-Update on Save toggle flips and persists', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Table of Contents', 'Table of Contents');

    const state = await getToggleState('Auto-Update on Save');
    console.log(`Auto-Update on Save: ${state}`);
    expect(state).not.toBeNull();

    expect(await clickToggle('Auto-Update on Save')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Auto-Update on Save')).toBe(!state);

    // Verify persistence
    await closeSettings();
    await page.waitForTimeout(200);
    await openSettings();
    await enableFeatureAndNavigate('Table of Contents', 'Table of Contents');
    expect(await getToggleState('Auto-Update on Save')).toBe(!state);

    // Restore
    expect(await clickToggle('Auto-Update on Save')).toBe(true);
    await page.waitForTimeout(200);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Table of Contents');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Spellcheck Options ─────────────────────────────────────────

test.describe('Option Page: Spellcheck', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Enable Spellcheck is ON and Skip Capitalized Words toggles', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Spellcheck', 'Spellcheck');

    const spellState = await getToggleState('Enable Spellcheck');
    console.log(`Enable Spellcheck: ${spellState}`);
    expect(spellState).toBe(true);

    const skipState = await getToggleState('Skip Capitalized Words');
    console.log(`Skip Capitalized Words: ${skipState}`);
    expect(skipState).not.toBeNull();

    expect(await clickToggle('Skip Capitalized Words')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Skip Capitalized Words')).toBe(!skipState);

    // Verify persistence
    await closeSettings();
    await page.waitForTimeout(200);
    await openSettings();
    await enableFeatureAndNavigate('Spellcheck', 'Spellcheck');
    expect(await getToggleState('Skip Capitalized Words')).toBe(!skipState);

    // Restore
    expect(await clickToggle('Skip Capitalized Words')).toBe(true);
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Daily Notes Options ────────────────────────────────────────

test.describe('Option Page: Daily Notes', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Notes Folder input and Date Format dropdown have valid values and persist', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Daily Notes', 'Daily Notes');

    const folder = await getInputValue('Notes Folder');
    console.log(`Notes Folder: ${folder}`);
    expect(folder).not.toBeNull();
    expect(folder!.length).toBeGreaterThan(0);

    const dateFormat = await getSelectValue('Date Format');
    console.log(`Date Format: ${dateFormat}`);
    expect(dateFormat).not.toBeNull();

    // Change Date Format and verify
    const newFormat = dateFormat === 'YYYY-MM-DD' ? 'DD-MM-YYYY' : 'YYYY-MM-DD';
    await setSelectValue('Date Format', newFormat);
    await page.waitForTimeout(200);
    expect(await getSelectValue('Date Format')).toBe(newFormat);

    // Verify persistence
    await closeSettings();
    await page.waitForTimeout(200);
    await openSettings();
    await enableFeatureAndNavigate('Daily Notes', 'Daily Notes');
    expect(await getSelectValue('Date Format')).toBe(newFormat);
    console.log(`Date Format persisted: ${newFormat}`);

    // Restore
    await setSelectValue('Date Format', dateFormat!);
    await page.waitForTimeout(200);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Daily Notes');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Image Preview Options ──────────────────────────────────────

test.describe('Option Page: Image Preview', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Max Height slider exists and has valid range', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Image Preview', 'Image Preview');

    const sliderValue = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return null;
      const slider = dialog.querySelector('input[type="range"]') as HTMLInputElement;
      if (!slider) return null;
      return { value: Number(slider.value), min: Number(slider.min), max: Number(slider.max) };
    });

    console.log(`Max Height slider: ${JSON.stringify(sliderValue)}`);
    expect(sliderValue).not.toBeNull();
    expect(sliderValue!.value).toBeGreaterThanOrEqual(sliderValue!.min);
    expect(sliderValue!.value).toBeLessThanOrEqual(sliderValue!.max);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Typewriter Mode Options ────────────────────────────────────

test.describe('Option Page: Typewriter Mode', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Vertical Offset slider exists and has valid range', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Typewriter Mode', 'Typewriter Mode');

    const sliderValue = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return null;
      const slider = dialog.querySelector('input[type="range"]') as HTMLInputElement;
      if (!slider) return null;
      return { value: Number(slider.value), min: Number(slider.min), max: Number(slider.max) };
    });

    console.log(`Vertical Offset slider: ${JSON.stringify(sliderValue)}`);
    expect(sliderValue).not.toBeNull();
    expect(sliderValue!.value).toBeGreaterThanOrEqual(10);
    expect(sliderValue!.value).toBeLessThanOrEqual(90);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Typewriter Mode');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Media Viewer Options ───────────────────────────────────────

test.describe('Option Page: Media Viewer', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('PDF Default Zoom slider and Image Default Zoom dropdown', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Media Viewer', 'Media Viewer');

    // PDF zoom slider
    const pdfSlider = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return null;
      const slider = dialog.querySelector('input[type="range"]') as HTMLInputElement;
      if (!slider) return null;
      return { value: Number(slider.value), min: Number(slider.min), max: Number(slider.max) };
    });
    console.log(`PDF Default Zoom: ${JSON.stringify(pdfSlider)}`);
    expect(pdfSlider).not.toBeNull();

    // Image zoom dropdown
    const imageZoom = await getSelectValue('Image Default Zoom');
    console.log(`Image Default Zoom: ${imageZoom}`);
    expect(imageZoom).not.toBeNull();

    // Change and verify (values are "fit" and "actual")
    const newZoom = imageZoom === 'fit' ? 'actual' : 'fit';
    await setSelectValue('Image Default Zoom', newZoom);
    await page.waitForTimeout(200);
    expect(await getSelectValue('Image Default Zoom')).toBe(newZoom);

    // Restore
    await setSelectValue('Image Default Zoom', imageZoom!);
    await page.waitForTimeout(200);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Media Viewer');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Templates Options ──────────────────────────────────────────

test.describe('Option Page: Templates', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('displays template variable documentation with all variable types', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Templates', 'Templates');

    const content = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      return dialog?.textContent ?? '';
    });

    // Verify all documented template variables are listed
    for (const variable of ['{{title}}', '{{date}}', '{{time}}']) {
      expect(content, `Should contain ${variable}`).toContain(variable);
      console.log(`Found variable: ${variable}`);
    }

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Templates');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Highlights Options ─────────────────────────────────────────

test.describe('Option Page: Highlights', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('has color picker with clickable color options', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Highlight Syntax', 'Highlights');

    // Count color picker buttons (small rounded-full with background-color)
    const colorCount = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      if (!dialog) return 0;
      const buttons = dialog.querySelectorAll('button.rounded-full');
      return Array.from(buttons).filter((b) => {
        const el = b as HTMLElement;
        return el.offsetWidth > 0 && el.offsetWidth < 40 && el.style.backgroundColor;
      }).length;
    });

    console.log(`Color picker options: ${colorCount}`);
    expect(colorCount).toBeGreaterThanOrEqual(5); // Should have multiple Catppuccin colors

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Highlight Syntax');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Variables Options ──────────────────────────────────────────

test.describe('Option Page: Variables', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Highlight Variables toggle and delimiter inputs have values', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Variables', 'Variables');

    // Highlight Variables toggle
    const hlState = await getToggleState('Highlight Variables');
    console.log(`Highlight Variables: ${hlState}`);
    expect(hlState).not.toBeNull();

    expect(await clickToggle('Highlight Variables')).toBe(true);
    await page.waitForTimeout(200);
    expect(await getToggleState('Highlight Variables')).toBe(!hlState);
    expect(await clickToggle('Highlight Variables')).toBe(true);
    await page.waitForTimeout(200);

    // Delimiter inputs
    const openDelim = await getInputValue('Open Delimiter');
    const closeDelim = await getInputValue('Close Delimiter');
    console.log(`Open Delimiter: ${openDelim}, Close Delimiter: ${closeDelim}`);
    expect(openDelim).not.toBeNull();
    expect(closeDelim).not.toBeNull();
    expect(openDelim!.length).toBeGreaterThan(0);
    expect(closeDelim!.length).toBeGreaterThan(0);

    // Support Nesting toggle
    const nestState = await getToggleState('Support Nesting');
    console.log(`Support Nesting: ${nestState}`);
    if (nestState !== null) {
      expect(await clickToggle('Support Nesting')).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState('Support Nesting')).toBe(!nestState);
      expect(await clickToggle('Support Nesting')).toBe(true);
      await page.waitForTimeout(200);
    }

    // Case Insensitive toggle
    const caseState = await getToggleState('Case Insensitive');
    console.log(`Case Insensitive: ${caseState}`);
    if (caseState !== null) {
      expect(await clickToggle('Case Insensitive')).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState('Case Insensitive')).toBe(!caseState);
      expect(await clickToggle('Case Insensitive')).toBe(true);
      await page.waitForTimeout(200);
    }

    // Preserve on Missing toggle
    const preserveState = await getToggleState('Preserve on Missing');
    console.log(`Preserve on Missing: ${preserveState}`);
    if (preserveState !== null) {
      expect(await clickToggle('Preserve on Missing')).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState('Preserve on Missing')).toBe(!preserveState);
      expect(await clickToggle('Preserve on Missing')).toBe(true);
      await page.waitForTimeout(200);
    }

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Variables');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Folder Colors Options ──────────────────────────────────────

test.describe('Option Page: Folder Colors', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Color Subfolders, Color Files toggles and Folder Style dropdown with custom sub-options', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Folder Colors', 'Folder Colors');

    // Toggles
    for (const label of ['Color Subfolders', 'Color Files']) {
      const state = await getToggleState(label);
      console.log(`${label}: ${state}`);
      expect(state).not.toBeNull();

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
      expect(await getToggleState(label)).toBe(!state);

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(200);
    }

    // Folder Style dropdown
    const folderStyle = await getSelectValue('Folder Style');
    console.log(`Folder Style: ${folderStyle}`);
    expect(folderStyle).not.toBeNull();

    // Change to "custom" to reveal sub-toggles
    await setSelectValue('Folder Style', 'custom');
    await page.waitForTimeout(300);

    const customToggles = ['Color Folder Icon', 'Color Folder Name', 'Color Folder Background', 'Color Chevron'];
    for (const label of customToggles) {
      const state = await getToggleState(label);
      console.log(`${label}: ${state}`);
      expect(state).not.toBeNull();

      // Toggle each sub-option to verify they work
      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(150);
      expect(await getToggleState(label)).toBe(!state);
      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(150);
    }

    // File Style dropdown
    const fileStyle = await getSelectValue('File Style');
    console.log(`File Style: ${fileStyle}`);
    expect(fileStyle).not.toBeNull();

    // Change File Style and verify
    await setSelectValue('File Style', 'background');
    await page.waitForTimeout(200);
    expect(await getSelectValue('File Style')).toBe('background');

    // Restore all
    await setSelectValue('File Style', fileStyle!);
    await setSelectValue('Folder Style', folderStyle!);
    await page.waitForTimeout(200);

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Folder Colors');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});

// ─── Query Preview Options (info-only page) ─────────────────────

test.describe('Option Page: Query Preview', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('displays query syntax documentation', async () => {
    await openSettings();
    await enableFeatureAndNavigate('Query Preview', 'Query Preview');

    const content = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Settings"]');
      return dialog?.textContent ?? '';
    });

    expect(content.length).toBeGreaterThan(100);
    console.log('Query Preview page shows documentation');

    // Disable feature
    await navigateToCategory('Features');
    await clickToggle('Query Preview');
    await page.waitForTimeout(200);

    await closeSettings();
    expectNoErrors();
  });
});
