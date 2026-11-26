import { defineFunction, secret } from '@aws-amplify/backend';

// Turns website edits from the admin page into GitHub pull requests.
// Set the token once per environment: `npx ampx sandbox secret set GITHUB_TOKEN` locally,
// or Amplify console → Hosting → Secrets for a deployed branch. See README → Website editor.
export const contentApi = defineFunction({
  name: 'content-api',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    GITHUB_TOKEN: secret('GITHUB_TOKEN'),
    GITHUB_REPO: 'kltef/Revival-Contracting-web',
    CONTENT_BASE_BRANCH: 'main',
  },
});
