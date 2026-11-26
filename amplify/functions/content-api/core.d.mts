export const LABEL: string;
export const NEEDS_HUMAN: string;
export const LIVE: string;
export const EDITOR_MARK: string;
export class UserError extends Error {}
export interface ContentApi {
  run(action: string, payload?: Record<string, unknown>, ctx?: { editorName?: string }): Promise<Record<string, unknown>>;
}
export function createApi(options: {
  token: string | undefined;
  repo: string | undefined;
  base?: string;
  fetch?: typeof fetch;
  getObject: (key: string) => Promise<{ bytes: Buffer; contentType: string }>;
  now?: () => number;
}): ContentApi;
export function statusOf(issue: unknown): { status: string; statusText: string; held: boolean };
export function toMessage(comment: unknown): { from: string; name: string; text: string; at: string };
