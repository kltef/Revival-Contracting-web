const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers');

let browser, open;
before(async () => ({ browser, open } = await launch()));
after(() => browser.close());

test('404 page: has heading and home link', async () => {
  const page = await open('404.html');
  assert.equal(await page.textContent('h1'), 'Page not found');
  assert.ok(await page.getAttribute('#home', 'href'));
  await page.close();
});

test('404 page: home link walks up to site root from the 404.html path', async () => {
  const page = await open('404.html');
  const href = await page.$eval('#home', a => a.getAttribute('href'));
  assert.ok(href.endsWith('/'));
  assert.ok(!href.includes('404.html'));
  await page.close();
});
