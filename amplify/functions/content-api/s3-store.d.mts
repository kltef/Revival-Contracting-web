import type { Store } from './core.mjs';
export function s3Store(options: {
  s3: { send(command: unknown): Promise<any> };
  bucket: string | undefined | (() => string | undefined);
  GetObjectCommand: new (input: any) => unknown;
  PutObjectCommand: new (input: any) => unknown;
  ListObjectsV2Command: new (input: any) => unknown;
}): Store;
