// The website editor's backend. Edits are saved as change requests in the site's storage (S3), and
// Claude's website-edit routine (a Claude Code scheduled task, docs/website-edit-routine.md) is woken to
// make them in GitHub. The routine reads requests and reports back through a webhook on this same
// function, authorized with the website key set on the admin page. No AWS console secrets are needed.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CONTENT_FILE, UPLOAD_DIR, UPLOAD_SRC_PREFIX, MAX_UPLOAD_BYTES, IMAGE_TYPES,
  applyChanges, checkPolicy, diffContent, getAt, isImageSrc,
} from '../../../src/lib/content-edit.mjs';

export const STATUS = {
  checking: 'Claude is checking it',
  human: 'Waiting for Anthony’s review',
  publishing: 'Approved, going live',
  live: 'Live on the website',
  closed: 'Not published',
};
export const SETTINGS_KEY = 'editor-settings/settings.json';
export const requestKey = id => `content-requests/${id}.json`;
const ID = /^\d{13}-[a-f0-9]{6}$/;
const UPLOAD_KEY = /^content-uploads\/[\w.-]+$/;
const FIRE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[\w-]+\/fire$/;

export class UserError extends Error {}
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

const sha256 = s => createHash('sha256').update(String(s)).digest('hex');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * store: { getJson(key), putJson(key, value), list(prefix) -> keys, getBytes(key) -> { bytes, contentType } | null }
 * content: the site.json this backend was deployed with (what the editor shows)
 */
export function createApi({ store, content, fetch: fetchImpl = fetch, now = () => Date.now(), random = () => randomBytes(3).toString('hex') }) {
  const iso = () => new Date(now()).toISOString();
  const settings = async () => (await store.getJson(SETTINGS_KEY)) || {};
  const summary = r => ({ id: r.id, title: r.title, createdAt: r.createdAt, status: r.status, statusText: STATUS[r.status], held: Boolean(r.held) });
  const save = r => store.putJson(requestKey(r.id), { ...r, updatedAt: iso() });

  async function load(id, Err = UserError) {
    const r = ID.test(String(id || '')) ? await store.getJson(requestKey(id)) : null;
    if (!r) throw (Err === UserError ? new UserError('Unknown change request.') : new HttpError(404, 'Unknown change request'));
    return r;
  }

  async function recent(limit) {
    const keys = (await store.list('content-requests/')).filter(k => k.endsWith('.json')).sort().reverse().slice(0, limit);
    return (await Promise.all(keys.map(k => store.getJson(k)))).filter(Boolean);
  }

  // Wake Claude's routine (its API trigger). Only the request id goes in the payload; the routine reads
  // the rest through the webhook. Called once, never retried: each call starts a new session, and the
  // routine's hourly run picks up anything a failed call missed.
  async function wake(id, event) {
    const { fireUrl, fireToken } = await settings();
    if (!fireUrl || !fireToken) return false;
    try {
      const res = await fetchImpl(fireUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fireToken}`,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'experimental-cc-routine-2026-04-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: `${event === 'message' ? 'New editor message' : 'New website edit'}: request ${id}` }),
      });
      if (!res.ok) console.error(`Routine call failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.ok;
    } catch (e) {
      console.error('Routine call failed', e);
      return false;
    }
  }

  async function submit({ changes = [], uploads = [], note = '' }, { editorName }) {
    if (!Array.isArray(changes) || !Array.isArray(uploads)) throw new UserError('Nothing to send.');
    if (!changes.length && !uploads.length) throw new UserError('There are no changes to send.');
    if (uploads.length > 10) throw new UserError('Please send at most 10 photos at a time.');
    if (changes.some(c => isImageSrc(c.path || []))) throw new UserError('Photos can only be replaced by uploading a new one.');
    let after;
    try { after = applyChanges(content, changes); } catch (e) { throw new UserError(e.message); }

    const id = `${now()}-${random()}`;
    const photos = [], files = [{ path: CONTENT_FILE, status: 'modified' }], added = new Set();
    for (const [i, u] of uploads.entries()) {
      if (!Array.isArray(u.path) || !isImageSrc(u.path) || typeof getAt(content, u.path) !== 'string') throw new UserError('A photo is being placed somewhere photos can’t go.');
      if (!UPLOAD_KEY.test(u.key || '')) throw new UserError('Photo upload is missing.');
      const obj = await store.getBytes(u.key);
      if (!obj) throw new UserError('A photo didn’t finish uploading. Please try again.');
      const ext = IMAGE_TYPES[obj.contentType];
      if (!ext) throw new UserError('Photos must be JPEG, PNG or WebP.');
      if (obj.bytes.length > MAX_UPLOAD_BYTES) throw new UserError('A photo is larger than 3 MB.');
      const file = `${id}-${i + 1}.${ext}`;
      photos.push({ path: u.path, key: u.key, file, before: getAt(content, u.path) });
      files.push({ path: UPLOAD_DIR + file, status: 'added', size: obj.bytes.length });
      added.add(UPLOAD_SRC_PREFIX + file);
      after = applyChanges(after, [{ path: u.path, value: UPLOAD_SRC_PREFIX + file }]);
    }
    const diff = diffContent(content, after).filter(c => !isImageSrc(c.path));
    if (!diff.length && !photos.length) throw new UserError('Those edits match what’s already on the website.');
    const { holds } = checkPolicy(content, after, files, src => added.has(src));

    const text = String(note).trim().slice(0, 4000);
    const request = {
      id,
      title: `Website edit: ${plural(diff.length + photos.length, 'change')}`,
      createdAt: iso(),
      editorName,
      changes: diff.map(c => ({ path: c.path, before: c.before, after: c.after })),
      photos,
      note: text,
      status: 'checking',
      held: false,
      prNumber: null,
      messages: text ? [{ from: 'editor', name: editorName, text, at: iso() }] : [],
    };
    await save(request);
    await wake(id, 'new-edit');
    return { id, needsPerson: holds.length > 0, holds: holds.map(h => h.reason) };
  }

  // ---- for the admin page and the editor (signed in) ----
  async function run(action, payload = {}, ctx = {}) {
    // shown to Claude and Anthony: drop anything that looks like an email address
    const editorName = String(ctx.editorName || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => !w.includes('@')).join(' ')
      .replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 60) || 'Website editor';
    switch (action) {
      case 'submit': return submit(payload, { editorName });
      case 'list': return { requests: (await recent(20)).map(summary) };
      case 'thread': {
        const r = await load(payload.id);
        return { ...summary(r), messages: r.messages };
      }
      case 'message': {
        const text = String(payload.text || '').trim();
        if (!text) throw new UserError('Type a message first.');
        const r = await load(payload.id);
        r.messages.push({ from: 'editor', name: editorName, text: text.slice(0, 4000), at: iso() });
        await save(r);
        await wake(r.id, 'message');
        return { ok: true };
      }
      case 'settings': return settingsStatus(await settings(), ctx.userId);
      case 'saveSettings': {
        const s = await settings();
        if (s.ownerId && s.ownerId !== ctx.userId) throw new UserError('Only the person who first connected Claude can change these settings.');
        const next = { ...s, ownerId: s.ownerId || ctx.userId, updatedAt: iso() };
        if (payload.fireUrl !== undefined) {
          if (!FIRE_URL.test(String(payload.fireUrl).trim())) throw new UserError('That doesn’t look like a routine’s fire URL (https://api.anthropic.com/v1/claude_code/routines/…/fire).');
          next.fireUrl = String(payload.fireUrl).trim();
        }
        if (payload.fireToken !== undefined) {
          if (!/^\S{20,}$/.test(String(payload.fireToken).trim())) throw new UserError('That doesn’t look like a routine token.');
          next.fireToken = String(payload.fireToken).trim();
        }
        if (payload.websiteKey !== undefined) {
          if (!/^[A-Za-z0-9_-]{32,}$/.test(String(payload.websiteKey))) throw new UserError('The website key must be at least 32 letters and numbers.');
          next.keyHash = sha256(payload.websiteKey);
        }
        await store.putJson(SETTINGS_KEY, next);
        return settingsStatus(next, ctx.userId);
      }
      default: throw new UserError('Unknown action.');
    }
  }

  // ---- the webhook Claude's routine calls (website key required) ----
  async function hook(headers = {}, body = '') {
    const s = await settings();
    if (!s.keyHash) throw new HttpError(503, 'The website key hasn’t been set on the admin page yet');
    const given = String(headers.authorization || headers.Authorization || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(sha256(given), 'hex'), b = Buffer.from(s.keyHash, 'hex');
    if (!given || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, 'Wrong or missing website key');

    let req;
    try { req = JSON.parse(body || '{}'); } catch { throw new HttpError(400, 'Body must be JSON'); }
    switch (req.action) {
      // what needs Claude's attention (for the hourly run)
      case 'pending': {
        const out = [];
        for (const r of await recent(50)) {
          const last = r.messages[r.messages.length - 1];
          const why = [];
          if (r.status === 'checking') why.push('needs review');
          if (r.status === 'publishing') why.push('check it is live');
          if (r.status === 'human' && r.prNumber) why.push('check whether Anthony merged or closed the pull request');
          if (last?.from === 'editor') why.push('editor message to answer');
          if (why.length) out.push({ ...summary(r), prNumber: r.prNumber, updatedAt: r.updatedAt, needs: why });
        }
        return { requests: out };
      }
      case 'get': return { request: await load(req.id, HttpError) };
      case 'photo': {
        const r = await load(req.id, HttpError);
        const p = r.photos.find(x => x.file === req.file);
        if (!p) throw new HttpError(404, 'No such photo on this request');
        const obj = await store.getBytes(p.key);
        if (!obj) throw new HttpError(404, 'Photo is missing from storage');
        return { file: p.file, path: p.path, contentType: obj.contentType, base64: obj.bytes.toString('base64') };
      }
      case 'update': {
        const r = await load(req.id, HttpError);
        if (req.status !== undefined) {
          if (!(req.status in STATUS)) throw new HttpError(400, `status must be one of ${Object.keys(STATUS).join(', ')}`);
          r.status = req.status;
          if (req.status === 'human') r.held = true;
        }
        if (req.prNumber !== undefined) {
          if (!Number.isInteger(req.prNumber) || req.prNumber < 1) throw new HttpError(400, 'prNumber must be a positive integer');
          r.prNumber = req.prNumber;
        }
        if (req.message !== undefined) {
          const text = String(req.message).trim();
          if (!text) throw new HttpError(400, 'message is empty');
          const from = req.from === 'anthony' ? 'person' : 'claude';
          r.messages.push({ from, name: from === 'person' ? 'Anthony' : 'Claude', text: text.slice(0, 4000), at: iso() });
        }
        await save(r);
        return { request: summary(r) };
      }
      default: throw new HttpError(400, 'action must be pending, get, photo or update');
    }
  }

  return { run, hook };
}

function settingsStatus(s, userId) {
  return {
    routineConnected: Boolean(s.fireUrl && s.fireToken),
    websiteKeySet: Boolean(s.keyHash),
    canChange: !s.ownerId || s.ownerId === userId,
    updatedAt: s.updatedAt || null,
  };
}
