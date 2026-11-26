// Answers a message the editor left on a website-edit request.
import { loadChange, changeSummary, comment, addLabel, NEEDS_HUMAN } from './lib/change.mjs';
import { statusOf } from '../amplify/functions/content-api/core.mjs';
import { replyToEditor } from './lib/claude.mjs';

const number = Number(process.env.PR_NUMBER);

try {
  const change = await loadChange(number);
  const issue = { state: change.pr.state, labels: change.pr.labels, pull_request: { merged_at: change.pr.merged_at } };
  const { statusText } = statusOf(issue);
  const r = await replyToEditor({ changes: changeSummary(change), status: statusText, messages: change.messages });
  if (r.needs_person) await addLabel(number, NEEDS_HUMAN);
  await comment(number, 'content-reply', r.reply);
} catch (e) {
  console.error(e);
  await addLabel(number, NEEDS_HUMAN);
  await comment(number, 'content-reply', 'Thanks for your message. Anthony will get back to you, usually within a day.');
}
