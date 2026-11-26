import { defineFunction } from '@aws-amplify/backend';

// The website editor's backend: saves change requests, wakes Claude's website-edit routine, and serves
// the webhook the routine reports back to. Its keys are set on the admin page (Website → Connect Claude),
// not as AWS secrets. See docs/website-edit-routine.md.
export const contentApi = defineFunction({
  name: 'content-api',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
});
