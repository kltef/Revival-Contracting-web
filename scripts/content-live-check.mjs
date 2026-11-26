#!/usr/bin/env node
// After a website edit is merged, waits for the live site to show it.
// The build publishes the content it was made from at /content.json (see vite.config.mjs).
//
//   node scripts/content-live-check.mjs --site https://example.com --before <ref> --after <ref> [--minutes 30]
//
// --before/--after are the commits on either side of the edit (for a squash merge: <merge-sha>^ and <merge-sha>).
// Exit 0 once every edited spot on the live site no longer shows its old text, 1 if that doesn't happen in time.
import { execFileSync } from 'node:child_process';
import { CONTENT_FILE, diffContent, getAt, pathKey } from '../src/lib/content-edit.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s*--/).filter(Boolean).map(a => a.split(/\s+/)));
const site = String(args.site || '').replace(/\/+$/, '');
if (!site || !args.before || !args.after) {
  console.error('usage: node scripts/content-live-check.mjs --site <url> --before <ref> --after <ref> [--minutes 30]');
  process.exit(2);
}
const read = ref => JSON.parse(execFileSync('git', ['show', `${ref}:${CONTENT_FILE}`], { encoding: 'utf8' }));
const edits = diffContent(read(args.before), read(args.after));
// A later edit may have changed a spot again, so "live" means the old text is gone, not that the new text matches.
const isLive = live => edits.every(c => getAt(live, c.path) !== c.before);

const deadline = Date.now() + Number(args.minutes || 30) * 60_000;
let last = '';
for (;;) {
  try {
    const res = await fetch(`${site}/content.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (res.ok && isLive(await res.json())) { console.log(`live: ${edits.map(c => pathKey(c.path)).join(', ') || '(no text changes)'}`); process.exit(0); }
    last = res.ok ? 'the site still shows the old version' : `the site returned ${res.status}`;
  } catch (e) { last = e.message; }
  if (Date.now() > deadline) break;
  console.log(`not live yet: ${last}`);
  await new Promise(r => setTimeout(r, 30_000));
}
console.log(`not live: ${last}`);
process.exit(1);
