const { chromium } = require('playwright');
const action = process.argv[2];

async function run() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  switch (action) {
    case 'screenshot': {
      const name = process.argv[3] || 'capture';
      await page.screenshot({ path: `.playwright-cli/${name}.png` });
      console.log(`Screenshot: .playwright-cli/${name}.png`);
      break;
    }
    case 'dismiss-modal': {
      const modal = await page.$('.modal-overlay');
      if (modal) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        console.log('Modal dismissed');
      } else {
        console.log('No modal found');
      }
      break;
    }
    case 'check-modal': {
      const info = await page.evaluate(() => {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return { modalVisible: false };
        const input = modal.querySelector('input');
        const buttons = [...modal.querySelectorAll('button')];
        return {
          modalVisible: true,
          inputValue: input ? input.value : '',
          buttons: buttons.map(b => ({ text: b.textContent, disabled: b.disabled }))
        };
      });
      console.log(JSON.stringify(info, null, 2));
      break;
    }
    case 'new-file': {
      const name = process.argv[3] || 'test-file';
      const newFileBtn = page.locator('button[title="New file"]');
      await newFileBtn.click();
      await page.waitForTimeout(500);
      const input = page.locator('.modal-overlay input[type="text"]');
      await input.fill(name);
      await page.waitForTimeout(300);
      await page.screenshot({ path: '.playwright-cli/r2-new-file-filled.png' });
      // Click Create button
      const createBtn = page.locator('.modal-overlay button:has-text("Create")');
      const disabled = await createBtn.isDisabled();
      console.log(`Create button disabled: ${disabled}`);
      if (!disabled) {
        await createBtn.click();
        await page.waitForTimeout(500);
        console.log('File created');
      } else {
        console.log('Create button is disabled - cannot create file');
        await page.screenshot({ path: '.playwright-cli/r2-create-disabled.png' });
      }
      break;
    }
    case 'type-markdown': {
      await page.click('.cm-content');
      await page.waitForTimeout(200);
      const lines = [
        '# Test Heading',
        '',
        'This is a **bold** and *italic* test.',
        '',
        '## Code Block',
        '',
        '```javascript',
        'console.log("hello");',
        '```',
        '',
        '## Links and Tags',
        '',
        '- [[Git Commands]]',
        '- #test-tag',
        '- [External](https://example.com)',
      ];
      for (const line of lines) {
        await page.keyboard.type(line);
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: '.playwright-cli/r2-typed-content.png' });
      console.log('Content typed and screenshot saved');
      break;
    }
    case 'check-errors': {
      const logs = await page.evaluate(() => {
        const results = [];
        // Check for error boundaries
        const errBounds = document.querySelectorAll('[class*="error"]');
        errBounds.forEach(el => {
          if (el.textContent && el.textContent.includes('went wrong')) {
            results.push('Error boundary: ' + el.textContent.substring(0, 100));
          }
        });
        return results;
      });
      console.log('UI errors:', logs.length);
      logs.forEach(l => console.log('  ', l));
      break;
    }
    case 'test-formatting': {
      // Select text and apply bold
      await page.click('.cm-content');
      await page.waitForTimeout(200);
      // Ctrl+A to select all, then check state
      await page.keyboard.press('Control+End');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Testing formatting: ');
      // Type and bold
      await page.keyboard.press('Control+b');
      await page.keyboard.type('bold text');
      await page.keyboard.press('Control+b');
      await page.keyboard.type(' and ');
      await page.keyboard.press('Control+i');
      await page.keyboard.type('italic text');
      await page.keyboard.press('Control+i');
      await page.waitForTimeout(300);
      await page.screenshot({ path: '.playwright-cli/r2-formatting.png' });
      console.log('Formatting test done');
      break;
    }
    case 'test-save': {
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);
      await page.screenshot({ path: '.playwright-cli/r2-after-save.png' });
      // Check if dirty indicator cleared
      const dirty = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[class*="tab"]');
        let hasDirty = false;
        tabs.forEach(t => {
          if (t.textContent && t.textContent.includes('●')) hasDirty = true;
        });
        return hasDirty;
      });
      console.log('Has dirty indicator after save:', dirty);
      break;
    }
    case 'console-errors': {
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
      await page.waitForTimeout(parseInt(process.argv[3]) || 3000);
      console.log(`Errors: ${errors.length}`);
      errors.forEach(e => console.log(`  ${e}`));
      break;
    }
    default:
      console.log('Actions: screenshot, dismiss-modal, check-modal, new-file, type-markdown, check-errors, test-formatting, test-save, console-errors');
  }

  process.exit(0);
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
