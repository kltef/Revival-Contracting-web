export const STATUS: Record<string, string>;
export const SETTINGS_KEY: string;
export function requestKey(id: string): string;
export class UserError extends Error {}
export class HttpError extends Error { status: number; constructor(status: number, message: string); }
export interface Store {
  getJson(key: string): Promise<any | null>;
  putJson(key: string, value: unknown): Promise<void>;
  list(prefix: string): Promise<string[]>;
  getBytes(key: string): Promise<{ bytes: Buffer; contentType: string } | null>;
}
export interface ContentApi {
  run(action: string, payload?: Record<string, unknown>, ctx?: { editorName?: string; userId?: string }): Promise<Record<string, unknown>>;
  hook(headers: Record<string, string | undefined>, body: string): Promise<Record<string, unknown>>;
}
export function createApi(options: {
  store: Store;
  content: unknown;
  fetch?: typeof fetch;
  now?: () => number;
  random?: () => string;
}): ContentApi;
