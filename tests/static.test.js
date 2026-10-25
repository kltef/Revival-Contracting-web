const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { launch, root } = require('./helpers');

const exists = rel => fs.existsSync(path.join(root, 'public', rel));
const sources = dir => fs.readdirSync(path.join(root, dir), { recursive: true })
  .filter(f => /\.(jsx?|mjs|css)$/.test(f)).map(f => fs.readFileSync(path.join(root, dir, f), 'utf8')).join('\n');
const src = sources('src');

test('every photos/ reference in the source exists in public/', () => {
  const refs = new Set([...src.matchAll(/photos\/[\w.\-\/]+\.(?:jpg|jpeg|png|webp|svg)/gi)].map(m => m[0]));
  assert.ok(refs.size > 0);
  assert.deepEqual([...refs].filter(r => !exists(r)), []);
});

test('every built-in gallery photo exists', async () => {
  const { DEFAULT_GALLERY, CATEGORIES } = await import('../src/lib/gallery.mjs');
  assert.equal(DEFAULT_GALLERY.length, 10);
  assert.deepEqual(DEFAULT_GALLERY.filter(g => !exists(g.src)), []);
  const cats = CATEGORIES.map(c => c[0]);
  assert.deepEqual(DEFAULT_GALLERY.filter(g => !cats.includes(g.category)), []);
});

test('local files referenced by the HTML entry points exist', () => {
  for (const f of ['index.html', 'admin/index.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="\/((?:video|photos)\/[^"]+|favicon\.svg)"/g)].map(m => m[1]);
    assert.deepEqual(refs.filter(r => !exists(r)), [], f);
  }
});

let browser, open;
before(async () => ({ browser, open } = await launch()));
after(() => browser.close());

test('every in-page #link targets a real page, service or review shortcut', async () => {
  const page = await open();
  const { pages, services, targets } = await page.evaluate(() => ({
    pages: [...document.querySelectorAll('[data-page]')].map(e => e.dataset.page),
    services: [...document.querySelectorAll('[data-service]')].map(e => e.dataset.service),
    targets: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(Boolean),
  }));
  const bad = [...new Set(targets)].filter(t => {
    if (pages.includes(t)) return false;
    const s = t.match(/^services-(\w+)$/);
    if (s) return !services.includes(s[1]);
    return !/^write-review(-\w+)?$/.test(t);
  });
  assert.deepEqual(bad, []);
  await page.close();
});

test('every <img> has an alt attribute', async () => {
  const page = await open('index.html', '#projects');
  const missing = await page.$$eval('img', imgs => imgs.filter(i => !i.hasAttribute('alt')).map(i => i.outerHTML));
  assert.ok(await page.locator('img').count() > 0);
  assert.deepEqual(missing, []);
  await page.close();
});

test('element ids are unique', async () => {
  const page = await open();
  const ids = await page.$$eval('[id]', els => els.map(e => e.id));
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  await page.close();
});
