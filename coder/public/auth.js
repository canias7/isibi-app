// SIGN-IN, THE PAGE'S SIDE (2026-11-05: moved to the server). The page talks
// only to Coder's Worker (/api/auth/*), which talks to Supabase. The page keeps
// its session (the tokens) and asks the Worker for a fresh one before it ends.
const SESSION_KEY = 'gf_session_v1';

const Auth = (() => {
  let session = null; // { access_token, refresh_token, expires_at (ms), user: { id, email } }

  function load() { try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { session = null; } return session; }
  function save(s) { session = s; try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  async function post(action, body, token) {
    let r;
    try {
      r = await fetch('/api/auth/' + action, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
    } catch (e) { throw new Error('Sign-in could not be reached. Check your connection.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(d.error || 'Something went wrong'); err.ended = !!d.ended; throw err; }
    return d;
  }

  /** Password checked; a code is emailed. */
  async function signIn(email, password) { return post('signin', { email, password }); }
  /** A new account: `{ session }` straight away, or `{ step: 'code' }`. */
  async function signUp(email, password) { const d = await post('signup', { email, password }); if (d.session) save(d.session); return d; }
  /** The emailed code → signed in. */
  async function verifyCode(email, code, type) { const d = await post('verify', { email, code, type }); save(d.session); return d.session; }

  // ONE REFRESH AT A TIME, across tabs too: two refreshes with the same token
  // would end the session everywhere.
  let refreshing = null;
  function refresh() {
    if (!session || !session.refresh_token) return Promise.resolve(null);
    if (refreshing) return refreshing;
    const run = async () => {
      const stored = load();
      if (stored && stored.expires_at - Date.now() > 60000) return stored;
      if (!stored || !stored.refresh_token) return null;
      try { const d = await post('refresh', { refresh_token: stored.refresh_token }); save(d.session); return d.session; }
      catch (e) {
        const now = load();
        if (now && now.refresh_token !== stored.refresh_token) return now; // another tab already did it
        if (e.ended) save(null);
        return null;
      }
    };
    refreshing = (navigator.locks && navigator.locks.request ? navigator.locks.request('gf-token-refresh', run) : run()).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function accessToken() {
    if (!session) return null;
    if (!session.expires_at || Date.now() > session.expires_at - 60000) await refresh();
    return session ? session.access_token : null;
  }
  async function signOut() {
    const token = session && session.access_token;
    save(null);
    if (token) { try { await post('logout', {}, token); } catch (e) {} }
  }

  // Another tab signed in or out: follow it.
  window.addEventListener('storage', (e) => {
    if (e.key !== SESSION_KEY) return;
    const had = !!session;
    try { session = e.newValue ? JSON.parse(e.newValue) : null; } catch (err) { session = null; }
    if (had !== !!session) location.reload();
  });

  load();
  return {
    signIn, signUp, verifyCode, refresh, accessToken, signOut,
    isSignedIn: () => !!(session && session.access_token),
    email: () => (session && session.user && session.user.email) || '',
    userId: () => (session && session.user && session.user.id) || '',
  };
})();

window.Auth = Auth;
