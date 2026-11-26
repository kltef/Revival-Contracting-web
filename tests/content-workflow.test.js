// The website-edit review and reply scripts, run as the workflows run them,
// against a fake GitHub and a fake Claude API on localhost.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { serialize, CONTENT_FILE } from '../src/lib/content-edit.mjs';
import { EDITOR_MARK } from '../amplify/functions/content-api/core.mjs';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(root, CONTENT_FILE), 'utf8'));

// files: { path: { base?, head?, status } } ; verdict: what fake Claude answers
async function scenario({ files, verdict, comments = [], script = 'content-review.mjs' }) {
  const posted = [], labels = [], claudeRequests = [];
  const blobs = new Map(Object.entries(files).map(([p, f]) => ['sha-' + p, f.head ?? '']));
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/v1/messages')) {
      claudeRequests.push(JSON.parse(body));
      return send(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(verdict) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
    }
    const p = url.pathname.replace('/repos/o/r', '');
    if (p === '/pulls/5') return send(200, { number: 5, state: 'open', merged_at: null, labels: [{ name: 'content-change' }], base: { sha: 'BASE' }, head: { sha: 'HEAD' } });
    if (p === '/pulls/5/files') return send(200, Object.entries(files).map(([filename, f]) => ({ filename, status: f.status, sha: 'sha-' + filename })));
    if (p.startsWith('/git/blobs/')) {
      const data = blobs.get(decodeURIComponent(p.slice('/git/blobs/'.length)));
      return data === undefined ? send(404, {}) : send(200, { size: Buffer.byteLength(data), content: Buffer.from(data).toString('base64') });
    }
    if (p.startsWith('/contents/')) {
      const file = decodeURIComponent(p.slice('/contents/'.length)), ref = url.searchParams.get('ref');
      const f = files[file];
      const content = file === CONTENT_FILE && !f ? serialize(site) : ref === 'BASE' ? f?.base : f?.head;
      return content == null ? send(404, {}) : send(200, { content: Buffer.from(content).toString('base64') });
    }
    if (p === '/issues/5/comments' && req.method === 'GET') return send(200, comments);
    if (p === '/issues/5/comments') { posted.push(JSON.parse(body).body); return send(201, {}); }
    if (p === '/issues/5/labels') { labels.push(...JSON.parse(body).labels); return send(200, []); }
    send(404, { message: 'unexpected ' + p });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'review-')), 'out');
  fs.writeFileSync(out, '');
  try {
    await run(process.execPath, [path.join(root, 'scripts', script)], {
      env: { ...process.env, GITHUB_API_URL: base, ANTHROPIC_BASE_URL: base, ANTHROPIC_API_KEY: 'test', GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '5', GITHUB_OUTPUT: out },
    });
  } finally { server.close(); }
  return { decision: fs.readFileSync(out, 'utf8').match(/decision=(\w+)/)?.[1], posted, labels, claudeRequests };
}

const edited = (mutate) => { const s = structuredClone(site); mutate(s); return serialize(s); };
const contentChange = mutate => ({ [CONTENT_FILE]: { status: 'modified', base: serialize(site), head: edited(mutate) } });
const approve = { decision: 'approve', reason: 'Routine wording change.', message_to_editor: 'Looks great! It will be live in a few minutes.' };

test('review: a routine edit Claude approves is cleared to publish', async () => {
  const r = await scenario({ files: contentChange(s => { s.home.hero.lead = 'Kitchens and baths done right.'; }), verdict: approve });
  assert.equal(r.decision, 'approve');
  assert.deepEqual(r.labels, []);
  assert.match(r.posted[0], /Looks great/);
  const req = r.claudeRequests[0];
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.fallbacks, 'default');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.match(JSON.stringify(req.messages), /Kitchens and baths done right/);
});

test('review: Claude holding an edit sends it to Anthony', async () => {
  const r = await scenario({
    files: contentChange(s => { s.home.cta.text = 'Lifetime guarantee on every job!'; }),
    verdict: { decision: 'hold', reason: 'New guarantee claim.', message_to_editor: 'Anthony will check the guarantee wording.' },
  });
  assert.equal(r.decision, 'hold');
  assert.deepEqual(r.labels, ['needs-human']);
  assert.match(r.posted[0], /guarantee wording[\s\S]*New guarantee claim/);
});

test('review: rule breaks are held without asking Claude', async () => {
  const phone = await scenario({ files: contentChange(s => { s.business.phone = '(352) 555-0199'; }), verdict: approve });
  assert.equal(phone.decision, 'hold');
  assert.equal(phone.claudeRequests.length, 0);
  assert.match(phone.posted[0], /Contact details changed/);

  const code = await scenario({ files: { ...contentChange(s => { s.home.hero.lead = 'x'; }), 'scripts/content-review.mjs': { status: 'modified', head: 'evil' } }, verdict: approve });
  assert.equal(code.decision, 'hold');
  assert.match(code.posted[0], /outside the website content/);
});

test('review: new photos are shown to Claude', async () => {
  const r = await scenario({
    files: {
      ...contentChange(s => { s.about.photo.src = 'photos/uploads/9-1.jpg'; }),
      'public/photos/uploads/9-1.jpg': { status: 'added', head: 'jpeg-bytes' },
    },
    verdict: approve,
  });
  assert.equal(r.decision, 'approve');
  const blocks = r.claudeRequests[0].messages[0].content;
  assert.ok(blocks.some(b => b.type === 'image' && b.source.media_type === 'image/jpeg'));
});

test('review: if the review itself fails, nothing is published', async () => {
  const r = await scenario({ files: contentChange(s => { s.home.hero.lead = 'New'; }), verdict: 'not an object' });
  assert.equal(r.decision, 'hold');
  assert.deepEqual(r.labels, ['needs-human']);
  assert.match(r.posted[0], /couldn’t finish/);
});

test('reply: Claude answers the editor and can ask for Anthony', async () => {
  const r = await scenario({
    script: 'content-reply.mjs',
    files: contentChange(s => { s.home.hero.lead = 'New'; }),
    comments: [{ body: `${EDITOR_MARK}\n**Message from Jeanette (website editor):**\n\nCan you add a page for pools?`, user: { login: 'kltef' }, created_at: 'x' }],
    verdict: { reply: 'A new page is something Anthony sets up. He will reply within a day.', needs_person: true },
  });
  assert.deepEqual(r.labels, ['needs-human']);
  assert.match(r.posted[0], /^<!-- content-reply -->\nA new page/);
  assert.match(JSON.stringify(r.claudeRequests[0].messages), /page for pools/);
});
