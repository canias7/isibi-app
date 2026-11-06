// SIGN-IN, THE PAGE'S SIDE (2026-11-05: moved to the server). The page talks
// only to Coder's Worker (/api/auth/*), which talks to Supabase. The page keeps
// its session (the tokens) and asks the Worker for a fresh one before it ends.
//
// BOTH STEPS, EVERY TIME (the audit, 2026-11-06): the password step gives a
// ticket, kept here until the code step sends it back; the code step gives the
// session and the Worker's proof that both steps happened, kept with the
// session and sent with every call to Coder (x-coder-proof). A session without
// a proof (every one from before this change) is not used: sign in once more.
const SESSION_KEY = 'gf_session_v1';
const AGAIN_KEY = 'gf_signin_again';

const Auth = (() => {
  let session = null; // { access_token, refresh_token, expires_at (ms), user: { id, email }, proof }
  let ticket = '';    // from the password step, for the code step (15 minutes)

  const usable = (s) => (s && typeof s.access_token === 'string' && s.access_token && typeof s.proof === 'string' && s.proof ? s : null);
  function load() { try { session = usable(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')); } catch (e) { session = null; } return session; }
  function save(s) { session = usable(s); try { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  async function post(action, body, token, proof) {
    let r;
    try {
      r = await fetch('/api/auth/' + action, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(proof ? { 'x-coder-proof': proof } : {}) }, body: JSON.stringify(body || {}) });
    } catch (e) { throw new Error('Sign-in could not be reached. Check your connection.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(d.error || 'Something went wrong'); err.ended = !!d.ended; err.restart = !!d.restart; throw err; }
    return d;
  }

  /** Password checked; a code is emailed; the ticket is kept for the code step. */
  async function signIn(email, password) { const d = await post('signin', { email, password }); ticket = d.ticket || ''; return d; }
  /** A new account: `{ step: 'code', type }`, and the ticket is kept for the code step. */
  async function signUp(email, password) { const d = await post('signup', { email, password }); ticket = d.ticket || ''; return d; }
  /** The emailed code, with the ticket → signed in, with the proof. */
  async function verifyCode(email, code, type) {
    const d = await post('verify', { email, code, type, ticket });
    save({ ...d.session, proof: d.proof });
    if (!session) throw new Error('Sign-in did not finish. Try again.');
    ticket = '';
    return session;
  }

  // ONE REFRESH AT A TIME, across tabs too: two refreshes with the same token
  // would end the session everywhere. `refused`: the token Coder just refused,
  // renewed even when it looks fresh (a clock running behind), unless another
  // tab already did.
  let refreshing = null;
  function refresh(refused) {
    if (!session || !session.refresh_token) return Promise.resolve(null);
    if (refreshing) return refreshing;
    const run = async () => {
      const stored = load();
      if (stored && stored.expires_at - Date.now() > 60000 && stored.access_token !== refused) return stored;
      if (!stored || !stored.refresh_token) return null;
      // The proof goes along; the Worker hands it back while it is valid. What
      // the Worker returns is kept: no proof back means sign in again.
      try { const d = await post('refresh', { refresh_token: stored.refresh_token, proof: stored.proof }); save({ ...d.session, proof: d.proof }); return session; }
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
    const token = session && session.access_token, proof = session && session.proof;
    save(null);
    if (token) { try { await post('logout', {}, token, proof); } catch (e) {} }
  }

  // THE SESSION ENDED ON THE SERVER (the audit, 2026-11-06: the page stayed
  // stuck when a session ended on another device): it is ended here too and the
  // page goes back to sign-in, once, however many calls were refused. The page
  // reloads only when this browser really forgot the session, so it never loops.
  let ending = false;
  function end() {
    if (ending) return;
    ending = true;
    save(null);
    const kept = load();
    session = null;
    if (kept) return; // this browser would bring it back after a reload: no reload
    try { sessionStorage.setItem(AGAIN_KEY, '1'); } catch (e) {}
    location.reload();
  }
  /** True once after `end()`: the sign-in card says "Sign in again." */
  function justEnded() {
    try { const v = sessionStorage.getItem(AGAIN_KEY); sessionStorage.removeItem(AGAIN_KEY); return v === '1'; } catch (e) { return false; }
  }

  // Another tab signed in or out: follow it.
  window.addEventListener('storage', (e) => {
    if (e.key !== SESSION_KEY) return;
    const had = !!session;
    try { session = usable(e.newValue ? JSON.parse(e.newValue) : null); } catch (err) { session = null; }
    if (had !== !!session) location.reload();
  });

  load();
  return {
    signIn, signUp, verifyCode, refresh, accessToken, signOut, end, justEnded,
    isSignedIn: () => !!session,
    proof: () => (session && session.proof) || '',
    email: () => (session && session.user && session.user.email) || '',
    userId: () => (session && session.user && session.user.id) || '',
  };
})();

window.Auth = Auth;
