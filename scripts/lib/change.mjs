// Helpers for the website-edit workflows. These run from the main branch's copy of the repo
// and read the pull request through the GitHub API, so code in a PR never runs with write access.
import { CONTENT_FILE, checkPolicy, describePath } from '../../src/lib/content-edit.mjs';
import { EDITOR_MARK, LABEL, NEEDS_HUMAN, LIVE, toMessage } from '../../amplify/functions/content-api/core.mjs';

export { EDITOR_MARK, LABEL, NEEDS_HUMAN, LIVE, describePath };

const repo = process.env.GITHUB_REPOSITORY;

export async function gh(method, path, body) {
  // GITHUB_API_URL is set by GitHub Actions (and by the tests, to a fake server)
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) { const e = new Error(`GitHub ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`); e.status = res.status; throw e; }
  return text ? JSON.parse(text) : null;
}

export async function fileAt(path, ref) {
  try {
    const f = await gh('GET', `/contents/${path}?ref=${ref}`);
    return Buffer.from(f.content, 'base64').toString('utf8');
  } catch (e) { if (e.status === 404) return null; throw e; }
}

const exists = async (path, ref) => {
  try { await gh('GET', `/contents/${path}?ref=${ref}`); return true; } catch (e) { if (e.status === 404) return false; throw e; }
};

export const comment = (number, marker, text) => gh('POST', `/issues/${number}/comments`, { body: `<!-- ${marker} -->\n${text}` });
export const addLabel = (number, label) => gh('POST', `/issues/${number}/labels`, { labels: [label] });

// Everything about a change request: its files, the content before and after, and the rule check
export async function loadChange(number) {
  const pr = await gh('GET', `/pulls/${number}`);
  const files = await gh('GET', `/pulls/${number}/files?per_page=100`);
  const base = pr.base.sha, head = pr.head.sha;
  const parse = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
  const before = parse(await fileAt(CONTENT_FILE, base));
  const after = parse(await fileAt(CONTENT_FILE, head));
  const sized = await Promise.all(files.map(async f => {
    const blob = f.status === 'removed' ? null : await gh('GET', `/git/blobs/${f.sha}`).catch(() => null);
    return { path: f.filename, status: f.status, size: blob?.size ?? 0, sha: f.sha };
  }));
  const photoPaths = new Set();
  const policy = checkPolicy(before, after, sized, src => photoPaths.has(src));
  // checkPolicy needs to know which photos exist; look up only the ones the change points at
  const srcs = policy.changes.filter(c => c.path[c.path.length - 1] === 'src').map(c => c.after);
  for (const src of srcs) if (await exists(`public/${src}`, head)) photoPaths.add(src);
  const final = checkPolicy(before, after, sized, src => photoPaths.has(src));
  const comments = await gh('GET', `/issues/${number}/comments?per_page=100`);
  return { pr, files: sized, before, after, policy: final, messages: comments.map(toMessage), rawComments: comments };
}

// Photos added by the change, as base64 for Claude to look at
export async function photoBlocks(change, limit = 5) {
  const out = [];
  for (const f of change.files.filter(f => f.path.startsWith('public/photos/uploads/') && f.status === 'added').slice(0, limit)) {
    const blob = await gh('GET', `/git/blobs/${f.sha}`);
    const ext = f.path.split('.').pop().toLowerCase();
    const media = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext];
    if (!media || blob.size > 5 * 1024 * 1024) continue;
    out.push({ path: f.path.slice('public/'.length), block: { type: 'image', source: { type: 'base64', media_type: media, data: blob.content.replace(/\n/g, '') } } });
  }
  return out;
}

// The edit as plain data for a prompt
export function changeSummary(change) {
  return change.policy.changes.map(c => ({ where: describePath(c.path), before: c.before, after: c.after }));
}

export function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = process.getBuiltinModule('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
  console.log(`${name}=${value}`);
}
