import { createAuth } from '../lib/auth';
import { createApi } from '../lib/api';
import { memoryKV } from '../lib/storage';
import { fakeFetch, SESSION } from '../testing/helpers';

async function signedIn(route: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch((url, init) => (url.endsWith('/api/auth/verify') ? { body: SESSION } : route(url, init)));
  const auth = createAuth({ kv: memoryKV(), fetchFn: f, base: 'https://x.test' });
  await auth.verifyCode('me@example.com', '1');
  return { f, auth, api: createApi(auth, { fetchFn: f, base: 'https://x.test' }) };
}

test('sends the token and the proof with every call', async () => {
  const { f, api } = await signedIn(() => ({ body: { projects: [{ id: 'p1', repo: 'me/app' }] } }));
  const r = await api.projects();
  expect(r.data.projects[0].id).toBe('p1');
  const c = f.calls.at(-1)!;
  expect(c.url).toBe('https://x.test/api/coder/projects');
  expect(c.init.headers.Authorization).toBe('Bearer tok1');
  expect(c.init.headers['x-coder-proof']).toBe('proof1');
});

test('a message carries the model and effort; one sent while Coder works only its words', async () => {
  const { f, api } = await signedIn(() => ({ body: { ok: true } }));
  await api.send('p1', 'fix it', { model: 'grok-4.7', effort: 'low' });
  const b = JSON.parse(f.calls.at(-1)!.init.body);
  expect(f.calls.at(-1)!.url).toBe('https://x.test/api/coder/projects/p1/message');
  expect(b).toMatchObject({ text: 'fix it', model: 'grok-4.7', effort: 'low' });
  expect(b.mid).toMatch(/^m/);
  await api.send('p1', 'and this', { model: 'grok-4.7', effort: 'low' }, true);
  expect(Object.keys(JSON.parse(f.calls.at(-1)!.init.body)).sort()).toEqual(['mid', 'text']);
});

test('state, stop, mode and answer go to their endpoints', async () => {
  const { f, api } = await signedIn(() => ({ body: { ok: true } }));
  await api.state('p 1', 7);
  expect(f.calls.at(-1)!.url).toBe('https://x.test/api/coder/projects/p%201/state?since=7&early=1');
  await api.stop('p1');
  expect(f.calls.at(-1)!.url).toMatch(/\/projects\/p1\/stop$/);
  await api.setMode('p1', 'plan');
  expect(JSON.parse(f.calls.at(-1)!.init.body)).toEqual({ mode: 'plan' });
  await api.answer('p1', { pid: 'k1', choice: 'yes' });
  expect(f.calls.at(-1)!.url).toMatch(/\/answer$/);
  expect(JSON.parse(f.calls.at(-1)!.init.body)).toEqual({ pid: 'k1', choice: 'yes' });
});

test('a refused token is renewed and the call tried again; an ended session signs out', async () => {
  let n = 0;
  const { f, auth, api } = await signedIn((url) => {
    if (url.endsWith('/refresh')) return { body: { ...SESSION, session: { ...SESSION.session, access_token: 'tok2', expires_at: Date.now() + 3600e3 } } };
    n++;
    return n === 1 ? { status: 401, body: { error: 'sign in first' } } : { body: { connected: true } };
  });
  // The stored token looks fresh, so it is renewed only because it was refused.
  const r = await api.github();
  expect(r.status).toBe(200);
  expect(f.calls.at(-1)!.init.headers.Authorization).toBe('Bearer tok2');
  const r2 = await (await signedIn(() => ({ status: 401, body: { signin: true } }))).api.github();
  expect(r2.status).toBe(401);
  expect(auth.current()).not.toBeNull();
});

test('no network says so', async () => {
  const { auth } = await signedIn(() => undefined);
  const api = createApi(auth, { fetchFn: (async () => { throw new Error('offline'); }) as any });
  const r = await api.projects();
  expect(r.status).toBe(0);
  expect(r.data.error).toMatch(/could not be reached/);
});
