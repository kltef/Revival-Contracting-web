// Reviews one website-edit pull request. Prints decision=approve|hold for the workflow.
// An edit is approved only if it passes every rule in src/lib/content-edit.mjs AND Claude approves it;
// anything else is labeled needs-human for Anthony.
import { loadChange, photoBlocks, changeSummary, comment, addLabel, setOutput, NEEDS_HUMAN, describePath } from './lib/change.mjs';
import { reviewEdit } from './lib/claude.mjs';

const number = Number(process.env.PR_NUMBER);

async function hold(text, why) {
  await addLabel(number, NEEDS_HUMAN);
  await comment(number, 'content-review', `${text}\n\n<details><summary>Why this is waiting for a person</summary>\n\n${why}\n</details>`);
  setOutput('decision', 'hold');
}

try {
  const change = await loadChange(number);
  const { holds } = change.policy;
  if (holds.length) {
    await hold(
      'Thanks! This change includes something Anthony checks himself, so it will go live once he has looked at it, usually within a day.',
      holds.map(h => `- ${h.path ? describePath(h.path.split('.')) + ': ' : ''}${h.reason}`).join('\n'),
    );
  } else if (!change.policy.changes.length) {
    await hold('This request doesn’t seem to change anything on the website. Anthony will take a look.', 'No content changes found.');
  } else {
    const verdict = await reviewEdit({ changes: changeSummary(change), photos: await photoBlocks(change), messages: change.messages });
    if (verdict.decision === 'approve') {
      await comment(number, 'content-review', `${verdict.message_to_editor}\n\n<details><summary>Review</summary>\n\nApproved by Claude: ${verdict.reason}\n</details>`);
      setOutput('decision', 'approve');
    } else {
      await hold(verdict.message_to_editor, `Claude: ${verdict.reason}`);
    }
  }
} catch (e) {
  console.error(e);
  // A failed review never publishes anything; it waits for a person instead.
  await hold('Thanks! The automatic check couldn’t finish, so Anthony will look at this change himself, usually within a day.', `The review step failed: ${e.message}`)
    .catch(err => { console.error(err); setOutput('decision', 'hold'); });
}
