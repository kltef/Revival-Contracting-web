#!/usr/bin/env node
// Writes one website change request into the working tree: the new words into src/content/site.json and
// new photos into public/photos/uploads/. Run by Claude's website-edit routine on a fresh content/<id> branch:
//
//   node scripts/content-apply.mjs <webhook-url> <request-id>
//
// If a spot the editor changed has been changed by someone else since (its text isn't what the editor
// started from), nothing is written and the conflicts are listed: hold the request for Anthony.
// Prints a JSON report. Exit 0 when applied, 1 on conflicts, 2 on errors.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_FILE, UPLOAD_DIR, UPLOAD_SRC_PREFIX, applyChanges, describePath, getAt, serialize } from '../src/lib/content-edit.mjs';
import { callHook } from './lib/website-hook.mjs';

const [url, id] = process.argv.slice(2);
if (!url || !id) { console.error('usage: node scripts/content-apply.mjs <webhook-url> <request-id>'); process.exit(2); }

try {
  const { request } = callHook(url, { action: 'get', id });
  const current = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  const conflicts = [...request.changes, ...request.photos]
    .filter(c => getAt(current, c.path) !== c.before)
    .map(c => ({ where: describePath(c.path), expected: c.before, found: getAt(current, c.path) }));
  if (conflicts.length) {
    console.log(JSON.stringify({ id, applied: false, conflicts }, null, 2));
    process.exit(1);
  }

  const files = [];
  const photoChanges = request.photos.map(p => {
    const photo = callHook(url, { action: 'photo', id, file: p.file });
    if (!/^[\w.-]+$/.test(photo.file)) throw new Error(`Unexpected photo file name: ${photo.file}`);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, photo.file), Buffer.from(photo.base64, 'base64'));
    files.push(UPLOAD_DIR + photo.file);
    return { path: p.path, value: UPLOAD_SRC_PREFIX + photo.file };
  });
  const next = applyChanges(current, [...request.changes.map(c => ({ path: c.path, value: c.after })), ...photoChanges]);
  fs.writeFileSync(CONTENT_FILE, serialize(next));
  files.push(CONTENT_FILE);

  console.log(JSON.stringify({
    id,
    applied: true,
    title: request.title,
    editorName: request.editorName,
    note: request.note,
    changes: request.changes.map(c => ({ where: describePath(c.path), before: c.before, after: c.after })),
    photos: request.photos.map(p => ({ where: describePath(p.path), file: UPLOAD_DIR + p.file })),
    files,
  }, null, 2));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
