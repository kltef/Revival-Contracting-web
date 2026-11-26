import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Schema } from '../../data/resource';
import { createApi, UserError } from './core.mjs';

const s3 = new S3Client();

// Photos the editor uploaded to S3 (content-uploads/*), read so they can be committed to GitHub
async function getObject(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.revivalGallery_BUCKET_NAME, Key: key }));
  const bytes = Buffer.from(await res.Body!.transformToByteArray());
  return { bytes, contentType: res.ContentType || '' };
}

type Claims = { name?: string; given_name?: string };

export const handler: Schema['contentApi']['functionHandler'] = async (event) => {
  const { action, payload } = event.arguments;
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : (payload ?? {});
  // The editor's name is shown on GitHub, so never use their email address here.
  const claims = ((event.identity as { claims?: Claims } | null)?.claims) ?? {};
  const editorName = claims.name || claims.given_name || 'Website editor';
  try {
    const api = createApi({
      token: process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPO,
      base: process.env.CONTENT_BASE_BRANCH || 'main',
      getObject,
    });
    return await api.run(action, parsed, { editorName });
  } catch (e) {
    console.error(e);
    // Only messages written for the editor are passed on; anything else stays in the logs.
    if (e instanceof UserError) throw e;
    throw new Error('Something went wrong talking to GitHub. Please try again in a few minutes.');
  }
};
