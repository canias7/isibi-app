// Stand-ins for the live API in tests.
export type Route = (url: string, init: any) => { status?: number; body?: any } | undefined;
export function fakeFetch(route: Route) {
  const calls: { url: string; init: any }[] = [];
  const fn = jest.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const r = route(String(url), init) || { status: 404, body: { error: 'not here' } };
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.body ?? {} } as any;
  });
  return Object.assign(fn, { calls }) as unknown as typeof fetch & { calls: typeof calls };
}
export const SESSION = { session: { access_token: 'tok1', refresh_token: 'ref1', expires_at: Date.now() + 3600e3, user: { id: 'u1', email: 'me@example.com' } }, proof: 'proof1' };
