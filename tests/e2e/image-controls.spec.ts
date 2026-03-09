import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Connect to the running Tauri app via Chrome DevTools Protocol.
// Start the app with: WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" npx tauri dev

const CDP_URL = 'http://localhost:9222';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_VAULT_PATH = path.resolve(__dirname, '../fixtures/test-vault').replace(/\//g, '\\');

let context: BrowserContext;
let page: Page;
const consoleLogs: Array<{ type: string; text: string }> = [];

test.beforeAll(async () => {
  const browser = await chromium.connectOverCDP(CDP_URL);
  context = browser.contexts()[0];
  page = context.pages()[0];

  // Capture ALL console output throughout the test run
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

// WebView2 doesn't forward Playwright mouse events to CM6 widget DOM handlers.
// Use dispatchEvent for reliable interaction with CM6 widgets.
async function clickWidget(selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    }
  }, selector);
  await page.waitForTimeout(500);
}

async function openTestVault() {
  // Close any currently open vault first
  await closeVault();

  // Open the test vault by injecting it into recent vaults and calling openVault
  const opened = await page.evaluate(async (vaultPath) => {
    try {
      // Set the test vault as the most recent vault
      localStorage.setItem('cascade-recent-vaults', JSON.stringify([vaultPath]));
      return true;
    } catch {
      return false;
    }
  }, TEST_VAULT_PATH);

  if (!opened) return false;

  // Click the vault button to open it
  const vaultButtons = page.locator('button').filter({
    has: page.locator('span.text-xs'),
  });
  await expect(vaultButtons.first()).toBeVisible({ timeout: 5000 });
  await vaultButtons.first().click();

  // Wait for vault to load (sidebar with files or editor)
  await Promise.race([
    page.waitForSelector('.cm-editor', { state: 'visible', timeout: 10000 }).catch(() => null),
    page.waitForSelector('[data-path]', { timeout: 10000 }).catch(() => null),
  ]);
  await page.waitForTimeout(2000);
  return true;
}

async function openVaultIfNeeded() {
  // Check if vault is already open (editor visible or sidebar files showing)
  const editor = page.locator('.cm-editor');
  if (await editor.isVisible().catch(() => false)) return true;

  const sidebar = page.locator('[data-path]');
  if (await sidebar.count() > 0) return true;

  const vaultButtons = page.locator('button').filter({
    has: page.locator('span.text-xs'),
  });

  if (await vaultButtons.count() > 0) {
    await vaultButtons.first().click();
    // Wait for either the editor or the welcome view (shown when no file is open)
    await Promise.race([
      page.waitForSelector('.cm-editor', { state: 'visible', timeout: 10000 }).catch(() => null),
      page.waitForSelector('[data-path]', { timeout: 10000 }).catch(() => null),
    ]);
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

async function closeVault() {
  // Check if vault is open first
  const hasEditor = await page.locator('.cm-editor').isVisible().catch(() => false);
  const hasSidebar = (await page.locator('[data-path]').count()) > 0;
  if (!hasEditor && !hasSidebar) return; // Already closed

  // Use force flag to skip confirm dialog (WebView2 can't click portal buttons).
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cascade:close-vault', { detail: { force: true } }));
  });
  await page.waitForTimeout(1500);
}

async function openFile(filename: string) {
  // Wait for sidebar to have file entries
  await page.locator('[data-path]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

  // Try exact suffix match first
  let fileItem = page.locator(`[data-path$="${filename}"]`);
  if (await fileItem.count() === 0) {
    // Try matching by visible text (filename without extension)
    const displayName = filename.replace(/\.md$/, '');
    fileItem = page.locator('[data-path]').filter({ hasText: displayName });
  }

  if (await fileItem.count() > 0) {
    await fileItem.first().click();
    await page.waitForTimeout(1000);
    // Wait for editor to become visible after opening file
    await page.locator('.cm-editor').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    return true;
  }
  return false;
}

async function openFileWithImage() {
  // Open the known test file that contains an image
  if (await openFile('image-test.md')) {
    const images = page.locator('.cm-image-widget');
    if (await images.count() > 0) return true;
  }

  // Fallback: try any .md file with images
  const fileItems = page.locator('[data-path]');
  const count = await fileItems.count();
  for (let i = 0; i < Math.min(count, 20); i++) {
    const item = fileItems.nth(i);
    const filepath = await item.getAttribute('data-path');
    if (filepath && filepath.endsWith('.md')) {
      await item.click();
      await page.waitForTimeout(1000);
      const images = page.locator('.cm-image-widget');
      if (await images.count() > 0) return true;
    }
  }
  return false;
}

async function selectImage() {
  // Ensure deselected first (mousedown toggles selection)
  const isSelected = await page.evaluate(() => !!document.querySelector('.cm-image-widget-selected'));
  if (isSelected) {
    await deselectImage();
  }
  await clickWidget('.cm-image-widget');
}

async function deselectImage() {
  // Dispatch mousedown on .cm-content (outside any image widget) to trigger deselect handler
  await page.evaluate(() => {
    const content = document.querySelector('.cm-content');
    if (content) {
      content.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(500);
}

// WebView2 doesn't forward Playwright keyboard events to CM6 keymap handlers.
// Dispatch on .cm-content where CM6 listens for key events.
async function pressEscape() {
  await page.evaluate(() => {
    const content = document.querySelector('.cm-content');
    if (content) {
      content.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', keyCode: 27,
        bubbles: true, cancelable: true,
      }));
    }
  });
  await page.waitForTimeout(500);
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe('Test Vault Setup', () => {
  test('opens the test vault', async () => {
    const opened = await openTestVault();
    expect(opened).toBe(true);

    // Vault is open — either editor or sidebar with files is visible
    const editor = page.locator('.cm-editor');
    const sidebar = page.locator('[data-path]');
    const eitherVisible = (await editor.isVisible().catch(() => false)) || (await sidebar.count() > 0);
    expect(eitherVisible).toBe(true);
  });
});

test.describe('Image Controls - Live App', () => {
  test('app renders without block decoration errors', async () => {
    await openVaultIfNeeded();
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(2000);

    const blockDecoErrors = errors.filter((e) =>
      e.includes('Block decorations may not be specified via plugins')
    );
    expect(blockDecoErrors).toEqual([]);
  });
});

test.describe('Vault Close and Reopen', () => {
  test('can close vault and reopen it', async () => {
    await openVaultIfNeeded();

    // Close the vault
    await closeVault();

    // After close, OnboardingScreen renders (no .cm-editor)
    const editorGone = !(await page.locator('.cm-editor').isVisible().catch(() => false));
    expect(editorGone).toBe(true);

    // Vault picker should show recent vaults
    const vaultButtons = page.locator('button').filter({
      has: page.locator('span.text-xs'),
    });
    await expect(vaultButtons.first()).toBeVisible({ timeout: 5000 });

    // Reopen the vault
    const reopened = await openVaultIfNeeded();
    expect(reopened).toBe(true);

    // Verify vault is open again
    const editor = page.locator('.cm-editor');
    const sidebar = page.locator('[data-path]');
    const eitherVisible = (await editor.isVisible().catch(() => false)) || (await sidebar.count() > 0);
    expect(eitherVisible).toBe(true);
  });
});

test.describe('Image Controls - Editor Interaction', () => {
  test.beforeAll(async () => {
    // Ensure the test vault is open (not a different vault from the reopen test)
    await openTestVault();
  });

  test('editor loads without image-related errors', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Open a .md file so the editor becomes visible (welcome view hides it)
    await openFile('plain-test.md');

    const editor = page.locator('.cm-editor');
    await expect(editor).toBeVisible();
    await page.waitForTimeout(1000);

    const imageErrors = errors.filter(
      (e) =>
        e.includes('Block decorations') ||
        e.includes('image-controls') ||
        e.includes('imageSelection')
    );
    expect(imageErrors).toEqual([]);
  });

  test('clicking an image shows toolbar', async () => {
    const hasImage = await openFileWithImage();
    if (!hasImage) {
      test.skip(true, 'No files with images found in vault');
      return;
    }

    await selectImage();

    // Toolbar should appear
    const toolbar = page.locator('.cm-image-toolbar');
    await expect(toolbar).toBeVisible();

    // Should have resize buttons (S, M, L, Full) + Alt + actions
    const buttons = toolbar.locator('.cm-image-toolbar-btn');
    expect(await buttons.count()).toBeGreaterThanOrEqual(4);

    // Image should have selected class
    const selected = page.locator('.cm-image-widget-selected');
    await expect(selected).toBeVisible();
  });

  test('clicking elsewhere dismisses toolbar', async () => {
    const imageWidget = page.locator('.cm-image-widget');
    if (await imageWidget.count() === 0) {
      test.skip(true, 'No images available');
      return;
    }

    await selectImage();
    const toolbar = page.locator('.cm-image-toolbar');
    await expect(toolbar).toBeVisible();

    await deselectImage();

    await expect(toolbar).not.toBeVisible();
  });

  test('deselect dismisses toolbar (Escape equivalent)', async () => {
    const imageWidget = page.locator('.cm-image-widget');
    if (await imageWidget.count() === 0) {
      test.skip(true, 'No images available');
      return;
    }

    await selectImage();

    const toolbar = page.locator('.cm-image-toolbar');
    await expect(toolbar).toBeVisible();

    // WebView2 doesn't forward synthetic KeyboardEvents to CM6's keymap system.
    // Verify deselect works via outside click (same StateEffect as Escape handler).
    await deselectImage();

    await expect(toolbar).not.toBeVisible();
  });

  test('resize preset S button constrains image width', async () => {
    const imageWidget = page.locator('.cm-image-widget');
    if (await imageWidget.count() === 0) {
      test.skip(true, 'No images available');
      return;
    }

    await selectImage();

    const toolbar = page.locator('.cm-image-toolbar');
    await expect(toolbar).toBeVisible();

    // Click "S" for small (25%) via dispatchEvent
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.cm-image-toolbar-btn');
      for (const btn of btns) {
        if (btn.textContent === 'S') {
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(500);

    // Toolbar should still be visible (selection persists after resize)
    await expect(toolbar).toBeVisible();

    // The image should now have a maxWidth style set in px
    const maxWidth = await page.evaluate(() => {
      const img = document.querySelector('.cm-image-widget img.cm-image-embed') as HTMLImageElement;
      return img ? img.style.maxWidth : '';
    });
    expect(maxWidth).toMatch(/\d+px/);
  });

  test('resize Full button removes width constraint', async () => {
    const imageWidget = page.locator('.cm-image-widget');
    if (await imageWidget.count() === 0) {
      test.skip(true, 'No images available');
      return;
    }

    await selectImage();

    const toolbar = page.locator('.cm-image-toolbar');
    await expect(toolbar).toBeVisible();

    // Click "Full"
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.cm-image-toolbar-btn');
      for (const btn of btns) {
        if (btn.textContent === 'Full') {
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(500);

    // Image should not have a pixel maxWidth
    const maxWidth = await page.evaluate(() => {
      const img = document.querySelector('.cm-image-widget img.cm-image-embed') as HTMLImageElement;
      return img ? img.style.maxWidth : '';
    });
    expect(maxWidth === '' || maxWidth === '100%').toBe(true);
  });

  test('alt text button opens inline input', async () => {
    const imageWidget = page.locator('.cm-image-widget');
    if (await imageWidget.count() === 0) {
      test.skip(true, 'No images available');
      return;
    }

    await selectImage();

    const toolbar = page.locator('.cm-image-toolbar');
    await expect(toolbar).toBeVisible();

    // Click "Alt" button
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.cm-image-toolbar-btn');
      for (const btn of btns) {
        if (btn.textContent === 'Alt') {
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(300);

    const altInput = page.locator('.cm-image-toolbar-alt-input');
    await expect(altInput).toBeVisible();

    // Type new alt text and press Enter
    await altInput.fill('test screenshot');
    await altInput.press('Enter');
    await page.waitForTimeout(500);

    // Input should be dismissed
    await expect(altInput).not.toBeVisible();
  });

  test('cursor on image line keeps image visible (no raw markdown)', async () => {
    const imageWidget = page.locator('.cm-image-widget');
    if (await imageWidget.count() === 0) {
      test.skip(true, 'No images available');
      return;
    }

    // Click near the image to place cursor on that line
    const box = await imageWidget.first().boundingBox();
    if (!box) {
      test.skip(true, 'Could not get image bounding box');
      return;
    }

    // Click just above the image
    await page.mouse.click(box.x + box.width / 2, box.y + 2);
    await page.waitForTimeout(500);

    // Image widget should still be visible (not replaced by raw markdown)
    const visibleImages = page.locator('.cm-image-widget');
    expect(await visibleImages.count()).toBeGreaterThan(0);
  });
});
