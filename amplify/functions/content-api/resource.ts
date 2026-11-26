import { defineFunction, secret } from '@aws-amplify/backend';

// Turns website edits from the admin page into GitHub pull requests and wakes Claude's review routine.
// Set the token once per environment: `npx ampx sandbox secret set GITHUB_TOKEN` locally,
// or Amplify console → Hosting → Secrets for a deployed branch. See README → Website editor.
export const contentApi = defineFunction({
  name: 'content-api',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    GITHUB_TOKEN: secret('GITHUB_TOKEN'),
    // Claude's website-edit routine (claude.ai/code/routines → the task's API trigger): its fire URL and token
    ROUTINE_FIRE_URL: secret('ROUTINE_FIRE_URL'),
    ROUTINE_TOKEN: secret('ROUTINE_TOKEN'),
    GITHUB_REPO: 'kltef/Revival-Contracting-web',
    CONTENT_BASE_BRANCH: 'main',
  },
});
