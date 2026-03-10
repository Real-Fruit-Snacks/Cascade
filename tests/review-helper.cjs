// Helper script for Round 2 app review via Playwright CDP
// Usage: node tests/review-helper.js <action> [args...]

const { chromium } = require('playwright');

const CDP_URL = 'http://localhost:9222';
const SCREENSHOT_DIR = '.playwright-cli';

async function connect() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0].pages()[0];
  return { browser, page };
}

async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`Screenshot: ${path}`);
  return path;
}

async function consoleErrors(page, durationMs = 2000) {
  const errors = [];
  const handler = msg => { if (msg.type() === 'error') errors.push(msg.text()); };
  page.on('console', handler);
  await page.waitForTimeout(durationMs);
  page.removeListener('console', handler);
  return errors;
}

async function main() {
  const action = process.argv[2];
  const args = process.argv.slice(3);
  const { browser, page } = await connect();

  try {
    switch (action) {
      case 'screenshot': {
        const name = args[0] || 'capture';
        await screenshot(page, name);
        break;
      }
      case 'console': {
        const duration = parseInt(args[0]) || 3000;
        const errors = await consoleErrors(page, duration);
        console.log(`Console errors: ${errors.length}`);
        errors.forEach(e => console.log(`  ERROR: ${e}`));
        break;
      }
      case 'click': {
        const selector = args[0];
        await page.click(selector);
        console.log(`Clicked: ${selector}`);
        await page.waitForTimeout(500);
        await screenshot(page, 'after-click');
        break;
      }
      case 'type': {
        const text = args[0];
        await page.keyboard.type(text);
        console.log(`Typed: ${text}`);
        break;
      }
      case 'press': {
        const key = args[0];
        await page.keyboard.press(key);
        console.log(`Pressed: ${key}`);
        await page.waitForTimeout(300);
        break;
      }
      case 'eval': {
        const code = args[0];
        const result = await page.evaluate(code);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'snapshot': {
        // Get page structure info
        const info = await page.evaluate(() => {
          const elements = [];
          document.querySelectorAll('[class]').forEach(el => {
            if (el.className && typeof el.className === 'string' && el.className.length < 200) {
              elements.push({ tag: el.tagName, class: el.className.substring(0, 100), text: el.textContent?.substring(0, 50) });
            }
          });
          return {
            title: document.title,
            url: window.location.href,
            bodyClasses: document.body.className,
            elementCount: document.querySelectorAll('*').length,
          };
        });
        console.log(JSON.stringify(info, null, 2));
        break;
      }
      case 'accessibility': {
        const snapshot = await page.accessibility.snapshot();
        console.log(JSON.stringify(snapshot, null, 2));
        break;
      }
      case 'interact': {
        // Full interaction script passed as JSON
        const script = JSON.parse(args[0]);
        for (const step of script) {
          if (step.click) { await page.click(step.click); await page.waitForTimeout(300); }
          if (step.type) { await page.keyboard.type(step.type); }
          if (step.press) { await page.keyboard.press(step.press); await page.waitForTimeout(200); }
          if (step.wait) { await page.waitForTimeout(step.wait); }
          if (step.screenshot) { await screenshot(page, step.screenshot); }
          if (step.eval) { const r = await page.evaluate(step.eval); console.log(JSON.stringify(r)); }
        }
        break;
      }
      default:
        console.log('Usage: node review-helper.js <screenshot|console|click|type|press|eval|snapshot|accessibility|interact> [args]');
    }
  } finally {
    // Don't close the browser - it's the user's app
    process.exit(0);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
