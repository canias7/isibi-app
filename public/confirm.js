// Email links land here instead of GoTrue's redirect flow, so confirming works
// no matter what the project's Site URL is set to. Verifies the token directly
// and signs the user straight in. External file (not inline) so the CSP can keep
// script-src 'self' with no 'unsafe-inline'.
const SUPABASE_URL = 'https://ujrqdmmtcptvimazlhom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4';

document.getElementById('cGo').addEventListener('click', () => location.replace('/'));

async function run() {
  const p = new URLSearchParams(location.search);
  const token_hash = p.get('token_hash');
  const type = p.get('type') || 'signup';
  // Strip the single-use token from the URL + history right away so it doesn't
  // linger in the address bar or the browser's back-history.
  if (location.search) history.replaceState({}, '', location.pathname);
  const title = document.getElementById('cTitle');
  const text = document.getElementById('cText');
  const go = document.getElementById('cGo');
  if (!token_hash) {
    title.textContent = 'Missing link data';
    text.textContent = 'This link looks incomplete — request a fresh one from the sign-in screen.';
    go.style.display = ''; return;
  }
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ type, token_hash }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description || data.msg || 'Link is invalid or has expired');
    }
    localStorage.setItem('zephyr_session_v1', JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ? data.expires_at * 1000 : Date.now() + (data.expires_in || 3600) * 1000,
      user: data.user || null,
    }));
    title.textContent = 'Confirmed ✓';
    text.textContent = 'You’re signed in — taking you to isibi.ai…';
    setTimeout(() => location.replace('/'), 900);
  } catch (e) {
    title.textContent = 'Link expired';
    text.textContent = (e && e.message ? e.message : 'This link no longer works') + ' — request a fresh code from the sign-in screen.';
    go.style.display = '';
  }
}
run();
