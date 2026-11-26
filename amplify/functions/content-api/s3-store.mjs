// The content-api function's storage, on the site's S3 bucket.
//
// The function may list only inside its own folders (Amplify's storage rules), so S3 answers a read of a
// file that doesn't exist with AccessDenied rather than NoSuchKey. When that happens, a list inside the
// folder (which is allowed) tells "missing" apart from a real permission problem.
export function s3Store({ s3, bucket, GetObjectCommand, PutObjectCommand, ListObjectsV2Command }) {
  const store = {
    async getJson(key) {
      const obj = await store.getBytes(key);
      return obj ? JSON.parse(obj.bytes.toString('utf8')) : null;
    },
    async putJson(key, value) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify(value), ContentType: 'application/json' }));
    },
    async list(prefix) {
      const keys = [];
      let ContinuationToken;
      do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
        keys.push(...(res.Contents ?? []).map(o => o.Key).filter(Boolean));
        ContinuationToken = res.NextContinuationToken;
      } while (ContinuationToken);
      return keys;
    },
    async getBytes(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { bytes: Buffer.from(await res.Body.transformToByteArray()), contentType: res.ContentType || '' };
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null;
        if (e?.name === 'AccessDenied' || e?.$metadata?.httpStatusCode === 403) {
          const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: key, MaxKeys: 1 }));
          if (!(res.Contents ?? []).some(o => o.Key === key)) return null;
        }
        throw e;
      }
    },
  };
  return store;
}
