import { defineStorage } from '@aws-amplify/backend';
import { contentApi } from '../functions/content-api/resource';

// Gallery photos uploaded from the admin page. Visitors can only view them.
// content-uploads/ holds photos from the website editor until content-api copies them into GitHub.
export const storage = defineStorage({
  name: 'revivalGallery',
  access: (allow) => ({
    'gallery/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'content-uploads/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.resource(contentApi).to(['read']),
    ],
  }),
});
