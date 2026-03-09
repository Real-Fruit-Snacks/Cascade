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
    return btn.style.backgroundColor.includes('var(--ctp-accent)');
  }, labelText);
}

/** Check if a feature option page appears in the settings sidebar */
async function featurePageVisible(label: string): Promise<boolean> {
  const btn = page.locator('.settings-sidebar-scroll button').filter({ hasText: label });
  return (await btn.count()) > 0;
}

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Feature toggle test factory ─────────────────────────────────
// Each feature toggle in the Features section should:
// 1. Toggle ON → its option page appears in sidebar
// 2. Toggle OFF → its option page disappears from sidebar
// 3. No console errors

interface FeatureTest {
  label: string;              // Toggle label in Features section
  optionPageLabel: string;    // Expected option page label in sidebar
  defaultOn: boolean;         // Whether the feature is ON by default
}

const FEATURES_WITH_OPTION_PAGES: FeatureTest[] = [
  { label: 'Auto-Save', optionPageLabel: 'Auto-Save', defaultOn: true },
  { label: 'Wiki Links', optionPageLabel: 'Wiki Links', defaultOn: true },
  { label: 'Live Preview', optionPageLabel: 'Live Preview', defaultOn: true },
  { label: 'Tags', optionPageLabel: 'Tags', defaultOn: true },
  { label: 'Graph View', optionPageLabel: 'Graph View', defaultOn: false },
  { label: 'Backlinks', optionPageLabel: 'Backlinks', defaultOn: true },
  { label: 'Outline', optionPageLabel: 'Outline', defaultOn: false },
  { label: 'Folder Colors', optionPageLabel: 'Folder Colors', defaultOn: false },
  { label: 'Code Folding', optionPageLabel: 'Code Folding', defaultOn: false },
  { label: 'Highlight Syntax', optionPageLabel: 'Highlights', defaultOn: false },
  { label: 'Properties Widget', optionPageLabel: 'Properties', defaultOn: true },
  { label: 'Status Bar', optionPageLabel: 'Status Bar', defaultOn: true },
  { label: 'Templates', optionPageLabel: 'Templates', defaultOn: false },
  { label: 'Search in Vault', optionPageLabel: 'Search', defaultOn: true },
  { label: 'Focus Mode', optionPageLabel: 'Focus Mode', defaultOn: false },
  { label: 'Word Count Goal', optionPageLabel: 'Word Count Goal', defaultOn: false },
  { label: 'Bookmarks', optionPageLabel: 'Bookmarks', defaultOn: true },
  { label: 'Typewriter Mode', optionPageLabel: 'Typewriter Mode', defaultOn: false },
  { label: 'Indent Guides', optionPageLabel: 'Indent Guides', defaultOn: false },
  { label: 'Image Preview', optionPageLabel: 'Image Preview', defaultOn: true },
  { label: 'Query Preview', optionPageLabel: 'Query Preview', defaultOn: false },
  { label: 'Table of Contents', optionPageLabel: 'Table of Contents', defaultOn: false },
  { label: 'Media Viewer', optionPageLabel: 'Media Viewer', defaultOn: false },
  { label: 'Variables', optionPageLabel: 'Variables', defaultOn: false },
  { label: 'Daily Notes', optionPageLabel: 'Daily Notes', defaultOn: false },
  { label: 'Spellcheck', optionPageLabel: 'Spellcheck', defaultOn: true },
];

// Features that are pure toggles with no option page
const FEATURES_NO_OPTION_PAGE = [
  'Math Preview',
  'Callout Preview',
  'Mermaid Diagrams',
];

test.describe('Settings: Features', () => {
  test.beforeEach(async () => {
    await ensureFileOpen();
    clearConsoleLogs();
  });

  // Test each feature toggle that has an option page
  for (const feature of FEATURES_WITH_OPTION_PAGES) {
    test(`${feature.label} - toggle shows/hides option page in sidebar`, async () => {
      await openSettings();
      await navigateToCategory('Features');

      // Get initial toggle state
      const initial = await getToggleState(feature.label);
      console.log(`${feature.label} initially: ${initial}`);

      // Check if option page is visible matching initial state
      const initialPageVisible = await featurePageVisible(feature.optionPageLabel);
      console.log(`  Option page "${feature.optionPageLabel}" visible: ${initialPageVisible}`);

      // If feature is ON, option page should be visible, and vice versa
      if (initial !== null) {
        expect(initialPageVisible).toBe(initial);
      }

      // Toggle the feature
      expect(await clickToggle(feature.label)).toBe(true);
      await page.waitForTimeout(300);

      // Verify option page visibility flipped
      const afterTogglePageVisible = await featurePageVisible(feature.optionPageLabel);
      console.log(`  After toggle, option page visible: ${afterTogglePageVisible}`);
      expect(afterTogglePageVisible).toBe(!initialPageVisible);

      // Toggle back to restore
      expect(await clickToggle(feature.label)).toBe(true);
      await page.waitForTimeout(300);

      // Verify restored
      const restoredPageVisible = await featurePageVisible(feature.optionPageLabel);
      expect(restoredPageVisible).toBe(initialPageVisible);

      await closeSettings();
      expectNoErrors();
    });
  }

  // Test features without option pages (just verify toggle works without errors)
  for (const label of FEATURES_NO_OPTION_PAGE) {
    test(`${label} - toggle works without errors`, async () => {
      await openSettings();
      await navigateToCategory('Features');

      const initial = await getToggleState(label);
      console.log(`${label} initially: ${initial}`);

      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(300);

      const after = await getToggleState(label);
      expect(after).toBe(!initial);

      // Toggle back
      expect(await clickToggle(label)).toBe(true);
      await page.waitForTimeout(300);

      const restored = await getToggleState(label);
      expect(restored).toBe(initial);

      await closeSettings();
      expectNoErrors();
    });
  }
});
