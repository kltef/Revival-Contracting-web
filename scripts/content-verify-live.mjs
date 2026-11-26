// After a website edit is merged, wait for Amplify to deploy it and confirm the live site shows it.
// The build publishes a copy of src/content/site.json at /content.json (see vite.config.mjs).
import { getAt, pathKey } from '../src/lib/content-edit.mjs';
import { loadChange, comment, addLabel, LIVE, NEEDS_HUMAN } from './lib/change.mjs';

const number = Number(process.env.PR_NUMBER);
const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
const minutes = Number(process.env.VERIFY_MINUTES || 40);

const change = await loadChange(number);
const edits = change.policy.changes;

if (!site) {
  await addLabel(number, LIVE);
  await comment(number, 'content-status', 'Your change has been published. It usually appears on the website within a few minutes.\n\n<details><summary>Note</summary>\n\nThe live check is off because the SITE_URL repository variable isn’t set.\n</details>');
  process.exit(0);
}

// Live once every edited spot no longer shows the old text. (A later edit may have changed it again.)
const isLive = live => edits.every(c => getAt(live, c.path) !== c.before);
const deadline = Date.now() + minutes * 60_000;
let last = '';
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${site}/content.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (res.ok && isLive(await res.json())) {
      await addLabel(number, LIVE);
      await comment(number, 'content-status', 'Your change is now live on the website.');
      process.exit(0);
    }
    last = res.ok ? 'the site still shows the old version' : `the site returned ${res.status}`;
  } catch (e) { last = e.message; }
  console.log(`not live yet: ${last}`);
  await new Promise(r => setTimeout(r, 30_000));
}

await addLabel(number, NEEDS_HUMAN);
await comment(number, 'content-status', `This change was approved but hasn’t shown up on the website yet. Anthony has been asked to check on it.\n\n<details><summary>Details</summary>\n\nAfter ${minutes} minutes ${last}. Checked: ${edits.map(c => pathKey(c.path)).join(', ')}\n</details>`);
process.exit(1);
