// Website editor: the shared editing rules and the content-api function, against a fake GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyChanges, checkPolicy, diffContent, serialize, CONTENT_FILE } from '../src/lib/content-edit.mjs';
import { createApi, statusOf, toMessage, EDITOR_MARK } from '../amplify/functions/content-api/core.mjs';

const site = JSON.parse(fs.readFileSync(new URL('../src/content/site.json', import.meta.url), 'utf8'));
const modified = [{ path: CONTENT_FILE, status: 'modified' }];
const edit = (path, value) => applyChanges(site, [{ path, value }]);
const reasons = r => r.holds.map(h => h.reason);

test('content file is stored in the layout the editor writes', () => {
  assert.equal(fs.readFileSync(new URL('../src/content/site.json', import.meta.url), 'utf8'), serialize(site));
});

test('policy: a plain text edit with line breaks can go live on Claude’s approval', () => {
  const after = edit(['home', 'hero', 'lead'], 'We build kitchens.\nAnd baths.');
  const r = checkPolicy(site, after, modified);
  assert.deepEqual(r.holds, []);
  assert.deepEqual(r.changes.map(c => c.path.join('.')), ['home.hero.lead']);
});

test('policy: contact details, links and web addresses need a person', () => {
  assert.match(reasons(checkPolicy(site, edit(['business', 'phone'], '(352) 555-0100'), modified)).join(), /Contact details/);
  assert.match(reasons(checkPolicy(site, edit(['home', 'cta', 'text'], 'Visit example.com today'), modified)).join(), /web address/);
  assert.match(reasons(checkPolicy(site, edit(['home', 'cta', 'text'], 'Hi <script>'), modified)).join(), /code/);
  assert.match(reasons(checkPolicy(site, edit(['home', 'cta', 'title'], ''), modified)).join(), /removed/);
});

test('policy: layout changes and files outside the content need a person', () => {
  const after = structuredClone(site);
  after.services.faq.push({ q: 'New?', a: 'Yes' });
  assert.match(reasons(checkPolicy(site, after, modified)).join(), /changed from 5 to 6 items/);
  assert.match(reasons(checkPolicy(site, site, [...modified, { path: 'src/site/App.jsx', status: 'modified' }])).join(), /outside the website content/);
  assert.match(reasons(checkPolicy(site, site, [...modified, { path: 'public/photos/uploads/a.jpg', status: 'added', size: 4e6 }])).join(), /3 MB/);
});

test('policy: a replaced photo must be an uploaded file that exists', () => {
  const after = structuredClone(site);
  after.about.photo.src = 'photos/uploads/1-1.jpg';
  const files = [...modified, { path: 'public/photos/uploads/1-1.jpg', status: 'added', size: 1000 }];
  assert.deepEqual(checkPolicy(site, after, files, src => src === 'photos/uploads/1-1.jpg').holds, []);
  assert.match(reasons(checkPolicy(site, after, files, () => false)).join(), /missing/);
  after.about.photo.src = 'photos/../../etc.jpg';
  assert.match(reasons(checkPolicy(site, after, files)).join(), /not allowed/);
});

test('applyChanges rejects fields the editor may not touch', () => {
  assert.throws(() => edit(['home', 'nope'], 'x'), /Unknown field/);
  assert.throws(() => edit(['business', 'facebookUrl'], 'https://evil.example'), /can't be edited/);
  assert.throws(() => edit(['about', 'photo', 'src'], 'photos/k-1.jpg'), /uploaded photo/);
  assert.throws(() => edit(['home', 'hero', 'lead'], 'x'.repeat(3000)), /too long/);
  assert.equal(diffContent(site, edit(['home', 'hero', 'lead'], 'a\r\nb'))[0].after, 'a\nb');
});

// A minimal in-memory GitHub that records what the function sends
function fakeGitHub() {
  const calls = [], issues = new Map(), comments = new Map();
  let n = 0;
  const reply = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  const fetch = async (url, init = {}) => {
    const path = url.replace('https://api.github.com/repos/kltef/site', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, path, body });
    if (init.method === 'GET' && path.startsWith('/git/ref/heads/main')) return reply(200, { object: { sha: 'base1' } });
    if (init.method === 'GET' && path.startsWith('/contents/')) return reply(200, { content: Buffer.from(serialize(site)).toString('base64') });
    if (init.method === 'GET' && path === '/git/commits/base1') return reply(200, { tree: { sha: 'tree0' } });
    if (path === '/git/blobs') return reply(201, { sha: 'blob' + ++n });
    if (path === '/git/trees') return reply(201, { sha: 'tree1' });
    if (path === '/git/commits') return reply(201, { sha: 'commit1' });
    if (path === '/git/refs') return reply(201, {});
    if (path === '/pulls') { issues.set(7, { number: 7, title: body.title, state: 'open', labels: [], pull_request: {}, created_at: 'now' }); return reply(201, { number: 7 }); }
    const lab = path.match(/^\/issues\/(\d+)\/labels$/);
    if (lab) { issues.get(+lab[1]).labels.push(...body.labels.map(name => ({ name }))); return reply(200, []); }
    const com = path.match(/^\/issues\/(\d+)\/comments/);
    if (com && init.method === 'POST') { (comments.get(+com[1]) || comments.set(+com[1], []).get(+com[1])).push({ body: body.body, user: { login: 'anthony' }, created_at: 'now' }); return reply(201, {}); }
    if (com) return reply(200, comments.get(+com[1]) || []);
    const iss = path.match(/^\/issues\/(\d+)$/);
    if (iss) return issues.has(+iss[1]) ? reply(200, issues.get(+iss[1])) : reply(404, { message: 'Not Found' });
    if (path.startsWith('/issues?')) return reply(200, [...issues.values()]);
    return reply(404, { message: 'unexpected ' + path });
  };
  return { fetch, calls, issues, comments };
}

const upload = { bytes: Buffer.from('fake-jpeg'), contentType: 'image/jpeg' };
const api = (gh, extra = {}) => createApi({ token: 't', repo: 'kltef/site', fetch: gh.fetch, getObject: async () => upload, now: () => 1700, ...extra });

test('content-api: submit commits the content and photo, opens a labeled PR and posts the note', async () => {
  const gh = fakeGitHub();
  const r = await api(gh).run('submit', {
    changes: [{ path: ['home', 'hero', 'lead'], value: 'New intro' }],
    uploads: [{ path: ['about', 'photo', 'src'], key: 'content-uploads/abc.jpg' }],
    note: 'Please use the new photo',
  }, { editorName: 'Jeanette' });
  assert.deepEqual(r, { number: 7, needsPerson: false, holds: [] });

  const tree = gh.calls.find(c => c.path === '/git/trees').body;
  assert.equal(tree.base_tree, 'tree0');
  assert.deepEqual(tree.tree.map(t => t.path), ['public/photos/uploads/1700-1.jpg', CONTENT_FILE]);
  const contentBlob = gh.calls.filter(c => c.path === '/git/blobs')[1].body;
  const written = JSON.parse(Buffer.from(contentBlob.content, 'base64').toString());
  assert.equal(written.home.hero.lead, 'New intro');
  assert.equal(written.about.photo.src, 'photos/uploads/1700-1.jpg');

  assert.deepEqual(gh.calls.find(c => c.path === '/git/refs').body, { ref: 'refs/heads/content/1700', sha: 'commit1' });
  const pr = gh.calls.find(c => c.path === '/pulls').body;
  assert.equal(pr.base, 'main');
  assert.match(pr.body, /Jeanette/);
  assert.deepEqual(gh.issues.get(7).labels.map(l => l.name), ['content-change']);
  assert.ok(gh.comments.get(7)[0].body.startsWith(EDITOR_MARK));
});

test('content-api: contact detail edits are flagged for a person', async () => {
  const gh = fakeGitHub();
  const r = await api(gh).run('submit', { changes: [{ path: ['business', 'phone'], value: '(352) 555-0100' }] });
  assert.equal(r.needsPerson, true);
  assert.match(gh.calls.find(c => c.path === '/pulls').body.body, /Needs a person/);
});

test('content-api: rejects bad requests before touching GitHub', async () => {
  const gh = fakeGitHub();
  await assert.rejects(api(gh).run('submit', {}), /no changes/);
  await assert.rejects(api(gh).run('submit', { changes: [{ path: ['home', 'hero', 'lead'], value: site.home.hero.lead }] }), /match what/);
  await assert.rejects(api(gh).run('submit', { uploads: [{ path: ['home', 'hero', 'lead'], key: 'content-uploads/a.jpg' }] }), /can’t go/);
  await assert.rejects(api(gh, { getObject: async () => ({ bytes: Buffer.from('x'), contentType: 'image/gif' }) })
    .run('submit', { uploads: [{ path: ['about', 'photo', 'src'], key: 'content-uploads/a.gif' }] }), /JPEG/);
  await assert.rejects(api(gh).run('thread', { number: 99 }), /Unknown change request/);
  assert.ok(!gh.calls.some(c => c.path === '/pulls'));
  assert.throws(() => createApi({ repo: 'a/b', getObject() {} }), /GITHUB_TOKEN/);
});

test('content-api: messages and status come back in the editor’s terms', async () => {
  const gh = fakeGitHub();
  const a = api(gh);
  await a.run('submit', { changes: [{ path: ['home', 'cta', 'title'], value: 'Dream big?' }] }, { editorName: 'Jeanette <j@x.com>' });
  await a.run('message', { number: 7, text: 'Is this okay?' }, { editorName: 'Jeanette' });
  gh.comments.get(7).push({ body: '<!-- content-reply -->\nYes, it looks good.', user: { login: 'github-actions[bot]', type: 'Bot' }, created_at: 'now' });
  const t = await a.run('thread', { number: 7 });
  assert.equal(t.status, 'checking');
  assert.deepEqual(t.messages.map(m => [m.from, m.name, m.text]), [['editor', 'Jeanette', 'Is this okay?'], ['claude', 'Claude', 'Yes, it looks good.']]);
  assert.equal(gh.calls.find(c => c.path === '/pulls').body.body.includes('j@x.com'), false, 'email stripped from the name');
  assert.equal((await a.run('list')).requests[0].statusText, 'Automatic check');
});

test('statusOf maps PR state to what the editor sees', () => {
  const s = (labels, extra = {}) => statusOf({ state: 'open', labels: labels.map(name => ({ name })), pull_request: {}, ...extra }).status;
  assert.equal(s(['content-change']), 'checking');
  assert.equal(s(['content-change', 'needs-human']), 'human');
  assert.equal(s(['content-change'], { state: 'closed', pull_request: { merged_at: 'x' } }), 'publishing');
  assert.equal(s(['content-change', 'live'], { state: 'closed', pull_request: { merged_at: 'x' } }), 'live');
  assert.equal(s(['content-change'], { state: 'closed' }), 'closed');
  assert.equal(toMessage({ body: 'plain comment', user: { login: 'kltef' }, created_at: 'x' }).from, 'person');
});
