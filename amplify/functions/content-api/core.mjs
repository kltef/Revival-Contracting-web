// The admin page's website editor talks to GitHub through this function, so the GitHub token
// never reaches the browser. Every edit becomes a pull request; the review workflow in
// .github/workflows/content-review.yml decides whether it goes live.
import {
  CONTENT_FILE, UPLOAD_DIR, UPLOAD_SRC_PREFIX, MAX_UPLOAD_BYTES, IMAGE_TYPES,
  applyChanges, checkPolicy, describePath, getAt, isImageSrc, serialize,
} from '../../../src/lib/content-edit.mjs';

export const LABEL = 'content-change';
export const NEEDS_HUMAN = 'needs-human';
export const LIVE = 'live';
export const EDITOR_MARK = '<!-- website-editor-message -->';
const UPLOAD_KEY = /^content-uploads\/[\w.-]+$/;

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const unb64 = s => Buffer.from(s, 'base64').toString('utf8');

class UserError extends Error {}

export function createApi({ token, repo, base = 'main', fetch: fetchImpl = fetch, getObject, now = () => Date.now() }) {
  if (!token) throw new UserError('The website editor isn’t connected to GitHub yet (GITHUB_TOKEN is not set).');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new UserError('GITHUB_REPO is not set.');

  async function gh(method, path, body) {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'website-editor',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`GitHub ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  async function loadContent(ref = base) {
    const file = await gh('GET', `/contents/${CONTENT_FILE}?ref=${encodeURIComponent(ref)}`);
    return JSON.parse(unb64(file.content));
  }

  async function requireChange(number) {
    if (!Number.isInteger(number) || number < 1) throw new UserError('Unknown change request.');
    const issue = await gh('GET', `/issues/${number}`).catch(() => null);
    if (!issue?.pull_request || !issue.labels.some(l => l.name === LABEL)) throw new UserError('Unknown change request.');
    return issue;
  }

  async function submit({ changes = [], uploads = [], note = '' }, { editorName }) {
    if (!Array.isArray(changes) || !Array.isArray(uploads)) throw new UserError('Nothing to send.');
    if (!changes.length && !uploads.length) throw new UserError('There are no changes to send.');
    if (uploads.length > 10) throw new UserError('Please send at most 10 photos at a time.');

    const ref = await gh('GET', `/git/ref/heads/${encodeURIComponent(base)}`);
    const baseSha = ref.object.sha;
    const before = await loadContent(baseSha);

    // Photos were uploaded to S3 by the browser; copy each into the repo so GitHub and the site match.
    const treeEntries = [], files = [], photoChanges = [], added = new Set();
    for (const [i, u] of uploads.entries()) {
      if (!Array.isArray(u.path) || !isImageSrc(u.path) || typeof getAt(before, u.path) !== 'string') throw new UserError('A photo is being placed somewhere photos can’t go.');
      if (!UPLOAD_KEY.test(u.key || '')) throw new UserError('Photo upload is missing.');
      const obj = await getObject(u.key);
      const ext = IMAGE_TYPES[obj.contentType];
      if (!ext) throw new UserError('Photos must be JPEG, PNG or WebP.');
      if (obj.bytes.length > MAX_UPLOAD_BYTES) throw new UserError('A photo is larger than 3 MB.');
      const name = `${now()}-${i + 1}.${ext}`;
      const blob = await gh('POST', '/git/blobs', { content: obj.bytes.toString('base64'), encoding: 'base64' });
      treeEntries.push({ path: UPLOAD_DIR + name, mode: '100644', type: 'blob', sha: blob.sha });
      files.push({ path: UPLOAD_DIR + name, status: 'added', size: obj.bytes.length });
      photoChanges.push({ path: u.path, value: UPLOAD_SRC_PREFIX + name });
      added.add(UPLOAD_SRC_PREFIX + name);
    }

    let after;
    if (changes.some(c => isImageSrc(c.path || []))) throw new UserError('Photos can only be replaced by uploading a new one.');
    try { after = applyChanges(before, [...changes, ...photoChanges]); }
    catch (e) { throw new UserError(e.message); }
    // only photo paths this request added can change, so those are the ones that must exist
    const { changes: diff, holds } = checkPolicy(before, after, [...files, { path: CONTENT_FILE, status: 'modified' }], src => added.has(src));
    if (!diff.length) throw new UserError('Those edits match what’s already on the website.');

    const contentBlob = await gh('POST', '/git/blobs', { content: b64(serialize(after)), encoding: 'base64' });
    treeEntries.push({ path: CONTENT_FILE, mode: '100644', type: 'blob', sha: contentBlob.sha });
    const baseCommit = await gh('GET', `/git/commits/${baseSha}`);
    const tree = await gh('POST', '/git/trees', { base_tree: baseCommit.tree.sha, tree: treeEntries });
    const summary = `Website edit: ${diff.length} change${diff.length > 1 ? 's' : ''}`;
    const commit = await gh('POST', '/git/commits', { message: `${summary}\n\nSent from the admin page by ${editorName}.`, tree: tree.sha, parents: [baseSha] });
    const branch = `content/${now()}`;
    await gh('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });

    const rows = diff.map(c => `| ${describePath(c.path)} | ${cell(c.before)} | ${cell(c.after)} |`).join('\n');
    const body = [
      `Sent from the website editor by **${editorName}**.`,
      '',
      '| Where | Before | After |', '|---|---|---|', rows,
      '',
      holds.length ? `**Needs a person to approve:**\n${holds.map(h => `- ${h.path ? describePath(h.path.split('.')) + ': ' : ''}${h.reason}`).join('\n')}` : 'Claude will review this change and publish it if everything checks out.',
    ].join('\n');
    const pr = await gh('POST', '/pulls', { title: summary, head: branch, base, body });
    await gh('POST', `/issues/${pr.number}/labels`, { labels: [LABEL] });
    if (String(note).trim()) await postMessage(pr.number, note, editorName);
    return { number: pr.number, needsPerson: holds.length > 0, holds: holds.map(h => h.reason) };
  }

  function editorComment(text, editorName) {
    const quoted = String(text).trim().slice(0, 4000);
    return `${EDITOR_MARK}\n**Message from ${editorName} (website editor):**\n\n${quoted}`;
  }

  async function postMessage(number, text, editorName) {
    if (!String(text).trim()) throw new UserError('Type a message first.');
    await gh('POST', `/issues/${number}/comments`, { body: editorComment(text, editorName) });
    return { ok: true };
  }

  return {
    async run(action, payload = {}, ctx = {}) {
      const editorName = String(ctx.editorName || 'Website editor').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 60) || 'Website editor';
      switch (action) {
        case 'load': return { content: await loadContent() };
        case 'submit': return submit(payload, { editorName });
        case 'list': {
          const issues = await gh('GET', `/issues?labels=${LABEL}&state=all&per_page=20&sort=created&direction=desc`);
          return { requests: issues.filter(i => i.pull_request).map(i => ({ number: i.number, title: i.title, createdAt: i.created_at, ...statusOf(i) })) };
        }
        case 'thread': {
          const issue = await requireChange(payload.number);
          const comments = await gh('GET', `/issues/${payload.number}/comments?per_page=100`);
          return { number: issue.number, title: issue.title, createdAt: issue.created_at, ...statusOf(issue), messages: comments.map(toMessage) };
        }
        case 'message': {
          await requireChange(payload.number);
          return postMessage(payload.number, payload.text, editorName);
        }
        default: throw new UserError('Unknown action.');
      }
    },
  };
}

const cell = s => (s || '(empty)').replace(/\|/g, '\\|').replace(/\n/g, '<br>').slice(0, 300);

// What the editor sees for a change request
export function statusOf(issue) {
  const labels = new Set(issue.labels.map(l => l.name));
  const merged = Boolean(issue.pull_request?.merged_at);
  const held = labels.has(NEEDS_HUMAN);
  if (merged && labels.has(LIVE)) return { status: 'live', statusText: 'Live on the website', held };
  if (merged) return { status: 'publishing', statusText: 'Approved, going live', held };
  if (issue.state === 'closed') return { status: 'closed', statusText: 'Not published', held };
  if (held) return { status: 'human', statusText: 'Waiting for Anthony’s review', held };
  return { status: 'checking', statusText: 'Automatic check', held };
}

export function toMessage(c) {
  const at = c.created_at;
  if (c.body.startsWith(EDITOR_MARK)) {
    const m = c.body.slice(EDITOR_MARK.length).match(/^\s*\*\*Message from (.+?) \(website editor\):\*\*\n\n([\s\S]*)$/);
    return { from: 'editor', name: m ? m[1] : 'Website editor', text: m ? m[2] : c.body, at };
  }
  const bot = c.user?.type === 'Bot' || c.user?.login === 'github-actions[bot]';
  return { from: bot ? 'claude' : 'person', name: bot ? 'Claude' : (c.user?.login || 'Anthony'), text: c.body.replace(/<!--[\s\S]*?-->\s*/g, '').trim(), at };
}

export { UserError };
