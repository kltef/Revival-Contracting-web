import { defineAuth } from '@aws-amplify/backend';

// Admin sign-in for /admin. Self sign-up is switched off in backend.ts,
// so the only accounts are the ones created in the Cognito console.
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
