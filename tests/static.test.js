const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));

test('every local photos/ reference in index.html exists on disk', () => {
  const refs = new Set([...html.matchAll(/photos\/[\w.\-\/]+\.(?:jpg|jpeg|png|webp|svg)/gi)].map(m => m[0]));
  assert.ok(refs.size > 0);
  const missing = [...refs].filter(r => !exists(r));
  assert.deepEqual(missing, []);
});

test('every gallery entry points to an existing photo', () => {
  const block = html.match(/const G=\[([\s\S]*?)\n\s*\];/)[1];
  const files = [...block.matchAll(/\['([^']+)'/g)].map(m => m[1]);
  assert.equal(files.length, 10);
  assert.deepEqual(files.filter(f => !exists('photos/' + f)), []);
});

test('local video and favicon files referenced by the page exist', () => {
  const refs = [...html.matchAll(/(?:src|href|poster)="((?:video|photos)\/[^"$]+|favicon\.svg)"/g)].map(m => m[1]);
  const missing = [...new Set(refs)].filter(r => !exists(r));
  assert.deepEqual(missing, []);
});

test('every in-page #link targets a real page, service or review shortcut', () => {
  const pages = new Set([...html.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]));
  const services = new Set([...html.matchAll(/data-service="([^"]+)"/g)].map(m => m[1]));
  const targets = new Set([...html.matchAll(/href="#([^"]*)"/g)].map(m => m[1]).filter(Boolean));
  const bad = [...targets].filter(t => {
    if (pages.has(t)) return false;
    const s = t.match(/^services-(\w+)$/);
    if (s) return !services.has(s[1]);
    return !/^write-review(-\w+)?$/.test(t);
  });
  assert.deepEqual(bad, []);
});

test('every <img> has an alt attribute', () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert.ok(imgs.length > 0);
  assert.deepEqual(imgs.filter(i => !/\salt=/.test(i)), []);
});

test('element ids are unique', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, []);
});
