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
  git('add', '-A'); git('commit', '-qm', 'edit', '--allow-empty');
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
  const live = (minutes) => run(process.execPath, [path.join(root, 'scripts/content-live-check.mjs'), '--site', url, '--before', 'main', '--after', 'content/1', '--minutes', String(minutes)], { cwd: dir, env: { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } })
    .then(() => 0, e => e.code);
  try {
    assert.equal(await live(0), 1, 'old content still live');
    served = { ...site, home: { ...site.home, cta: { ...site.home.cta, title: 'Ready when you are?' } } };
    assert.equal(await live(0), 0, 'new content live');
  } finally { server.close(); }
});

test('end to end: an editor’s request goes through the webhook into the repo and passes the check', async () => {
  const { createApi } = await import('../amplify/functions/content-api/core.mjs');
  const files = new Map([['content-uploads/new.jpg', { bytes: Buffer.from('jpeg-bytes'), contentType: 'image/jpeg' }]]);
  const store = {
    async getJson(k) { return files.has(k) ? JSON.parse(files.get(k).bytes.toString()) : null; },
    async putJson(k, v) { files.set(k, { bytes: Buffer.from(JSON.stringify(v)), contentType: 'application/json' }); },
    async list(p) { return [...files.keys()].filter(k => k.startsWith(p)); },
    async getBytes(k) { return files.get(k) || null; },
  };
  const api = createApi({ store, content: site, fetch: async () => new Response('{}'), random: () => 'abc123' });
  const key = 'w'.repeat(40);
  await api.run('saveSettings', { websiteKey: key }, { userId: 'anthony' });
  const { id } = await api.run('submit', {
    changes: [{ path: ['home', 'hero', 'lead'], value: 'Family-owned since 1986.\nWe handle every step.' }],
    uploads: [{ path: ['about', 'photo', 'src'], key: 'content-uploads/new.jpg' }],
  }, { editorName: 'Jeanette' });

  // the webhook, served the way the function URL serves it
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    try { const out = await api.hook(req.headers, body); res.writeHead(200); res.end(JSON.stringify(out)); }
    catch (e) { res.writeHead(e.status || 500); res.end(JSON.stringify({ error: e.message })); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const hookUrl = `http://127.0.0.1:${server.address().port}/`;
  const env = { ...process.env, WEBSITE_KEY: key, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
  try {
    const dir = repo(() => {});
    const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
    git('checkout', '-qb', `content/${id}`);
    // asynchronously: the webhook server runs in this process
    const applied = JSON.parse((await run(process.execPath, [path.join(root, 'scripts/content-apply.mjs'), hookUrl, id], { cwd: dir, env })).stdout);
    assert.equal(applied.applied, true);
    assert.deepEqual(applied.files, [`public/photos/uploads/${id}-1.jpg`, CONTENT_FILE]);
    assert.equal(fs.readFileSync(path.join(dir, `public/photos/uploads/${id}-1.jpg`), 'utf8'), 'jpeg-bytes');
    git('add', '-A'); git('commit', '-qm', 'apply');
    const r = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/content-check.mjs'), 'main', `content/${id}`], { cwd: dir, encoding: 'utf8' }));
    assert.equal(r.ok, true, JSON.stringify(r.holds));
    assert.deepEqual(r.newPhotos, [`public/photos/uploads/${id}-1.jpg`]);

    // someone changed the same words on main in the meantime: nothing is written
    git('checkout', '-q', 'main');
    const changed = structuredClone(site); changed.home.hero.lead = 'Changed by Anthony';
    fs.writeFileSync(path.join(dir, CONTENT_FILE), serialize(changed));
    const conflict = await run(process.execPath, [path.join(root, 'scripts/content-apply.mjs'), hookUrl, id], { cwd: dir, env }).then(() => null, e => e);
    assert.equal(conflict.code, 1);
    assert.match(conflict.stdout, /"found": "Changed by Anthony"/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, CONTENT_FILE), 'utf8')).home.hero.lead, 'Changed by Anthony');

    // wrong key
    const denied = await run(process.execPath, [path.join(root, 'scripts/content-apply.mjs'), hookUrl, id], { cwd: dir, env: { ...env, WEBSITE_KEY: 'nope' } }).then(() => null, e => e);
    assert.match(denied.stderr, /401/);
  } finally { server.close(); }
});
