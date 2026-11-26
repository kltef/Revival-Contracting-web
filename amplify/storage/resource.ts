import { defineStorage } from '@aws-amplify/backend';
import { contentApi } from '../functions/content-api/resource';

// Gallery photos uploaded from the admin page. Visitors can only view them.
// The website editor's files: photos it uploads (content-uploads/), its change requests (content-requests/)
// and the keys set on the admin page (editor-settings/). Only the content-api function reads the last two.
export const storage = defineStorage({
  name: 'revivalGallery',
  access: (allow) => ({
    'gallery/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'content-uploads/*': [
      allow.authenticated.to(['read', 'write']),
      allow.resource(contentApi).to(['read']),
    ],
    'content-requests/*': [allow.resource(contentApi).to(['read', 'write'])],
    'editor-settings/*': [allow.resource(contentApi).to(['read', 'write'])],
  }),
});
