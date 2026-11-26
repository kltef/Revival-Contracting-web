#!/usr/bin/env node
// Checks a website-edit branch against the rules in src/lib/content-edit.mjs, using git only.
// Claude's website-edit routine runs this from main's copy of the repo before reviewing an edit:
//
//   git fetch origin pull/<n>/head:edit-<n>
//   node scripts/content-check.mjs origin/main edit-<n>
//
// Prints a JSON report. "ok": true means only words and photos in existing places changed, so Claude
// may review and publish it; otherwise "holds" lists why a person must approve it. Exit code 0 either way
// (2 for usage errors).
import { execFileSync } from 'node:child_process';
import { CONTENT_FILE, UPLOAD_DIR, checkPolicy, describePath } from '../src/lib/content-edit.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };

export function checkRefs(base, head) {
  const mergeBase = git('merge-base', base, head).trim();
  const STATUS = { A: 'added', M: 'modified', D: 'removed', T: 'modified' };
  const files = git('diff', '--no-renames', '--name-status', mergeBase, head).trim().split('\n').filter(Boolean).map(line => {
    const [code, path] = line.split('\t');
    const status = STATUS[code[0]] || 'changed';
    const size = status === 'removed' ? 0 : Number(tryGit('cat-file', '-s', `${head}:${path}`) || 0);
    return { path, status, size };
  });
  const parse = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
  const before = parse(tryGit('show', `${mergeBase}:${CONTENT_FILE}`));
  const after = parse(tryGit('show', `${head}:${CONTENT_FILE}`));
  const exists = src => tryGit('cat-file', '-e', `${head}:public/${src}`) !== null;
  const { holds, changes } = checkPolicy(before, after, files, exists);
  return {
    ok: holds.length === 0 && changes.length > 0,
    holds: [...holds.map(h => (h.path ? `${describePath(h.path.split('.'))}: ${h.reason}` : h.reason)), ...(changes.length ? [] : ['No website content changed'])],
    changes: changes.map(c => ({ where: describePath(c.path), before: c.before, after: c.after })),
    newPhotos: files.filter(f => f.status === 'added' && f.path.startsWith(UPLOAD_DIR)).map(f => f.path),
    headSha: git('rev-parse', head).trim(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) { console.error('usage: node scripts/content-check.mjs <base-ref> <head-ref>'); process.exit(2); }
  console.log(JSON.stringify(checkRefs(base, head), null, 2));
}
