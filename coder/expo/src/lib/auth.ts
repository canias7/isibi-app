// SIGN-IN, the app's side: the same as the web page's auth.js. A code is emailed (no passwords); the Worker's
// /api/auth/* talks to Supabase and hands back the session and its proof (x-coder-proof), sent with every call.
import { API_BASE } from './config';
import { defaultKV, type KV } from './storage';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
  user: { id: string; email: string };
  proof: string;
}

export class AuthError extends Error {
  ended: boolean;
  restart: boolean;
  constructor(message: string, ended = false, restart = false) {
    super(message);
    this.ended = ended;
    this.restart = restart;
  }
}

const SESSION_KEY = 'gf_session_v1';
type Fetch = typeof fetch;

const usable = (s: unknown): Session | null => {
  const x = s as Session | null;
  return x && typeof x.access_token === 'string' && x.access_token && typeof x.proof === 'string' && x.proof ? x : null;
};

export function createAuth(opts: { kv?: KV; fetchFn?: Fetch; base?: string } = {}) {
  const kv = opts.kv || defaultKV;
  const base = opts.base || API_BASE;
  const fetchFn: Fetch = opts.fetchFn || ((...a) => fetch(...a));
  let session: Session | null = null;
  let ticket = '';
  let refreshing: Promise<Session | null> | null = null;
  const listeners = new Set<(s: Session | null) => void>();

  async function save(s: Session | null) {
    session = usable(s);
    if (session) await kv.set(SESSION_KEY, JSON.stringify(session));
    else await kv.remove(SESSION_KEY);
    listeners.forEach((f) => f(session));
  }

  async function post(action: string, body: object, token?: string, proof?: string) {
    let r: Response;
    try {
      r = await fetchFn(base + '/api/auth/' + action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(proof ? { 'x-coder-proof': proof } : {}) },
        body: JSON.stringify(body || {}),
      });
    } catch {
      throw new AuthError('Sign-in could not be reached. Check your connection.');
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new AuthError(d.error || 'Something went wrong', !!d.ended, !!d.restart);
    return d;
  }

  return {
    /** The stored session, read once when the app opens. */
    async load() {
      try { session = usable(JSON.parse((await kv.get(SESSION_KEY)) || 'null')); } catch { session = null; }
      return session;
    },
    /** A code is emailed; a new email's first code also makes its account. */
    async sendCode(email: string): Promise<{ type: string }> {
      const d = await post('signin', { email: email.trim() });
      ticket = d.ticket || '';
      return { type: d.type || 'email' };
    },
    async verifyCode(email: string, code: string, type = 'email') {
      const d = await post('verify', { email: email.trim(), code: code.trim(), type, ticket });
      await save({ ...d.session, proof: d.proof });
      if (!session) throw new AuthError('Sign-in did not finish. Try again.');
      ticket = '';
      return session;
    },
    /** One renewal at a time (two with the same token would end the session). */
    refresh(refused?: string): Promise<Session | null> {
      if (!session || !session.refresh_token) return Promise.resolve(null);
      if (refreshing) return refreshing;
      const run = async () => {
        const s = session;
        if (!s) return null;
        if (s.expires_at - Date.now() > 60000 && s.access_token !== refused) return s;
        try {
          const d = await post('refresh', { refresh_token: s.refresh_token, proof: s.proof });
          await save({ ...d.session, proof: d.proof });
          return session;
        } catch (e) {
          if ((e as AuthError).ended) await save(null);
          return null;
        }
      };
      refreshing = run().finally(() => { refreshing = null; });
      return refreshing;
    },
    async accessToken() {
      if (!session) return null;
      if (!session.expires_at || Date.now() > session.expires_at - 60000) await this.refresh();
      return session ? session.access_token : null;
    },
    async signOut() {
      const s = session;
      await save(null);
      if (s) { try { await post('logout', {}, s.access_token, s.proof); } catch { /* signed out here anyway */ } }
    },
    /** The server said the session ended: forget it here too. */
    end: () => save(null),
    current: () => session,
    proof: () => (session && session.proof) || '',
    email: () => (session && session.user && session.user.email) || '',
    onChange(f: (s: Session | null) => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  };
}

export type Auth = ReturnType<typeof createAuth>;
