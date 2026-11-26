// Website editor: the shared editing rules and the content-api function, against a fake GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyChanges, checkPolicy, diffContent, serialize, CONTENT_FILE } from '../src/lib/content-edit.mjs';
import { createApi, SETTINGS_KEY } from '../amplify/functions/content-api/core.mjs';

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

// An in-memory stand-in for the S3 bucket
function memoryStore(files = {}) {
  const m = new Map(Object.entries(files));
  return {
    m,
    async getJson(k) { return m.has(k) ? JSON.parse(m.get(k).bytes.toString()) : null; },
    async putJson(k, v) { m.set(k, { bytes: Buffer.from(JSON.stringify(v)), contentType: 'application/json' }); },
    async list(prefix) { return [...m.keys()].filter(k => k.startsWith(prefix)); },
    async getBytes(k) { return m.get(k) || null; },
  };
}
const jpeg = { bytes: Buffer.from('fake-jpeg'), contentType: 'image/jpeg' };
const KEY = 'k'.repeat(40);
const FIRE = 'https://api.anthropic.com/v1/claude_code/routines/trig_01abc/fire';

function setup({ connected = true } = {}) {
  const store = memoryStore({ 'content-uploads/a.jpg': jpeg });
  const fires = [];
  let t = 1795000000000;
  const fetch = async (url, init) => { fires.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };
  const api = createApi({ store, content: site, fetch, now: () => t++, random: () => 'abc123' });
  const ready = connected
    ? api.run('saveSettings', { fireUrl: FIRE, fireToken: 'sk-ant-oat01-' + 'x'.repeat(30), websiteKey: KEY }, { userId: 'anthony' })
    : Promise.resolve();
  const hook = (body, key = KEY) => api.hook({ authorization: `Bearer ${key}` }, JSON.stringify(body));
  return { store, fires, api, ready, hook };
}

test('editor: sending saves a change request and wakes Claude with just its id', async () => {
  const { api, store, fires, ready } = setup();
  await ready;
  const r = await api.run('submit', {
    changes: [{ path: ['home', 'hero', 'lead'], value: 'New intro' }],
    uploads: [{ path: ['about', 'photo', 'src'], key: 'content-uploads/a.jpg' }],
    note: 'Please use the new photo',
  }, { editorName: 'Jeanette <j@x.com>' });
  assert.equal(r.needsPerson, false);
  const saved = await store.getJson(`content-requests/${r.id}.json`);
  assert.equal(saved.title, 'Website edit: 2 changes');
  assert.equal(saved.editorName, 'Jeanette');
  assert.deepEqual(saved.changes, [{ path: ['home', 'hero', 'lead'], before: site.home.hero.lead, after: 'New intro' }]);
  assert.equal(saved.photos[0].file, `${r.id}-1.jpg`);
  assert.equal(saved.messages[0].text, 'Please use the new photo');

  assert.equal(fires.length, 1);
  assert.equal(fires[0].url, FIRE);
  assert.match(fires[0].headers.Authorization, /^Bearer sk-ant-oat01-/);
  assert.equal(fires[0].headers['anthropic-version'], '2023-06-01');
  assert.equal(fires[0].body.text, `New website edit: request ${r.id}`);

  const list = await api.run('list');
  assert.deepEqual(list.requests.map(x => [x.id, x.statusText]), [[r.id, 'Claude is checking it']]);
});

test('editor: contact detail edits are flagged; bad requests are refused', async () => {
  const { api, fires } = setup({ connected: false });
  assert.equal((await api.run('submit', { changes: [{ path: ['business', 'phone'], value: '(352) 555-0100' }] })).needsPerson, true);
  assert.equal(fires.length, 0, 'not connected yet: saved, nobody woken');
  await assert.rejects(api.run('submit', {}), /no changes/);
  await assert.rejects(api.run('submit', { changes: [{ path: ['home', 'hero', 'lead'], value: site.home.hero.lead }] }), /match what/);
  await assert.rejects(api.run('submit', { changes: [{ path: ['about', 'photo', 'src'], value: 'photos/x.jpg' }] }), /uploading/);
  await assert.rejects(api.run('submit', { uploads: [{ path: ['home', 'hero', 'lead'], key: 'content-uploads/a.jpg' }] }), /can’t go/);
  await assert.rejects(api.run('submit', { uploads: [{ path: ['about', 'photo', 'src'], key: 'content-uploads/missing.jpg' }] }), /didn’t finish/);
  await assert.rejects(api.run('thread', { id: '../../editor-settings/settings' }), /Unknown change request/);
});

test('settings: keys are write-only, and only the first person to connect can change them', async () => {
  const { api, store, ready } = setup();
  await ready;
  const saved = await store.getJson(SETTINGS_KEY);
  assert.equal(saved.keyHash.length, 64);
  assert.ok(!JSON.stringify(saved).includes(KEY), 'website key stored only as a hash');
  const status = await api.run('settings', {}, { userId: 'anthony' });
  assert.deepEqual(status, { routineConnected: true, websiteKeySet: true, canChange: true, updatedAt: status.updatedAt });
  assert.ok(!('fireToken' in status));
  assert.equal((await api.run('settings', {}, { userId: 'jeanette' })).canChange, false);
  await assert.rejects(api.run('saveSettings', { websiteKey: 'j'.repeat(40) }, { userId: 'jeanette' }), /Only the person/);
  await assert.rejects(api.run('saveSettings', { fireUrl: 'https://evil.example/fire' }, { userId: 'anthony' }), /fire URL/);
});

test('webhook: needs the website key', async () => {
  const { hook, ready } = setup();
  await assert.rejects(setup({ connected: false }).hook({ action: 'pending' }), e => e.status === 503);
  await ready;
  await assert.rejects(hook({ action: 'pending' }, 'wrong-key'), e => e.status === 401);
  await assert.rejects(hook({ action: 'pending' }, ''), e => e.status === 401);
  assert.deepEqual(await hook({ action: 'pending' }), { requests: [] });
});

test('webhook: Claude reads a request and its photo, then reports status and replies', async () => {
  const { api, hook, ready, fires } = setup();
  await ready;
  const { id } = await api.run('submit', { changes: [{ path: ['home', 'cta', 'title'], value: 'Dream big?' }], uploads: [{ path: ['about', 'photo', 'src'], key: 'content-uploads/a.jpg' }] }, { editorName: 'Jeanette' });

  assert.deepEqual((await hook({ action: 'pending' })).requests.map(r => [r.id, r.needs]), [[id, ['needs review']]]);
  const { request } = await hook({ action: 'get', id });
  assert.equal(request.changes[0].after, 'Dream big?');
  const photo = await hook({ action: 'photo', id, file: request.photos[0].file });
  assert.equal(Buffer.from(photo.base64, 'base64').toString(), 'fake-jpeg');
  await assert.rejects(hook({ action: 'photo', id, file: 'other.jpg' }), e => e.status === 404);

  await hook({ action: 'update', id, status: 'human', prNumber: 31, message: 'Anthony will look at the new photo within a day.' });
  let t = await api.run('thread', { id });
  assert.deepEqual([t.status, t.statusText, t.held], ['human', 'Waiting for Anthony’s review', true]);
  assert.deepEqual(t.messages.map(m => [m.from, m.name]), [['claude', 'Claude']]);

  // the editor writes back; Claude is woken and the request shows up as needing an answer
  await api.run('message', { id, text: 'Is the photo okay?' }, { editorName: 'Jeanette' });
  assert.equal(fires.at(-1).body.text, `New editor message: request ${id}`);
  assert.deepEqual((await hook({ action: 'pending' })).requests[0].needs, ['check whether Anthony merged or closed the pull request', 'editor message to answer']);
  await hook({ action: 'update', id, message: 'Yes, it looks great.', from: 'anthony' });
  await hook({ action: 'update', id, status: 'live' });
  t = await api.run('thread', { id });
  assert.deepEqual([t.status, t.held, t.messages.at(-1).name], ['live', true, 'Anthony']);
  assert.deepEqual((await hook({ action: 'pending' })).requests, []);
  await assert.rejects(hook({ action: 'update', id, status: 'merged' }), e => e.status === 400);
});
