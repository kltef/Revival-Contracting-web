// amplify_outputs.json is written by `npx ampx sandbox` locally and by the Amplify build in the cloud.
// Without it the site still runs: forms show their thank-you without sending, and the gallery uses the built-in photos.
const found = import.meta.glob('../amplify_outputs.json', { eager: true, import: 'default' });
export const outputs = Object.values(found)[0];
export const hasBackend = Boolean(outputs);

// Public pages load Amplify only when they first talk to the backend, so the pages themselves stay light.
// Visitors use guest access: they can read the gallery and send forms, nothing else.
let loading;
export function publicBackend() {
  loading ||= Promise.all([import('aws-amplify'), import('aws-amplify/data'), import('aws-amplify/storage')])
    .then(([{ Amplify }, { generateClient }, { getUrl }]) => {
      Amplify.configure(outputs);
      return { client: generateClient({ authMode: 'identityPool' }), getUrl };
    });
  return loading;
}

// Fetch every page of a model list
export async function listAll(model, options = {}) {
  const items = [];
  let nextToken = null;
  do {
    const { data, errors, nextToken: nt } = await model.list({ ...options, nextToken });
    if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
    items.push(...data);
    nextToken = nt;
  } while (nextToken);
  return items;
}
