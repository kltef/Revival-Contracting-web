const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers');

let browser, open;
before(async () => ({ browser, open } = await launch()));
after(() => browser.close());

const activePage = page => page.$eval('.page.active', el => el.dataset.page);

test('routing: defaults to home and falls back for unknown hashes', async () => {
  let page = await open();
  assert.equal(await activePage(page), 'home');
  await page.evaluate(() => { location.hash = '#nonsense'; });
  await page.waitForFunction(() => document.querySelector('.page.active').dataset.page === 'home');
  await page.close();
});

test('routing: hash switches page and marks nav link current', async () => {
  const page = await open('index.html', '#about');
  assert.equal(await activePage(page), 'about');
  assert.equal(await page.getAttribute('.links a[href="#about"]', 'aria-current'), 'page');
  assert.equal(await page.locator('.links a[aria-current]').count(), 1);
  await page.close();
});

test('routing: #services-<key> shows services page', async () => {
  const page = await open('index.html', '#services-bath');
  assert.equal(await activePage(page), 'services');
  await page.close();
});

test('routing: #write-review opens the review form', async () => {
  const page = await open('index.html', '#write-review');
  assert.equal(await activePage(page), 'reviews');
  await page.waitForSelector('#reviewWrap.open');
  await page.close();
});

test('mobile menu toggles and closes on Escape', async () => {
  const page = await open();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click('#menuBtn');
  assert.equal(await page.getAttribute('#menuBtn', 'aria-expanded'), 'true');
  assert.equal(await page.getAttribute('#menuBtn', 'aria-label'), 'Close menu');
  await page.keyboard.press('Escape');
  assert.equal(await page.getAttribute('#menuBtn', 'aria-expanded'), 'false');
  assert.equal(await page.getAttribute('#menuBtn', 'aria-label'), 'Open menu');
  await page.close();
});

test('services: kitchen is first and labelled "Most requested"', async () => {
  const page = await open();
  const order = await page.$$eval('article.svc', a => a.map(x => x.dataset.service));
  assert.equal(order[0], 'kitchen');
  assert.equal(await page.locator('article.svc').first().locator('.eyebrow').textContent(), 'Most requested');
  assert.notEqual(await page.locator('article.svc').nth(1).locator('.eyebrow').textContent(), 'Most requested');
  // alternating layout
  const flips = await page.$$eval('article.svc', a => a.map(x => x.classList.contains('flip')));
  assert.deepEqual(flips, [false, true, false, true]);
  await page.close();
});

test('gallery: renders 10 items and filters by category', async () => {
  const page = await open('index.html', '#projects');
  assert.equal(await page.locator('#gallery .gi').count(), 10);
  await page.click('[data-f="bath"]');
  const visible = await page.$$eval('#gallery .gi:not([hidden])', els => els.map(e => e.dataset.cat));
  assert.ok(visible.length > 0 && visible.every(c => c === 'bath'));
  await page.click('[data-f="all"]');
  assert.equal(await page.locator('#gallery .gi:not([hidden])').count(), 10);
  await page.close();
});

test('gallery: clicking an item opens lightbox with caption', async () => {
  const page = await open('index.html', '#projects');
  await page.click('#gallery .gi >> nth=0');
  assert.equal(await page.$eval('#lb', d => d.open), true);
  assert.equal(await page.textContent('#lbCap'), 'Kitchen, dining room and entry remodel');
  await page.click('#lbClose');
  assert.equal(await page.$eval('#lb', d => d.open), false);
  await page.close();
});

test('before/after: tabs swap images and reset slider', async () => {
  const page = await open();
  await page.click('[data-ba="bath"]');
  await page.waitForFunction(() => document.getElementById('baBefore').getAttribute('src') === 'photos/b-before.jpg');
  assert.equal(await page.getAttribute('#baAfter', 'alt'), 'Bathroom after remodel');
  assert.equal(await page.inputValue('#baRange'), '50');
  await page.close();
});

test('before/after: slider input updates --pos', async () => {
  const page = await open();
  await page.$eval('#baRange', el => { el.value = 80; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => parseFloat(document.getElementById('ba').style.getPropertyValue('--pos')) > 79);
  await page.close();
});

test('reviews: expand/collapse toggles aria-expanded', async () => {
  const page = await open('index.html', '#reviews');
  const btn = page.locator('#p-reviews .quote .more').first();
  assert.equal(await btn.getAttribute('aria-expanded'), 'false');
  await btn.click();
  assert.equal(await btn.getAttribute('aria-expanded'), 'true');
  assert.equal(await btn.locator('span').textContent(), 'Show less');
  await btn.click();
  assert.equal(await btn.getAttribute('aria-expanded'), 'false');
  assert.equal(await btn.locator('span').textContent(), 'Read full review');
  await page.close();
});

test('forms say nothing was sent when no backend is connected', async () => {
  const page = await open('index.html', '#contact');
  assert.match(await page.textContent('#done .note'), /isn’t connected yet/);
  await page.close();
});

test('admin: without a backend explains how to connect one', async () => {
  const page = await open('admin/');
  await page.waitForSelector('h1');
  assert.equal(await page.textContent('h1'), 'Backend not connected');
  await page.close();
});
