import { chromium } from '@playwright/test';

const CDP_URL = 'http://localhost:9222';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('localhost:1420')) || context.pages()[0]!;

  const nodeId = await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_CANVAS_STORE__;
    const node = store.getState().nodes.find((n: any) => n.type === 'file' || n.type === 'text');
    return node?.id || null;
  });

  if (!nodeId) {
    console.error('FAIL: no text/file node found');
    await browser.close();
    process.exit(1);
  }

  // Simulate fit-to-content: shrink to min, wait, then two-pass measure+resize
  const doFitToContent = async (nid: string) => {
    // Step 1: Shrink to minimum
    await page.evaluate((id: string) => {
      (window as any).__ZUSTAND_CANVAS_STORE__.getState().updateNode(id, { height: 60 });
    }, nid);
    await page.waitForTimeout(200); // Wait for re-render

    // Step 2: Measure and expand (pass 1)
    const r1 = await page.evaluate((id: string) => {
      const store = (window as any).__ZUSTAND_CANVAS_STORE__;
      const node = store.getState().nodes.find((n: any) => n.id === id);
      const el = document.querySelector(`[data-node-id="${id}"]`);
      const s = el?.querySelector('.cm-scroller') as HTMLElement | null;
      const h = el?.querySelector('[data-card-header]') as HTMLElement | null;
      if (!node || !s) return { error: 'missing' };
      const headerH = h ? h.offsetHeight : 0;
      const newH = Math.round(Math.max(s.scrollHeight + headerH + 4, 60));
      const applied = Math.abs(newH - node.height) > 2;
      if (applied) store.getState().updateNode(id, { height: newH });
      return { scrollH: s.scrollHeight, headerH, computed: newH, was: node.height, applied };
    }, nid);

    await page.waitForTimeout(200); // Wait for CM6 re-render

    // Step 3: Second pass
    const r2 = await page.evaluate((id: string) => {
      const store = (window as any).__ZUSTAND_CANVAS_STORE__;
      const node = store.getState().nodes.find((n: any) => n.id === id);
      const el = document.querySelector(`[data-node-id="${id}"]`);
      const s = el?.querySelector('.cm-scroller') as HTMLElement | null;
      const h = el?.querySelector('[data-card-header]') as HTMLElement | null;
      if (!node || !s) return { error: 'missing' };
      const headerH = h ? h.offsetHeight : 0;
      const newH = Math.round(Math.max(s.scrollHeight + headerH + 4, 60));
      const applied = Math.abs(newH - node.height) > 2;
      if (applied) store.getState().updateNode(id, { height: newH });
      return { scrollH: s.scrollHeight, computed: newH, was: node.height, applied };
    }, nid);

    return { pass1: r1, pass2: r2 };
  };

  const getHeight = async (nid: string) => {
    return page.evaluate((id: string) => {
      return (window as any).__ZUSTAND_CANVAS_STORE__.getState().nodes.find((n: any) => n.id === id)?.height;
    }, nid);
  };

  const setHeight = async (nid: string, h: number) => {
    await page.evaluate(([id, height]: [string, number]) => {
      (window as any).__ZUSTAND_CANVAS_STORE__.getState().updateNode(id, { height });
    }, [nid, h] as [string, number]);
    await page.waitForTimeout(500);
  };

  let allPass = true;

  // === TEST 1: Expand from small ===
  console.log('=== TEST 1: Expand from 200px ===');
  await setHeight(nodeId, 200);
  const expand = await doFitToContent(nodeId);
  console.log('  Pass1:', JSON.stringify(expand.pass1));
  console.log('  Pass2:', JSON.stringify(expand.pass2));
  const expandH = await getHeight(nodeId);
  console.log(`  Final height: ${expandH}`);

  // Idempotency: do it again
  const expand2 = await doFitToContent(nodeId);
  const expandH2 = await getHeight(nodeId);
  console.log(`  After 2nd fit: ${expandH2} (diff: ${Math.abs(expandH - expandH2)})`);
  if (Math.abs(expandH - expandH2) > 5) {
    console.log('  FAIL: not idempotent'); allPass = false;
  } else {
    console.log('  OK: stable');
  }

  // === TEST 2: Shrink from oversized ===
  console.log('\n=== TEST 2: Shrink from 10000px ===');
  await setHeight(nodeId, 10000);
  const shrink = await doFitToContent(nodeId);
  console.log('  Pass1:', JSON.stringify(shrink.pass1));
  console.log('  Pass2:', JSON.stringify(shrink.pass2));
  const shrinkH = await getHeight(nodeId);
  console.log(`  Shrunk to: ${shrinkH}`);

  // Should be close to expandH
  const diff = Math.abs(expandH2 - shrinkH);
  console.log(`  vs expand height: diff=${diff}px`);
  if (diff > 50) {
    console.log('  FAIL: expand/shrink heights too different'); allPass = false;
  } else {
    console.log('  OK: expand and shrink converge');
  }

  // === TEST 3: Idempotency after shrink ===
  console.log('\n=== TEST 3: Idempotency after shrink ===');
  const shrink2 = await doFitToContent(nodeId);
  const shrinkH2 = await getHeight(nodeId);
  console.log(`  After 2nd fit: ${shrinkH2} (diff: ${Math.abs(shrinkH - shrinkH2)})`);
  if (Math.abs(shrinkH - shrinkH2) > 5) {
    console.log('  FAIL: not idempotent'); allPass = false;
  } else {
    console.log('  OK: stable');
  }

  // === TEST 4: Content visibility ===
  console.log('\n=== TEST 4: Content visibility ===');
  const vis = await page.evaluate((id: string) => {
    const store = (window as any).__ZUSTAND_CANVAS_STORE__;
    const node = store.getState().nodes.find((n: any) => n.id === id);
    const el = document.querySelector(`[data-node-id="${id}"]`);
    if (!el || !node) return { error: 'not found' };
    const s = el.querySelector('.cm-scroller') as HTMLElement | null;
    if (!s) return { error: 'no scroller' };
    return {
      height: node.height,
      scrollH: s.scrollHeight,
      clientH: s.clientHeight,
      scrollable: s.scrollHeight > s.clientHeight + 2,
    };
  }, nodeId);
  console.log('  ', JSON.stringify(vis));
  if ((vis as any).scrollable) { console.log('  FAIL: content still scrollable'); allPass = false; }
  else { console.log('  OK: all content visible'); }

  console.log(`\n${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  await browser.close();
  process.exit(allPass ? 0 : 1);
}

main().catch(console.error);
