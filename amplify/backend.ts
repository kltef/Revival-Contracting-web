import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { contentApi } from './functions/content-api/resource';

const backend = defineBackend({ auth, data, storage, contentApi });

// Lock sign-in to accounts created in the Cognito console: nobody can sign themselves up.
backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};
