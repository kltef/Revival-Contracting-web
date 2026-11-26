// Shared rules for editing src/content/site.json.
// Used by the admin editor (to build a change list), the content-api function (to apply it)
// and the GitHub review workflow (to decide whether Claude may publish it without Anthony).

export const CONTENT_FILE = 'src/content/site.json';
export const UPLOAD_DIR = 'public/photos/uploads/';
export const UPLOAD_SRC_PREFIX = 'photos/uploads/';
export const MAX_TEXT = 2000;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// One stable layout, so each edit changes only the lines it touches
export const serialize = obj => JSON.stringify(obj, null, 2) + '\n';

export const pathKey = path => path.join('.');

// Fields that are never edited through the editor: ids, photo crops and links.
export function isLockedKey(key) {
  return key === 'key' || key === 'position' || /url$/i.test(String(key));
}

// Changes here go live only after a person approves them.
export function isProtectedPath(path) {
  return path[0] === 'business' || path.some(isLockedKey);
}

export const isImageSrc = path => path[path.length - 1] === 'src';
const isAlt = path => path[path.length - 1] === 'alt';

export function getAt(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setAt(obj, path, value) {
  const parent = getAt(obj, path.slice(0, -1));
  parent[path[path.length - 1]] = value;
}

// Every string in the content, with its path
export function leaves(obj, path = [], out = []) {
  if (typeof obj === 'string') out.push({ path, value: obj });
  else if (Array.isArray(obj)) obj.forEach((v, i) => leaves(v, [...path, i], out));
  else if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) leaves(obj[k], [...path, k], out);
  return out;
}

// Same keys, same list lengths and same kinds of value: an edit may change words, not layout.
export function structureProblems(before, after, path = [], out = []) {
  const kind = v => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v);
  const where = pathKey(path) || 'the whole file';
  if (kind(before) !== kind(after)) { out.push({ path, reason: `${where} changed from ${kind(before)} to ${kind(after)}` }); return out; }
  if (Array.isArray(before)) {
    if (before.length !== after.length) out.push({ path, reason: `${where} changed from ${before.length} to ${after.length} items` });
    before.forEach((v, i) => { if (i < after.length) structureProblems(v, after[i], [...path, i], out); });
  } else if (before && typeof before === 'object') {
    const a = Object.keys(before), b = Object.keys(after);
    for (const k of a) if (!(k in after)) out.push({ path: [...path, k], reason: `${pathKey([...path, k])} was removed` });
    for (const k of b) if (!(k in before)) out.push({ path: [...path, k], reason: `${pathKey([...path, k])} was added` });
    for (const k of a) if (k in after) structureProblems(before[k], after[k], [...path, k], out);
  }
  return out;
}

// The strings that differ between two versions of the content
export function diffContent(before, after) {
  const old = new Map(leaves(before).map(l => [pathKey(l.path), l.value]));
  return leaves(after)
    .filter(l => old.has(pathKey(l.path)) && old.get(pathKey(l.path)) !== l.value)
    .map(l => ({ path: l.path, before: old.get(pathKey(l.path)), after: l.value }));
}

// Apply an editor's change list to a fresh copy of the content. Throws on anything the editor
// can't legitimately send, so a tampered request never reaches GitHub.
export function applyChanges(base, changes) {
  const next = structuredClone(base);
  for (const c of changes) {
    if (!Array.isArray(c.path) || !c.path.length) throw new Error('A change is missing its location.');
    if (typeof getAt(base, c.path) !== 'string') throw new Error(`Unknown field: ${pathKey(c.path)}`);
    if (typeof c.value !== 'string') throw new Error(`Text expected for ${pathKey(c.path)}`);
    if (c.path.some(isLockedKey)) throw new Error(`${pathKey(c.path)} can't be edited here.`);
    if (isImageSrc(c.path) && !c.value.startsWith(UPLOAD_SRC_PREFIX)) throw new Error('Photos can only be replaced with an uploaded photo.');
    if (c.value.length > MAX_TEXT) throw new Error(`Text is too long (${c.value.length} characters, ${MAX_TEXT} at most).`);
    setAt(next, c.path, c.value.replace(/\r\n?/g, '\n'));
  }
  return next;
}

const URLISH = /https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|co|us|info|biz)\b/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/;
const SAFE_SRC = /^photos\/[\w-]+(\/[\w-]+)*\.(jpe?g|png|webp)$/i;

/**
 * Decide whether a content change can go live on Claude's approval alone.
 * files: [{ path, status: 'added'|'modified'|'removed'|..., size? }] for every file in the change.
 * photoExists(src): whether a photo path exists after the change.
 * Returns { holds: [{ path, reason }], changes } where any hold means a person must approve.
 */
export function checkPolicy(before, after, files, photoExists = () => true) {
  const holds = [];
  const hold = (path, reason) => holds.push({ path: path ? pathKey(path) : '', reason });

  for (const f of files) {
    if (f.path === CONTENT_FILE) {
      if (f.status !== 'modified') hold(null, `${CONTENT_FILE} was ${f.status}`);
    } else if (f.path.startsWith(UPLOAD_DIR) && SAFE_SRC.test(f.path.slice('public/'.length))) {
      if (f.status !== 'added') hold(null, `${f.path} was ${f.status}; only new photos may be added`);
      if (f.size > MAX_UPLOAD_BYTES) hold(null, `${f.path} is larger than 3 MB`);
    } else {
      hold(null, `${f.path} is outside the website content`);
    }
  }
  if (after == null) { hold(null, 'The content file could not be read'); return { holds, changes: [] }; }

  for (const p of structureProblems(before, after)) hold(p.path, p.reason);
  const changes = diffContent(before, after);
  for (const c of changes) {
    if (isProtectedPath(c.path)) hold(c.path, c.path[0] === 'business' ? 'Contact details changed' : 'A link or setting changed');
    if (isImageSrc(c.path)) {
      if (!SAFE_SRC.test(c.after) || c.after.includes('..')) hold(c.path, 'Photo path is not allowed');
      else if (!photoExists(c.after)) hold(c.path, 'Photo file is missing');
      continue;
    }
    if (c.after.length > MAX_TEXT) hold(c.path, 'Text is very long');
    if (/[<>]/.test(c.after)) hold(c.path, 'Text contains < or >, which looks like code');
    if (URLISH.test(c.after) && !URLISH.test(c.before)) hold(c.path, 'Text now contains a web address');
    if (CONTROL.test(c.after)) hold(c.path, 'Text contains hidden characters');
    if (!c.after.trim() && c.before.trim() && !isAlt(c.path)) hold(c.path, 'Text was removed');
  }
  return { holds, changes };
}

// Friendly description of a change for messages and pull requests
export function describePath(path) {
  return path.map(p => (typeof p === 'number' ? `#${p + 1}` : p)).join(' › ');
}
