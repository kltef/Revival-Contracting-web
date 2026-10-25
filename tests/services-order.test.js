const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { launch } = require('./helpers');

let browser, open;
before(async () => ({ browser, open } = await launch()));
after(() => browser.close());

// orderServices lives in a private IIFE, so load a copy of the page whose initial
// call reads counts from window.__counts instead of the built-in defaults.
const HOOK = 'orderServices(SERVICE_CONFIG.DEFAULT_COUNTS);';
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(html.includes(HOOK), 'orderServices call not found in index.html; update this test');
const patched = html.replace(HOOK, 'orderServices(window.__counts);');

async function withCounts(counts) {
  const page = await open('404.html'); // any blank-ish page to get a context
  await page.evaluate(c => { window.__counts = c; }, counts);
  await page.setContent(patched);
  return page;
}

const order = page => page.$$eval('article.svc', a => a.map(x => x.dataset.service));
const eyebrows = page => page.$$eval('article.svc', a => a.map(x => x.querySelector('.eyebrow').textContent));

test('services: highest count moves to top and gets "Most requested"', async () => {
  const page = await withCounts({ bath: 50, kitchen: 10, outdoor: 5, addition: 1 });
  assert.deepEqual(await order(page), ['bath', 'kitchen', 'outdoor', 'addition']);
  const tags = await eyebrows(page);
  assert.equal(tags[0], 'Most requested');
  assert.ok(tags.slice(1).every(t => t !== 'Most requested'));
  await page.close();
});

test('services: ties keep the original page order', async () => {
  const page = await withCounts({ kitchen: 3, bath: 3, outdoor: 3, addition: 3 });
  assert.deepEqual(await order(page), ['kitchen', 'bath', 'outdoor', 'addition']);
  await page.close();
});

test('services: missing or non-numeric counts count as zero', async () => {
  const page = await withCounts({ addition: 'abc', outdoor: 2 });
  assert.deepEqual(await order(page), ['outdoor', 'kitchen', 'bath', 'addition']);
  await page.close();
});

test('services: layout alternates and non-top cards restore their own tag', async () => {
  const page = await withCounts({ outdoor: 9 });
  const flips = await page.$$eval('article.svc', a => a.map(x => x.classList.contains('flip')));
  assert.deepEqual(flips, [false, true, false, true]);
  const rows = await page.$$eval('article.svc', a => a.map(x => [x.querySelector('.eyebrow').textContent, x.dataset.tag]));
  rows.slice(1).forEach(([shown, tag]) => assert.equal(shown, tag));
  await page.close();
});
