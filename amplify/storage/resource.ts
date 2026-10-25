import { defineStorage } from '@aws-amplify/backend';

// Gallery photos uploaded from the admin page. Visitors can only view them.
export const storage = defineStorage({
  name: 'revivalGallery',
  access: (allow) => ({
    'gallery/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
