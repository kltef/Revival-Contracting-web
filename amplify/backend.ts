import { defineBackend } from '@aws-amplify/backend';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { contentApi } from './functions/content-api/resource';

const backend = defineBackend({ auth, data, storage, contentApi });

// Lock sign-in to accounts created in the Cognito console: nobody can sign themselves up.
backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// The webhook Claude's website-edit routine calls. It's a public address, but every request must carry
// the website key set on the admin page (checked in content-api/core.mjs). The admin page shows the address.
const hook = backend.contentApi.resources.lambda.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });
backend.addOutput({ custom: { contentHookUrl: hook.url } });
