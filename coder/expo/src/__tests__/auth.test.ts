import { createAuth } from '../lib/auth';
import { memoryKV } from '../lib/storage';
import { fakeFetch, SESSION } from '../testing/helpers';

test('emails a code, then signs in with it and keeps the session and proof', async () => {
  const f = fakeFetch((url, init) => {
    const b = JSON.parse(init.body);
    if (url.endsWith('/api/auth/signin')) return { body: { ticket: 'T1', type: 'email' } };
    if (url.endsWith('/api/auth/verify')) { expect(b).toEqual({ email: 'me@example.com', code: '123456', type: 'email', ticket: 'T1' }); return { body: SESSION }; }
  });
  const kv = memoryKV();
  const auth = createAuth({ kv, fetchFn: f, base: 'https://x.test' });
  await auth.sendCode(' me@example.com ');
  const s = await auth.verifyCode('me@example.com', '123456');
  expect(s.proof).toBe('proof1');
  expect(auth.email()).toBe('me@example.com');
  expect(JSON.parse(kv.data.gf_session_v1).access_token).toBe('tok1');
  const again = createAuth({ kv, fetchFn: f });
  expect((await again.load())?.access_token).toBe('tok1');
});

test('a wrong code says why and keeps you signed out', async () => {
  const f = fakeFetch(() => ({ status: 400, body: { error: 'That code is wrong.' } }));
  const auth = createAuth({ kv: memoryKV(), fetchFn: f });
  await expect(auth.verifyCode('a@b.c', '1')).rejects.toThrow('That code is wrong.');
  expect(auth.current()).toBeNull();
});

test('an old token is renewed once, and sign out forgets the session', async () => {
  let refreshes = 0;
  const f = fakeFetch((url) => {
    if (url.endsWith('/refresh')) { refreshes++; return { body: { ...SESSION, session: { ...SESSION.session, access_token: 'tok2' } } }; }
    if (url.endsWith('/verify')) return { body: { ...SESSION, session: { ...SESSION.session, expires_at: Date.now() - 1 } } };
    if (url.endsWith('/logout')) return { body: {} };
  });
  const auth = createAuth({ kv: memoryKV(), fetchFn: f });
  await auth.verifyCode('a@b.c', '1');
  const [a, b] = await Promise.all([auth.accessToken(), auth.accessToken()]);
  expect(a).toBe('tok2'); expect(b).toBe('tok2'); expect(refreshes).toBe(1);
  await auth.signOut();
  expect(auth.current()).toBeNull();
  expect(f.calls.at(-1)!.url).toContain('/api/auth/logout');
});
