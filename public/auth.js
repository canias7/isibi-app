// Email/password auth against Supabase GoTrue via plain fetch (no SDK).
// The anon key is public by design. Sessions persist in localStorage and the
// access token is refreshed just before it expires.
const SUPABASE_URL = 'https://ujrqdmmtcptvimazlhom.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4';
const SESSION_KEY = 'zephyr_session_v1';

const Auth = (() => {
  let session = null; // { access_token, refresh_token, expires_at (ms), user }

  function loadSession() {
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { session = null; }
    return session;
  }
  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  async function gotrue(pathAndQuery, body) {
    const res = await fetch(SUPABASE_URL + '/auth/v1/' + pathAndQuery, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.error || 'Something went wrong');
    }
    return data;
  }

  // GoTrue token responses carry a session; store it with an absolute expiry.
  function adopt(data) {
    const expires_at = data.expires_at
      ? data.expires_at * 1000
      : Date.now() + (data.expires_in || 3600) * 1000;
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at,
      user: data.user || null,
    });
    return session;
  }

  // Validate a password WITHOUT persisting a session — so the emailed-code
  // step can't be skipped (throws on bad credentials / unconfirmed email).
  async function checkPassword(email, password) {
    await gotrue('token?grant_type=password', { email, password });
    return true;
  }

  async function signUp(email, password) {
    const data = await gotrue('signup', { email, password });
    // Email-confirmation OFF → signup returns a full session.
    // Email-confirmation ON  → returns a user but no token; caller must verify email.
    if (data.access_token) return { session: adopt(data), needsConfirm: false };
    return { session: null, needsConfirm: true };
  }

  // Email a one-time code (GoTrue sends it per the OTP template).
  // createUser only for sign-up-style flows; false on sign-in so a typo'd
  // email can't silently mint an account.
  async function sendCode(email, createUser) {
    await gotrue('otp', { email, create_user: !!createUser });
    return true;
  }

  // Send a password-reset (recovery) code.
  async function recover(email) {
    await gotrue('recover', { email });
    return true;
  }

  // Verify the emailed code → a full session. type: 'email' (sign-in OTP),
  // 'signup' (confirm a new account), or 'recovery' (password reset).
  async function verifyCode(email, token, type) {
    return adopt(await gotrue('verify', { type: type || 'email', email, token }));
  }

  // A single in-flight refresh is shared by all callers — the poll loop, sync,
  // and credits fetch can all land in the expiry window at once, and firing
  // parallel refreshes with the same rotating token trips GoTrue's reuse
  // detection and revokes the whole family.
  let refreshing = null;
  async function refresh() {
    if (!session || !session.refresh_token) return null;
    if (refreshing) return refreshing;
    const rt = session.refresh_token;
    refreshing = (async () => {
      try {
        return adopt(await gotrue('token?grant_type=refresh_token', { refresh_token: rt }));
      } catch (e) {
        // Only a genuine auth rejection (GoTrue HTTP error) invalidates the
        // session. A network failure (fetch throws a TypeError) leaves it
        // intact so a later call can retry instead of hard-signing-out.
        if (e && e.name === 'TypeError') return null;
        // Another tab may have rotated the token while this refresh was in
        // flight — then GoTrue rejects our now-stale `rt` as reuse, but the
        // session in storage is the fresh valid one. Don't wipe it.
        if (session && session.refresh_token && session.refresh_token !== rt) return null;
        saveSession(null);
        return null;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  // Another tab may rotate the token, sign in, or sign out. Adopt its session
  // so this tab doesn't later refresh with a revoked token — and if the
  // signed-in state flipped (in↔out), reload so the UI matches (the gate
  // appears on sign-out, the app on sign-in) instead of lagging until a 401.
  window.addEventListener('storage', (e) => {
    if (e.key !== SESSION_KEY) return;
    const had = !!session;
    try { session = e.newValue ? JSON.parse(e.newValue) : null; } catch { session = null; }
    if (had !== !!session) location.reload();
  });

  // Returns a valid access token, refreshing first if it's within a minute of
  // expiry — or if the expiry is missing/invalid (fail toward a refresh).
  async function accessToken() {
    if (!session) return null;
    if (!session.expires_at || Date.now() > session.expires_at - 60000) {
      await refresh();
    }
    return session ? session.access_token : null;
  }

  // Set a new password for the signed-in user.
  async function updatePassword(newPassword) {
    const token = await accessToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Could not change the password');
    return true;
  }

  // Delete an object from the media bucket (RLS only allows your own folder).
  async function storageDelete(path) {
    const token = await accessToken();
    if (!token) return false;
    const res = await fetch(SUPABASE_URL + '/storage/v1/object/media/' + path, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY },
    });
    return res.ok;
  }

  async function signOut() {
    const token = session && session.access_token;
    saveSession(null);
    if (token) {
      try {
        await fetch(SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
        });
      } catch {}
    }
  }

  // Global sign-out: GoTrue revokes every refresh token on every device, then
  // this browser drops its copy. Refresh first so the revoke call can't land
  // with an expired token and silently do nothing.
  async function signOutEverywhere() {
    const token = await accessToken();
    saveSession(null);
    if (token) {
      try {
        await fetch(SUPABASE_URL + '/auth/v1/logout?scope=global', {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
        });
      } catch {}
    }
  }

  // Permanent account deletion via the delete_account RPC (SECURITY DEFINER —
  // wipes chats, credits, usage, storage rows, every session, and the auth
  // user itself). Throws if the server refuses; clears the session on success.
  async function deleteAccount() {
    const token = await accessToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/delete_account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
      },
      body: '{}',
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message || d.error || 'Could not delete the account');
    }
    saveSession(null);
    return true;
  }

  // Best-effort: remove every file in the caller's media folder via the
  // Storage API (clean byte removal). The delete_account RPC sweeps whatever
  // this misses, so a failure here never blocks deletion.
  async function storageWipeOwn() {
    try {
      const token = await accessToken();
      const uid = (session && session.user && session.user.id) || '';
      if (!token || !uid) return;
      const list = await fetch(SUPABASE_URL + '/storage/v1/object/list/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
        body: JSON.stringify({ prefix: uid + '/', limit: 1000 }),
      });
      if (!list.ok) return;
      const names = (await list.json()).map((o) => uid + '/' + o.name).filter((n) => !n.endsWith('/'));
      if (!names.length) return;
      await fetch(SUPABASE_URL + '/storage/v1/object/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
        body: JSON.stringify({ prefixes: names }),
      });
    } catch {}
  }

  loadSession();
  return {
    checkPassword, signUp, sendCode, recover, verifyCode, refresh, accessToken,
    signOut, signOutEverywhere, deleteAccount, storageWipeOwn, storageDelete, updatePassword,
    isSignedIn: () => !!(session && session.access_token),
    email: () => (session && session.user && session.user.email) || '',
    userId: () => (session && session.user && session.user.id) || '',
  };
})();

window.Auth = Auth;
