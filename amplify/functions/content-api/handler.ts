import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import content from '../../../src/content/site.json';
import { createApi, HttpError, UserError, type Store } from './core.mjs';

// Two ways in:
//  - from the admin page and editor (AppSync, signed in): the contentApi mutation
//  - from Claude's routine (the function URL, see backend.ts): the webhook, with the website key
const s3 = new S3Client();
const Bucket = process.env.revivalGallery_BUCKET_NAME;

const store: Store = {
  async getJson(key) {
    const obj = await this.getBytes(key);
    return obj ? JSON.parse(obj.bytes.toString('utf8')) : null;
  },
  async putJson(key, value) {
    await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: JSON.stringify(value), ContentType: 'application/json' }));
  },
  async list(prefix) {
    const keys: string[] = [];
    let ContinuationToken: string | undefined;
    do {
      const res = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }));
      keys.push(...(res.Contents ?? []).map(o => o.Key!).filter(Boolean));
      ContinuationToken = res.NextContinuationToken;
    } while (ContinuationToken);
    return keys;
  },
  async getBytes(key) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
      return { bytes: Buffer.from(await res.Body!.transformToByteArray()), contentType: res.ContentType || '' };
    } catch (e) {
      if ((e as { name?: string }).name === 'NoSuchKey') return null;
      throw e;
    }
  },
};

const api = createApi({ store, content });

type UrlEvent = { requestContext: { http: { method: string } }; headers?: Record<string, string>; body?: string; isBase64Encoded?: boolean };
type AppSyncEvent = { arguments: { action: string; payload?: unknown }; identity?: { sub?: string; claims?: { sub?: string; name?: string; given_name?: string } } | null };

const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const handler = async (event: UrlEvent | AppSyncEvent) => {
  if ('requestContext' in event && event.requestContext?.http) {
    if (event.requestContext.http.method !== 'POST') return json(405, { error: 'Use POST' });
    const body = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '');
    try {
      return json(200, await api.hook(event.headers ?? {}, body));
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Something went wrong' });
    }
  }

  const { action, payload } = (event as AppSyncEvent).arguments;
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : (payload ?? {});
  const identity = (event as AppSyncEvent).identity ?? {};
  // The editor's name is shown to Claude and Anthony, so never use their email address here.
  const claims = identity.claims ?? {};
  try {
    return await api.run(action, parsed, {
      editorName: claims.name || claims.given_name || 'Website editor',
      userId: identity.sub || claims.sub,
    });
  } catch (e) {
    console.error(e);
    if (e instanceof UserError) throw e;
    throw new Error('Something went wrong. Please try again in a few minutes.');
  }
};
