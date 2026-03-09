import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://localhost:9222');

// List all contexts and pages
const contexts = browser.contexts();
console.log(`Contexts: ${contexts.length}`);
for (let ci = 0; ci < contexts.length; ci++) {
  const pages = contexts[ci].pages();
  console.log(`  Context ${ci}: ${pages.length} pages`);
  for (let pi = 0; pi < pages.length; pi++) {
    const p = pages[pi];
    console.log(`    Page ${pi}: URL=${p.url()}, Title=${await p.title()}`);
    const bodyPreview = await p.evaluate(() => document.body?.innerText?.substring(0, 100) || '(empty)').catch(() => '(error)');
    console.log(`      Body: ${bodyPreview}`);
  }
}

// Also try fetching targets directly
try {
  const resp = await fetch('http://localhost:9222/json');
  const targets = await resp.json();
  console.log('\nCDP Targets:');
  for (const t of targets) {
    console.log(`  ${t.type}: ${t.title} - ${t.url}`);
  }
} catch (e) {
  console.log('Could not fetch targets:', e.message);
}

await browser.close();
