// The scripts Claude's website-edit routine runs (docs/website-edit-routine.md), against a throwaway git repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { serialize, CONTENT_FILE } from '../src/lib/content-edit.mjs';

const root = path.resolve(import.meta.dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(root, CONTENT_FILE), 'utf8'));
const run = promisify(execFile);

// a repo with main holding the current content, and a branch with the given edits
function repo(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-repo-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  const write = (f, data) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), data); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T');
  write(CONTENT_FILE, serialize(site));
  write('public/photos/k-1.jpg', 'jpeg');
  write('src/site/App.jsx', 'app');
  git('add', '-A'); git('commit', '-qm', 'main');
  git('checkout', '-qb', 'content/1');
  edit({ write, content: c => write(CONTENT_FILE, serialize(c(structuredClone(site)))) });
  git('add', '-A'); git('commit', '-qm', 'edit');
  git('checkout', '-q', 'main');
  return dir;
}
const check = dir => JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/content-check.mjs'), 'main', 'content/1'], { cwd: dir, encoding: 'utf8' }));

test('content-check: a wording edit passes and lists the change', () => {
  const r = check(repo(({ content }) => content(s => { s.home.hero.lead = 'Family-owned since 1986.\nWe handle every step.'; return s; })));
  assert.equal(r.ok, true);
  assert.deepEqual(r.holds, []);
  assert.equal(r.changes[0].where, 'home › hero › lead');
  assert.match(r.headSha, /^[0-9a-f]{40}$/);
});

test('content-check: a new photo passes and is listed for Claude to look at', () => {
  const r = check(repo(({ content, write }) => {
    write('public/photos/uploads/1-1.jpg', 'new jpeg');
    content(s => { s.about.photo.src = 'photos/uploads/1-1.jpg'; return s; });
  }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.newPhotos, ['public/photos/uploads/1-1.jpg']);
});

test('content-check: contact details, code and empty edits are held', () => {
  const phone = check(repo(({ content }) => content(s => { s.business.phone = '(352) 555-0199'; return s; })));
  assert.equal(phone.ok, false);
  assert.match(phone.holds.join(), /Contact details/);

  const code = check(repo(({ content, write }) => { write('src/site/App.jsx', 'evil'); content(s => { s.home.hero.lead = 'x'; return s; }); }));
  assert.equal(code.ok, false);
  assert.match(code.holds.join(), /outside the website content/);

  const missing = check(repo(({ content }) => content(s => { s.about.photo.src = 'photos/uploads/nope.jpg'; return s; })));
  assert.match(missing.holds.join(), /missing/);

  const nothing = check(repo(({ write }) => write('public/photos/uploads/2-1.jpg', 'x')));
  assert.equal(nothing.ok, false);
  assert.match(nothing.holds.join(), /No website content changed/);
});

test('content-live-check: waits for the live site to show the edit', async () => {
  const dir = repo(({ content }) => content(s => { s.home.cta.title = 'Ready when you are?'; return s; }));
  let served = site;
  const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(served)); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const live = (minutes) => run(process.execPath, [path.join(root, 'scripts/content-live-check.mjs'), '--site', url, '--before', 'main', '--after', 'content/1', '--minutes', String(minutes)], { cwd: dir })
    .then(() => 0, e => e.code);
  try {
    assert.equal(await live(0), 1, 'old content still live');
    served = { ...site, home: { ...site.home, cta: { ...site.home.cta, title: 'Ready when you are?' } } };
    assert.equal(await live(0), 0, 'new content live');
  } finally { server.close(); }
});
