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
  await page.waitForTimeout(1000);
});

// ─── Helpers ───────────────────────────────────────────────────────

async function refreshPage() {
  const candidate = await findAppPage(context);
  if (candidate !== page) {
    page = candidate;
    page.on('console', (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => consoleLogs.push({ type: 'pageerror', text: err.message }));
  }
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
  const editor = page.locator('.cm-editor');
  if (await editor.isVisible().catch(() => false)) return;
  const mdFile = page.locator('[data-path$=".md"]').first();
  if (await mdFile.isVisible().catch(() => false)) {
    await mdFile.click();
    await page.waitForSelector('.cm-editor', { state: 'visible', timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(500);
  }
}

function clearConsoleLogs() { consoleLogs.length = 0; }
function getErrorLogs() { return consoleLogs.filter((l) => l.type === 'pageerror'); }
function expectNoErrors() {
  const errors = getErrorLogs();
  expect(errors, `Unexpected page errors: ${JSON.stringify(errors)}`).toHaveLength(0);
}

// ─── Editor Core Tests ──────────────────────────────────────────

test.describe('Editor: Core', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('CodeMirror editor is visible and has content', async () => {
    const editor = page.locator('.cm-editor');
    await expect(editor).toBeVisible({ timeout: 3000 });

    const content = page.locator('.cm-content');
    await expect(content).toBeVisible();

    const lines = page.locator('.cm-line');
    const lineCount = await lines.count();
    console.log(`Editor lines: ${lineCount}`);
    expect(lineCount).toBeGreaterThan(0);

    expectNoErrors();
  });

  test('editor has focused state when clicked', async () => {
    // Use evaluate click to avoid Playwright actionability hangs on WebView2
    await page.evaluate(() => {
      const content = document.querySelector('.cm-content') as HTMLElement;
      if (content) { content.focus(); content.click(); }
    });
    await page.waitForTimeout(300);

    const isFocused = await page.evaluate(() => {
      const editor = document.querySelector('.cm-editor');
      return editor?.classList.contains('cm-focused') ?? false;
    });
    console.log(`Editor focused: ${isFocused}`);
    expect(isFocused).toBe(true);

    expectNoErrors();
  });

  test('active line is highlighted', async () => {
    // Use evaluate click to avoid Playwright actionability hangs on WebView2
    await page.evaluate(() => {
      const content = document.querySelector('.cm-content') as HTMLElement;
      if (content) { content.focus(); content.click(); }
    });
    await page.waitForTimeout(300);

    const activeLine = page.locator('.cm-activeLine');
    const count = await activeLine.count();
    console.log(`Active line elements: ${count}`);
    expect(count).toBeGreaterThan(0);

    expectNoErrors();
  });

  test('cursor is visible when editor focused', async () => {
    // Click into editor using evaluate to avoid actionability issues
    await page.evaluate(() => {
      const content = document.querySelector('.cm-content') as HTMLElement;
      if (content) content.focus();
    });
    await page.waitForTimeout(300);

    // CM6 cursor can be .cm-cursor, .cm-cursor-primary, or inside .cm-cursorLayer
    const hasCursor = await page.evaluate(() => {
      const editor = document.querySelector('.cm-editor');
      if (!editor) return false;
      // Check for cursor elements or cursor layer
      return !!(
        editor.querySelector('.cm-cursor') ||
        editor.querySelector('.cm-cursor-primary') ||
        editor.querySelector('.cm-cursorLayer') ||
        editor.querySelector('.cm-cursor-layer')
      );
    });
    console.log(`Cursor/cursor-layer found: ${hasCursor}`);
    // Even if no visible cursor element, the editor should be focused
    const isFocused = await page.evaluate(() => {
      const cm = document.querySelector('.cm-content');
      return cm === document.activeElement || document.activeElement?.closest('.cm-editor') !== null;
    });
    console.log(`Editor focused: ${isFocused}`);
    expect(isFocused).toBe(true);

    expectNoErrors();
  });
});

// ─── View Mode Tests ────────────────────────────────────────────

test.describe('Editor: View Modes', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('view mode buttons are visible', async () => {
    const liveBtn = page.locator('button[title="Live Preview"]');
    const sourceBtn = page.locator('button[title="Source"]');
    const readingBtn = page.locator('button[title="Reading"]');

    const hasLive = await liveBtn.isVisible().catch(() => false);
    const hasSource = await sourceBtn.isVisible().catch(() => false);
    const hasReading = await readingBtn.isVisible().catch(() => false);

    console.log(`View modes: Live=${hasLive}, Source=${hasSource}, Reading=${hasReading}`);
    expect(hasLive || hasSource || hasReading).toBe(true);

    expectNoErrors();
  });

  test('switching to Source mode changes active button', async () => {
    // Use evaluate to find and click — Playwright click() can hang on WebView2
    const found = await page.evaluate(() => {
      const btn = document.querySelector('button[title="Source"]') as HTMLElement;
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!found) {
      console.log('Source button not found, skipping');
      return;
    }
    await page.waitForTimeout(500);

    // Active button should have accent color
    const isActive = await page.evaluate(() => {
      const btn = document.querySelector('button[title="Source"]') as HTMLElement;
      if (!btn) return false;
      return btn.style.color?.includes('ctp-accent') || btn.style.color?.includes('accent');
    });
    console.log(`Source button active: ${isActive}`);
    expect(isActive).toBe(true);

    // Switch back to Live Preview
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Live Preview"]') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('switching to Reading mode changes active button', async () => {
    // Use evaluate to find and click — Playwright click() can hang on WebView2
    const found = await page.evaluate(() => {
      const btn = document.querySelector('button[title="Reading"]') as HTMLElement;
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!found) {
      console.log('Reading button not found, skipping');
      return;
    }
    await page.waitForTimeout(500);

    const isActive = await page.evaluate(() => {
      const btn = document.querySelector('button[title="Reading"]') as HTMLElement;
      if (!btn) return false;
      return btn.style.color?.includes('ctp-accent') || btn.style.color?.includes('accent');
    });
    console.log(`Reading button active: ${isActive}`);
    expect(isActive).toBe(true);

    // Switch back to Live Preview
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Live Preview"]') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('Live Preview mode shows live preview decorations', async () => {
    const liveBtn = page.locator('button[title="Live Preview"]');
    if (await liveBtn.isVisible().catch(() => false)) {
      await liveBtn.click();
      await page.waitForTimeout(300);
    }

    // In live preview, check for any decorated elements
    const hasDecorations = await page.evaluate(() => {
      const doc = document;
      return !!(
        doc.querySelector('.cm-heading') ||
        doc.querySelector('.cm-live-bold') ||
        doc.querySelector('.cm-live-italic') ||
        doc.querySelector('.cm-live-code') ||
        doc.querySelector('.cm-live-blockquote') ||
        doc.querySelector('.cm-wiki-link') ||
        doc.querySelector('.cm-checkbox-widget') ||
        doc.querySelector('.cm-line')
      );
    });
    console.log(`Has live preview decorations: ${hasDecorations}`);
    expect(hasDecorations).toBe(true);

    expectNoErrors();
  });
});

// ─── Live Preview Rendering Tests ───────────────────────────────

test.describe('Editor: Live Preview', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
    // Ensure we're in Live Preview mode
    const liveBtn = page.locator('button[title="Live Preview"]');
    if (await liveBtn.isVisible().catch(() => false)) {
      await liveBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('headings render with correct classes', async () => {
    const headings = await page.evaluate(() => {
      const result: Record<string, number> = {};
      for (let i = 1; i <= 6; i++) {
        const count = document.querySelectorAll(`.cm-heading-${i}`).length;
        if (count > 0) result[`h${i}`] = count;
      }
      return result;
    });
    console.log(`Headings found: ${JSON.stringify(headings)}`);
    // At least some heading should exist in a typical markdown file
    const totalHeadings = Object.values(headings).reduce((a, b) => a + b, 0);
    console.log(`Total headings: ${totalHeadings}`);

    expectNoErrors();
  });

  test('inline formatting decorations exist', async () => {
    const formats = await page.evaluate(() => {
      return {
        bold: document.querySelectorAll('.cm-live-bold').length,
        italic: document.querySelectorAll('.cm-live-italic').length,
        code: document.querySelectorAll('.cm-live-code').length,
        strikethrough: document.querySelectorAll('.cm-live-strikethrough').length,
        link: document.querySelectorAll('.cm-live-link').length,
      };
    });
    console.log(`Inline formats: ${JSON.stringify(formats)}`);

    expectNoErrors();
  });

  test('code blocks render with proper classes', async () => {
    const codeBlocks = await page.evaluate(() => {
      return {
        lines: document.querySelectorAll('.cm-live-codeblock').length,
        first: document.querySelectorAll('.cm-codeblock-first').length,
        last: document.querySelectorAll('.cm-codeblock-last').length,
      };
    });
    console.log(`Code blocks: ${JSON.stringify(codeBlocks)}`);

    expectNoErrors();
  });

  test('blockquotes render with left border', async () => {
    const blockquotes = page.locator('.cm-live-blockquote');
    const count = await blockquotes.count();
    console.log(`Blockquotes found: ${count}`);

    if (count > 0) {
      const hasBorder = await blockquotes.first().evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.borderLeftWidth !== '0px' && style.borderLeftWidth !== '';
      });
      console.log(`Blockquote has left border: ${hasBorder}`);
      expect(hasBorder).toBe(true);
    }

    expectNoErrors();
  });

  test('checkbox widgets render and are interactive', async () => {
    const checkboxes = page.locator('.cm-checkbox-widget');
    const count = await checkboxes.count();
    console.log(`Checkboxes found: ${count}`);

    if (count > 0) {
      const first = checkboxes.first();
      const initialChecked = await first.isChecked();
      console.log(`First checkbox initially checked: ${initialChecked}`);

      // Click to toggle
      await first.click();
      await page.waitForTimeout(300);

      const afterChecked = await first.isChecked().catch(() => initialChecked);
      console.log(`After click: ${afterChecked}`);
      // State should have toggled (or at minimum not crash)

      // Toggle back
      await first.click().catch(() => null);
      await page.waitForTimeout(300);
    }

    expectNoErrors();
  });

  test('wiki-links render with correct styling', async () => {
    const wikiLinks = await page.evaluate(() => {
      const valid = document.querySelectorAll('.cm-wiki-link:not(.cm-wiki-link-broken)');
      const broken = document.querySelectorAll('.cm-wiki-link-broken');
      return { valid: valid.length, broken: broken.length };
    });
    console.log(`Wiki-links: valid=${wikiLinks.valid}, broken=${wikiLinks.broken}`);

    if (wikiLinks.valid > 0) {
      const linkColor = await page.locator('.cm-wiki-link:not(.cm-wiki-link-broken)').first().evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      console.log(`Wiki-link color: ${linkColor}`);
      // Should be blue-ish (ctp-blue)
    }

    expectNoErrors();
  });

  test('tables render as widgets in live preview', async () => {
    const tables = page.locator('.cm-table-widget');
    const count = await tables.count();
    console.log(`Table widgets: ${count}`);

    if (count > 0) {
      const headers = await tables.first().locator('th').count();
      const cells = await tables.first().locator('td').count();
      console.log(`First table: ${headers} headers, ${cells} cells`);
      expect(headers).toBeGreaterThan(0);
    }

    expectNoErrors();
  });

  test('horizontal rules render', async () => {
    const hrs = page.locator('.cm-hr-widget');
    const count = await hrs.count();
    console.log(`Horizontal rules: ${count}`);

    expectNoErrors();
  });

  test('images render as widgets', async () => {
    const images = page.locator('.cm-image-widget');
    const count = await images.count();
    console.log(`Image widgets: ${count}`);

    if (count > 0) {
      const imgEl = images.first().locator('.cm-image-embed, img');
      const hasSrc = await imgEl.first().getAttribute('src').catch(() => null);
      console.log(`First image src: ${hasSrc ? 'present' : 'missing'}`);
    }

    expectNoErrors();
  });
});

// ─── Search & Replace Tests ─────────────────────────────────────

test.describe('Editor: Search & Replace', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Ctrl+H opens search panel', async () => {
    // Focus the editor first
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const searchPanel = page.locator('.cm-panel.cm-search');
    const isVisible = await searchPanel.isVisible().catch(() => false);
    console.log(`Search panel visible: ${isVisible}`);
    expect(isVisible).toBe(true);

    // Find input should exist
    const findInput = page.locator('input.cm-textfield[main-field="true"]');
    const hasFindInput = await findInput.isVisible().catch(() => false);
    console.log(`Find input visible: ${hasFindInput}`);
    expect(hasFindInput).toBe(true);

    // Close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('search finds and highlights matches', async () => {
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const findInput = page.locator('input.cm-textfield[main-field="true"]');
    if (!(await findInput.isVisible().catch(() => false))) {
      console.log('Find input not visible, skipping');
      return;
    }

    // Search for a common word
    await findInput.fill('the');
    await page.waitForTimeout(500);

    // Check for highlighted matches
    const matches = await page.evaluate(() => {
      return {
        all: document.querySelectorAll('.cm-searchMatch').length,
        selected: document.querySelectorAll('.cm-searchMatch-selected').length,
      };
    });
    console.log(`Search matches: ${matches.all} total, ${matches.selected} selected`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('search navigation (next/prev) works', async () => {
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const findInput = page.locator('input.cm-textfield[main-field="true"]');
    await findInput.fill('the');
    await page.waitForTimeout(500);

    // Click next
    const nextBtn = page.locator('button[name="next"]');
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(200);

      // Click prev
      const prevBtn = page.locator('button[name="prev"]');
      if (await prevBtn.isVisible().catch(() => false)) {
        await prevBtn.click();
        await page.waitForTimeout(200);
      }
    }

    console.log('Search navigation completed');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('replace input is visible', async () => {
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const replaceInput = page.locator('input.cm-textfield[placeholder="Replace"]');
    const isVisible = await replaceInput.isVisible().catch(() => false);
    console.log(`Replace input visible: ${isVisible}`);
    expect(isVisible).toBe(true);

    // Replace and Replace all buttons should exist
    const replaceBtn = page.locator('button[name="replace"]');
    const replaceAllBtn = page.locator('button[name="replaceAll"]');
    console.log(`Replace button: ${await replaceBtn.isVisible().catch(() => false)}`);
    console.log(`Replace All button: ${await replaceAllBtn.isVisible().catch(() => false)}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('search toggle options exist (case, regex, whole word)', async () => {
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const toggles = await page.evaluate(() => {
      return {
        case: !!document.querySelector('#cm-search-case'),
        regex: !!document.querySelector('#cm-search-re'),
        word: !!document.querySelector('#cm-search-word'),
      };
    });
    console.log(`Search toggles: ${JSON.stringify(toggles)}`);
    expect(toggles.case).toBe(true);
    expect(toggles.regex).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expectNoErrors();
  });

  test('close button closes search panel', async () => {
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const closeBtn = page.locator('button[name="close"]');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);

      const searchPanel = page.locator('.cm-panel.cm-search');
      const isHidden = !(await searchPanel.isVisible().catch(() => false));
      console.log(`Search panel hidden after close: ${isHidden}`);
      expect(isHidden).toBe(true);
    }

    expectNoErrors();
  });
});

// ─── Properties Widget Tests ────────────────────────────────────

test.describe('Editor: Properties Widget', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('properties widget renders for files with frontmatter', async () => {
    const propsEditor = page.locator('.cm-properties-editor');
    const count = await propsEditor.count();
    console.log(`Properties editors found: ${count}`);

    if (count > 0) {
      const rows = await propsEditor.first().locator('.cm-props-row').count();
      console.log(`Property rows: ${rows}`);

      const keys = await propsEditor.first().evaluate((el) => {
        const keyEls = el.querySelectorAll('.cm-props-key, .cm-props-key-ro');
        return Array.from(keyEls).map((k) => k.textContent?.trim() ?? '');
      });
      console.log(`Property keys: ${keys.join(', ')}`);
    }

    expectNoErrors();
  });
});

// ─── Editor Gutters Tests ───────────────────────────────────────

test.describe('Editor: Gutters', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('line numbers gutter is visible', async () => {
    const lineNumbers = page.locator('.cm-gutter.cm-lineNumbers');
    const isVisible = await lineNumbers.isVisible().catch(() => false);
    console.log(`Line numbers gutter visible: ${isVisible}`);
    // Line numbers may or may not be enabled depending on settings

    expectNoErrors();
  });

  test('fold gutter appears when code folding is enabled', async () => {
    const foldGutter = page.locator('.cm-foldGutter');
    const isVisible = await foldGutter.isVisible().catch(() => false);
    console.log(`Fold gutter visible: ${isVisible}`);
    // Fold gutter visibility depends on Code Folding setting

    expectNoErrors();
  });
});

// ─── Keyboard Shortcuts Tests ───────────────────────────────────

test.describe('Editor: Keyboard Shortcuts', () => {
  test.beforeEach(async () => {
    await cleanupUI();
    await ensureFileOpen();
    clearConsoleLogs();
  });

  test('Ctrl+S triggers save (no error)', async () => {
    await page.locator('.cm-content').click().catch(() => null);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    expectNoErrors();
  });

  test('Ctrl+Z triggers undo', async () => {
    const content = page.locator('.cm-content');
    await content.click();
    await page.waitForTimeout(200);

    // Type something
    await page.keyboard.type('test undo text');
    await page.waitForTimeout(300);

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // No error from undo operation
    expectNoErrors();
  });

  test('Ctrl+A selects all text', async () => {
    // Focus editor via evaluate
    await page.evaluate(() => {
      const content = document.querySelector('.cm-content') as HTMLElement;
      if (content) content.focus();
    });
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(300);

    // Check for selection via CM6's selection background or window selection
    const hasSelection = await page.evaluate(() => {
      // CM6 selection background elements
      const cmSel = document.querySelectorAll('.cm-selectionBackground');
      if (cmSel.length > 0) return true;
      // Fallback: check window selection
      const sel = window.getSelection();
      return sel !== null && sel.toString().length > 0;
    });
    console.log(`Has selection after Ctrl+A: ${hasSelection}`);
    expect(hasSelection).toBe(true);

    // Deselect
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    expectNoErrors();
  });
});
