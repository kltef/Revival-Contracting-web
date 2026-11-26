// Calls the website's webhook (the content-api function URL) for Claude's website-edit routine.
// Uses curl, which goes through the routine environment's proxy: that's where the website key is attached
// (as a network secret), so the key never appears in the session. Set WEBSITE_KEY to send it directly instead.
import { execFileSync } from 'node:child_process';

export function callHook(url, body) {
  const args = ['-sS', '-X', 'POST', url, '-H', 'Content-Type: application/json', '--data-binary', '@-', '-w', '\n%{http_code}', '--max-time', '60'];
  if (process.env.WEBSITE_KEY) args.push('-H', `Authorization: Bearer ${process.env.WEBSITE_KEY}`);
  const out = execFileSync('curl', args, { input: JSON.stringify(body), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const cut = out.lastIndexOf('\n');
  const status = Number(out.slice(cut + 1));
  const text = out.slice(0, cut);
  let data;
  try { data = JSON.parse(text || '{}'); } catch { data = { error: text.slice(0, 300) }; }
  if (!(status >= 200 && status < 300)) throw new Error(`Website webhook "${body.action}" failed (${status}): ${data.error || text.slice(0, 300)}`);
  return data;
}

// node scripts/lib/website-hook.mjs <webhook-url> '{"action":"pending"}'
if (import.meta.url === `file://${process.argv[1]}`) {
  const [url, json] = process.argv.slice(2);
  if (!url || !json) { console.error(`usage: node scripts/lib/website-hook.mjs <webhook-url> '{"action":"pending"}'`); process.exit(2); }
  try { console.log(JSON.stringify(callHook(url, JSON.parse(json)), null, 2)); }
  catch (e) { console.error(e.message); process.exit(1); }
}
