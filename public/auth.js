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

  async function signIn(email, password) {
    return adopt(await gotrue('token?grant_type=password', { email, password }));
  }

  async function signUp(email, password) {
    const data = await gotrue('signup', { email, password });
    // Email-confirmation OFF → signup returns a full session.
    // Email-confirmation ON  → returns a user but no token; caller must verify email.
    if (data.access_token) return { session: adopt(data), needsConfirm: false };
    return { session: null, needsConfirm: true };
  }

  // Passwordless: email a one-time code (GoTrue sends it per the OTP template).
  // create_user lets first-time emails sign up in the same step.
  async function sendCode(email) {
    await gotrue('otp', { email, create_user: true });
    return true;
  }

  // Verify the 6-digit code the user typed → a full session.
  async function verifyCode(email, token) {
    return adopt(await gotrue('verify', { type: 'email', email, token }));
  }

  async function refresh() {
    if (!session || !session.refresh_token) return null;
    try {
      return adopt(await gotrue('token?grant_type=refresh_token', {
        refresh_token: session.refresh_token,
      }));
    } catch { saveSession(null); return null; }
  }

  // Returns a valid access token, refreshing first if it's within a minute of expiry.
  async function accessToken() {
    if (!session) return null;
    if (session.expires_at && Date.now() > session.expires_at - 60000) {
      await refresh();
    }
    return session ? session.access_token : null;
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

  loadSession();
  return {
    signIn, signUp, sendCode, verifyCode, refresh, accessToken, signOut, storageDelete,
    isSignedIn: () => !!(session && session.access_token),
    email: () => (session && session.user && session.user.email) || '',
  };
})();

window.Auth = Auth;
