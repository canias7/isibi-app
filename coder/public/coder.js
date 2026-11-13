// CODER'S SCREEN (2026-11-05, the owner: "just make it like Claude Code … more
// like a chat, more like a cursor"). Its own file, apart from the website
// the page (index.html), which hands it the space to draw in
// (`window.CoderView.mount`). Served by Coder's own Worker, same address.
(function () {
  'use strict';
  // ONE SCREEN, TWO AGENTS (owner, 2026-11-09): Coder's chat, and Gloopy's in its own tab, drawn by the same code (each
  // with its own state), so the two look and work alike. KIND is 'coder' or 'gloopy'; the code inside keeps its indent.
  // GLOOPY NEEDS YOU (the docs, 2026-11-10; Grok Bot's sidebar shows "Needs attention" for a question, approval or
  // handoff): a mark on Gloopy's tab while Gloopy waits for your answer, whichever tab you are on.
  const gloopyWaits = (p) => !!(p && p.status !== 'running' && (p.pending || p.waiting));
  function markGloopy(on) {
    const t = typeof document !== 'undefined' && document.querySelector('.gf-tab[data-agent="gloopy"]');
    if (!t) return;
    t.classList.toggle('needs-you', !!on);
    t.title = on ? 'Gloopy agent · needs you' : 'Gloopy agent';
    t.setAttribute('aria-label', t.title);
  }
  function makeView(KIND) {
  const GLOOPY = KIND === 'gloopy';
  const API = '/api/coder';
  const POLL_MS = 1500;
  // THE MODEL LIST AND THE USER'S PICK come from the server
  // (2026-11-05: "put it server side"); the page only shows them.
  let MODELS = [{ id: 'grok-4.7', name: 'Grok 4.7', efforts: ['low', 'medium', 'high', 'xhigh'], effort: 'high' }];
  const EFFORT_NAME = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high' };
  async function loadSettings() {
    const r = await call('/settings');
    if (r.status === 200 && r.data) {
      if (Array.isArray(r.data.models) && r.data.models.length) MODELS = r.data.models;
      if (r.data.pick) S.pick = r.data.pick;
    }
  }
  function savePick() { call('/settings', { method: 'POST', body: JSON.stringify(S.pick) }); }

  // ONE STATE for the whole screen, kept across redraws: chat.js redraws the
  // right-hand area often, and the screen must come back where it was.
  const S = {
    phase: 'loading', // loading | off | connect | pick | chat | error
    error: '',
    github: null,     // { connected, login, install }
    repos: null,      // [{ repo, branch, private }]
    projects: [],     // [{ id, name, repo, at }]
    project: null,    // the open project's meta
    events: [],
    next: 0,
    running: false,
    sending: false,
    draft: (() => { try { const a = sessionStorage.getItem('gf_ask') || ''; sessionStorage.removeItem('gf_ask'); return a.slice(0, 4000); } catch (e) { return ''; } })(), // the landing page's ask, kept
    unsent: '',       // a message on its way, kept if the session ends meanwhile
    drafts: {},       // each chat's own message box (text, pictures, line comments) while another chat is open
    open: {},         // which command outputs are opened
    root: null,
    poll: 0,
    pick: null,
    openFiles: {},  // which files are open in See changes
    comments: [],   // [{ file, line, quote, text }] from See changes
    commenting: null, // { file, line, quote } while writing one
    webOK: false,   // Gloopy: its machine has a browser (the full image, on Fly.io)
    attach: [],     // Gloopy: files attached to the next message, already sent to the Worker: [{ id, name, size }] (or { name, up: true } while sending)
    cards: [],      // Gloopy: the owner's saved cards, as the Worker lists them (brand, last 4 digits, expiry; never a number)
    logins: [],     // Gloopy: the owner's saved logins, as the Worker lists them (site and username; never a password)
    payUse: null,   // Gloopy: on the card form, { id, use } (a saved card's id, or '' for another card)
    web: null,      // Gloopy: the live view of its browser, while open (webOpen)
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // THE OWNER'S TIME ZONE, from this device (the docs, 2026-11-10; Grok Bot's Timezone "Auto-detect follows this computer").
  const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };
  // CODER'S QUESTIONS (owner pick 4, 2026-11-08): 1 to 4 in a card; a card from before has one (text, options, multi).
  const askQuestions = (e) => (Array.isArray(e.questions) && e.questions.length ? e.questions : [e]).slice(0, 4).map((q) => ({
    text: String((q && q.text) || ''), header: String((q && q.header) || ''), multi: !!(q && q.multi === true),
    options: ((q && q.options) || []).map((o) => (typeof o === 'string' ? { label: o, description: '' } : { label: String((o && o.label) || ''), description: String((o && o.description) || '') })).filter((o) => o.label),
  }));
  /** The answer a card sends: one question's choices as before; several, each on its own line after its header. */
  const askReply = (a) => {
    if (!a || !Array.isArray(a.answers)) return '';
    // A choice is sent without its "(Recommended)" (that was Coder's own word).
    const said = a.answers.map((x) => x.picked.map((v) => (v === '__other' ? x.other.trim() : v.replace(/\s*\(Recommended\)$/i, ''))).filter(Boolean).join(', '));
    if (!said.some(Boolean)) return '';
    if (a.answers.length === 1) return said[0];
    return a.qs.map((q, k) => (q.header || q.text) + ': ' + (said[k] || '(no answer)')).join('\n');
  };

  // THE SIGN-IN PROOF goes with the token on every call (the audit, 2026-11-06).
  // A call refused because the session is over (signed out here or on another
  // device, or a session without the proof) ends the session on this page and
  // goes back to sign-in. A token refused as old gets one fresh token and one
  // more try, never more; other refusals (like "Connect GitHub again") stay as they are.
  async function call(path, init, again) {
    // Going back to sign-in reloads the page, so what is in the chat box (or a
    // message that was just being sent) is kept for after sign-in, where the box
    // picks it up again (the audit, 2026-11-06, after review).
    const end = () => { try { const t = S.draft || S.unsent || ''; if (t) sessionStorage.setItem('gf_ask', t.slice(0, 4000)); } catch (e) {} window.Auth.end(); };
    const token = window.Auth && typeof window.Auth.accessToken === 'function' ? await window.Auth.accessToken() : null;
    if (!token) { if (window.Auth && window.Auth.end) end(); return { status: 401, data: { error: 'sign in first' } }; }
    let r;
    try {
      // A FILE'S OWN BYTES (Gloopy's attachments, 2026-11-09): sent as they are, with the file's name.
      const raw = init && init.raw ? init.raw : null;
      r = await fetch(API + path, { ...(init || {}), ...(raw ? { body: raw } : {}), headers: { Authorization: 'Bearer ' + token, 'x-coder-proof': window.Auth.proof(), ...(raw ? { 'content-type': raw.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(raw.name || 'file') } : init && init.body ? { 'content-type': 'application/json' } : {}) } });
    } catch (e) { return { status: 0, data: { error: (GLOOPY ? 'Gloopy' : 'Coder') + ' could not be reached. Check your connection.' } }; }
    // A FILE TO SAVE (a read-only chat's patch, owner item 5): handed back whole when it came.
    if (r.ok && typeof (init || {}).file === 'string') return { status: r.status, data: {}, blob: await r.blob(), name: (/filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '') || [])[1] || init.file };
    // A STREAM (Gloopy's live view, 2026-11-10): handed back as it is, to be read as it comes.
    if (r.ok && (init || {}).stream === true && /^text\/event-stream/.test(r.headers.get('content-type') || '')) return { status: r.status, data: {}, stream: r };
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && (data.signin === true || data.error === 'sign in first')) {
      if (data.signin !== true && !again) {
        const fresh = await window.Auth.refresh(token);
        if (fresh && fresh.access_token !== token) return call(path, init, true);
        // THE RENEWAL ONLY FAILED FOR NOW (no network, Supabase busy or down): the
        // session is kept and this call says so. Only a session the Worker said has
        // ended (auth.js has then forgotten it) goes back to sign-in (the audit,
        // 2026-11-06, after review).
        if (window.Auth.isSignedIn()) return { status: 0, data: { error: 'Sign-in could not be checked. Try again in a minute.' } };
      }
      end();
    }
    return { status: r.status, data };
  }

  // ── LOADING: who am I on GitHub, which projects ───────────────────────────
  async function load() {
    if (GLOOPY) return loadGloopy();
    loadSettings().then(() => draw());
    S.phase = 'loading'; draw();
    const g = await call('/github');
    if (g.status === 404) { S.phase = 'off'; return draw(); }
    if (g.status === 403) { S.phase = 'error'; S.error = 'Coder is not open to this account yet.'; return draw(); }
    if (g.status !== 200) { S.phase = 'error'; S.error = (g.data && g.data.error) || 'Coder could not be reached.'; return draw(); }
    S.github = g.data;
    if (!g.data.connected) { S.phase = 'connect'; return draw(); }
    const p = await call('/projects');
    S.projects = (p.data && p.data.projects) || [];
    if (DESKTOP_APP) startDesktopWatch();
    // A NOTIFICATION'S CHAT (owner item 8): /?chat=<id> opens it.
    const want = new URLSearchParams(location.search).get('chat');
    if (want) { try { history.replaceState(history.state, '', location.pathname); } catch (e) {} }
    if (want && S.projects.some((x) => x.id === want)) return openProject(want);
    if (S.projects.length) return openProject(S.projects[0].id);
    return showPicker('new');
  }

  // GLOOPY'S TAB (owner, 2026-11-09): your one Gloopy, made the first time it is asked for; its chat opens at once.
  async function loadGloopy() {
    loadSettings().then(() => draw());
    S.phase = 'loading'; draw();
    const g = await call('/gloopy');
    if (g.status === 404) { S.phase = 'off'; return draw(); }
    if (g.status === 403) { S.phase = 'error'; S.error = 'Gloopy is not open to this account yet.'; return draw(); }
    if (g.status !== 200 || !g.data || !g.data.gloopy) { S.phase = 'error'; S.error = (g.data && g.data.error) || 'Gloopy could not be reached.'; return draw(); }
    S.webOK = g.data.browser === true;
    S.cards = Array.isArray(g.data.cards) ? g.data.cards : [];
    S.logins = Array.isArray(g.data.logins) ? g.data.logins : [];
    const opened = openProject(g.data.gloopy.id);
    opened.then(() => desktopRouteSync()).catch(() => {});
    return opened;
  }
  // GLOOPY'S BROWSER, THROUGH THIS COMPUTER (the owner, 2026-11-11: "Yes do that"; Grok Bot's "Route traffic through
  // this computer"): only in the Go Farther app (its preload gives the page these four controls). While the switch is
  // on, the app keeps a link to Gloopy's computer, with a ticket the page gets for it: at load, and every 50 minutes
  // while the page is open (a ticket lasts 12 hours). Sending a message or taking over nudges it (Gloopy's computer has
  // just woken).
  const DESKTOP_ROUTE = typeof window !== 'undefined' && window.gofartherDesktop && window.gofartherDesktop.route ? window.gofartherDesktop.route : null;
  // HARDWARE SECURITY KEYS (2026-11-11; Grok Bot's "Use hardware security keys"): only the Go Farther app for Mac or Windows
  // reaches your key (plugged into that computer); it signs a page's request in Gloopy's browser for that page's site only.
  const DESKTOP_KEY = typeof window !== 'undefined' && window.gofartherDesktop && window.gofartherDesktop.securityKey ? window.gofartherDesktop.securityKey : null;
  // What became of the app's try, in words.
  // (`q`, the request: one that names no key, as a passkey's, is one the app can't pick a key for on every computer: live
  // test, 2026-11-11, the app's own window refused it at once where a key named by the site signed.)
  const keyWords = (r, q) => { const n = r && r.error; return n === 'NotAllowedError' ? (q && Array.isArray(q.allowCredentials) && !q.allowCredentials.length ? 'Your key wasn’t used. This site didn’t say which key it wants (as with passkeys), and on this computer the app can’t pick one yet. Choose “Not now” and sign in another way.' : 'Your key wasn’t used: it timed out, or it was cancelled. Try again.') : n === 'InvalidStateError' ? 'That key isn’t one this site knows. Try another of your keys.' : n === 'SecurityError' ? 'This computer couldn’t sign that site’s request.' : String((r && r.message) || 'Your key couldn’t be used.').slice(0, 200); };
  async function desktopRouteSync() {
    if (!DESKTOP_ROUTE || !S.project || !GLOOPY) return;
    if (S.routeTimer) clearTimeout(S.routeTimer);
    S.routeTimer = setTimeout(desktopRouteSync, 50 * 60 * 1000);
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/route', { method: 'POST', body: JSON.stringify({ ticket: true }) });
    try {
      if (r.status === 200 && r.data && r.data.ticket) await DESKTOP_ROUTE.start({ url: r.data.url, ticket: r.data.ticket });
      else if (r.status === 409) await DESKTOP_ROUTE.stop();
    } catch (e) { /* the app said no */ }
  }
  const desktopRouteKick = () => { if (DESKTOP_ROUTE) DESKTOP_ROUTE.kick().catch(() => {}); };

  async function showPicker(mode) {
    stopPoll(); S.pickMode = mode || 'new'; S.phase = 'pick'; S.repos = null; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); draw();
    const r = await call('/github/repos');
    if (r.data && r.data.connect) { S.phase = 'connect'; return draw(); }
    S.repos = (r.data && r.data.repos) || [];
    if (r.data && r.data.install && S.github) S.github.install = r.data.install;
    // CODE REVIEW, PER REPOSITORY (owner item 11, like Claude Code's "Review runs"): on the Repositories screen.
    if (S.pickMode === 'repos') { const rs = await call('/review/settings'); S.reviews = (rs.data && rs.data.repos) || {}; }
    draw();
  }

  // CODE REVIEW ON OR OFF FOR A REPOSITORY, and its level (owner item 11).
  async function saveReview(repo, change) {
    const cur = (S.reviews || {})[repo] || { runs: 'off', level: 'standard' };
    const next = { runs: cur.runs, level: cur.level || 'standard', ...change };
    const r = await call('/review/settings', { method: 'POST', body: JSON.stringify({ repo, runs: next.runs, level: next.level }) });
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'Code review could not be changed.'; return draw(); }
    S.reviews = { ...(S.reviews || {}) };
    if (next.runs === 'off') delete S.reviews[repo]; else S.reviews[repo] = { runs: next.runs, level: next.level };
    S.error = '';
    draw();
  }

  async function connect() {
    const r = await call('/github/start');
    if (r.data && r.data.url) location.href = r.data.url;
    else { S.error = (r.data && r.data.error) || 'GitHub could not be opened.'; draw(); }
  }

  async function addProject(repo) {
    const r = await call('/projects', { method: 'POST', body: JSON.stringify({ repo }) });
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'That repository could not be added.'; return draw(); }
    S.projects = [entryOf(r.data.project), ...S.projects];
    openProject(r.data.project.id);
  }

  // A REPOSITORY'S NAME from what was typed: owner/name, or its GitHub address (owner item 5).
  function repoName(v) {
    const t = String(v || '').trim();
    const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[\/?#].*)?$/.exec(t) || /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?$/.exec(t);
    return m ? m[1] + '/' + m[2] : '';
  }
  // A READ-ONLY CHAT'S WORK AS A PATCH FILE (owner item 5): from Coder's machine, the only place it is.
  async function downloadPatch() {
    if (!S.project) return;
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/patch', { file: 'coder.patch' });
    if (!r.blob) { S.error = (r.data && r.data.error) || 'The patch could not be made.'; return draw(); }
    // As a data: address, like the pictures (the page's rules block blob: ones).
    const href = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result || '')); fr.onerror = () => ok(''); fr.readAsDataURL(r.blob); });
    if (!href) { S.error = 'The patch could not be saved.'; return draw(); }
    const a = document.createElement('a'); a.href = href; a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
  }

  // THE CHAT LIST (each chat its own session): what the sidebar shows.
  const entryOf = (m) => ({ id: m.id, repo: m.repo, title: m.title || '', status: m.status || 'idle', pr: m.pr ? (m.pr.number || m.pr) : null, at: m.at, waiting: m.waiting || null, ran: Number(m.ran) || 0 });
  function syncEntry() {
    if (!S.project) return;
    const e = entryOf(S.project);
    const i = S.projects.findIndex((x) => x.id === e.id);
    if (i >= 0) S.projects[i] = { ...S.projects[i], ...e, title: e.title || S.projects[i].title };
  }
  // CODER'S OWN "ARE YOU SURE?" (not the browser's popup).
  function askSure(title, text, yes) {
    return new Promise((done) => {
      const wrap = document.createElement('div'); wrap.className = 'cd-sure';
      const box = document.createElement('div'); box.className = 'cd-sure-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      const h = document.createElement('div'); h.className = 'cd-sure-title'; h.textContent = title;
      const p = document.createElement('div'); p.className = 'cd-sure-text'; p.textContent = text;
      const row = document.createElement('div'); row.className = 'cd-sure-row';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'cd-sure-no'; no.textContent = 'Cancel';
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'cd-sure-yes'; ok.textContent = yes;
      row.append(no, ok); box.append(h, p, row); wrap.append(box); document.body.append(wrap);
      const end = (v) => { document.removeEventListener('keydown', key); wrap.remove(); done(v); };
      const key = (e) => { if (e.key === 'Escape') end(false); if (e.key === 'Enter') end(true); };
      no.onclick = () => end(false); ok.onclick = () => end(true);
      wrap.onclick = (e) => { if (e.target === wrap) end(false); };
      document.addEventListener('keydown', key); ok.focus();
    });
  }
  // NOTIFICATIONS ON THIS DEVICE (owner item 8, like Claude Code's: "Push when Claude decides" and "Push when
  // actions required", none while you are looking at the chat). Web Push: the browser's own push service.
  const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const keyBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  async function deviceSub() {
    if (!canPush()) return null;
    try { const reg = await navigator.serviceWorker.getRegistration('/'); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; }
  }
  async function showNotifications() {
    const r = await call('/push');
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'Notifications could not be opened.'; return draw(); }
    const info = r.data;
    let sub = await deviceSub();
    const wrap = document.createElement('div'); wrap.className = 'cd-sure';
    const box = document.createElement('div'); box.className = 'cd-sure-box cd-notify'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Notifications');
    wrap.append(box); document.body.append(wrap);
    const close = () => { document.removeEventListener('keydown', key); wrap.remove(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    let note = '';
    const paint = () => {
      const blocked = canPush() && Notification.permission === 'denied';
      const local = DESKTOP_APP && 'Notification' in window;
      const localOn = local && Notification.permission === 'granted' && localNotifyOn();
      box.innerHTML = '<div class="cd-sure-title">Notifications</div>' +
        '<div class="cd-sure-text">Like Claude Code’s: Coder tells you when a long job finishes or when you asked it to, and when it needs your answer. Never about a chat you’re looking at.</div>' +
        '<div class="cd-notify-device">' + (local ? (localOn ? '<span class="cd-notify-on">On in this app</span><button type="button" id="cdLocalOff">Turn off here</button><span class="cd-notify-hint">The desktop app shows them while it’s open (minimized is fine).</span>' : '<button type="button" class="cd-notify-go" id="cdLocalOn">Turn on in this app</button><span class="cd-notify-hint">The desktop app shows them while it’s open (minimized is fine).</span>')
          : !canPush() ? '<span>This browser can’t get notifications. On iPhone, add gofarther.dev to your Home Screen (Share, then Add to Home Screen) and open it from there.</span>'
          : blocked ? '<span>Notifications are blocked for gofarther.dev in this browser’s settings.</span>'
          : sub ? '<span class="cd-notify-on">On for this device</span><button type="button" id="cdNotifyOff">Turn off here</button>'
          : '<button type="button" class="cd-notify-go" id="cdNotifyOn">Turn on for this device</button>') + '</div>' +
        '<label class="cd-notify-sw"><input type="checkbox" id="cdPushDecides"' + (info.decides ? ' checked' : '') + '><span><b>Push when Coder decides</b><br>A long job finished, or you asked to be told (“notify me when the tests finish”).</span></label>' +
        '<label class="cd-notify-sw"><input type="checkbox" id="cdPushActions"' + (info.actions ? ' checked' : '') + '><span><b>Push when actions are required</b><br>Coder asks you something, or needs a key or your approval.</span></label>' +
        (note ? '<div class="cd-notify-note">' + esc(note) + '</div>' : '') +
        '<div class="cd-sure-row">' + (info.devices || localOn ? '<button type="button" id="cdPushTest">Send a test</button>' : '') + '<button type="button" class="cd-notify-done" id="cdNotifyDone">Done</button></div>';
      const $ = (id) => box.querySelector('#' + id);
      $('cdNotifyDone').onclick = close;
      const sw = async (field, el) => { const x = await call('/push/settings', { method: 'POST', body: JSON.stringify({ [field]: el.checked }) }); if (x.status === 200) { info[field] = el.checked; S.pushInfo = info; } else { el.checked = !el.checked; note = (x.data && x.data.error) || 'Not saved.'; paint(); } };
      $('cdPushDecides').onchange = (e) => sw('decides', e.currentTarget);
      $('cdPushActions').onchange = (e) => sw('actions', e.currentTarget);
      if ($('cdPushTest')) $('cdPushTest').onclick = async () => {
        // In the desktop app, a test shows here too; the server's goes to the devices turned on elsewhere.
        if (localOn) showLocal({ id: '', title: 'Coder', body: 'Notifications are on in this app.' });
        const x = info.devices ? await call('/push/test', { method: 'POST', body: '{}' }) : null;
        note = localOn || (x && x.status === 200 && x.data.sent) ? 'Sent. It should arrive in a few seconds.' : 'Nothing was sent: no device took it.';
        paint();
      };
      if ($('cdNotifyOn')) $('cdNotifyOn').onclick = async () => {
        try {
          if ((await Notification.requestPermission()) !== 'granted') { note = 'Notifications were not allowed.'; return paint(); }
          const reg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(info.key) });
          const j = sub.toJSON();
          const x = await call('/push/subscribe', { method: 'POST', body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }) });
          if (x.status !== 200) { note = (x.data && x.data.error) || 'This device could not be added.'; await sub.unsubscribe().catch(() => {}); sub = null; }
          else { info.devices = x.data.devices; note = 'On. Coder will notify this device.'; }
        } catch (e) { note = 'This device could not be added: ' + String((e && e.message) || e).slice(0, 120); }
        paint();
      };
      if ($('cdLocalOn')) $('cdLocalOn').onclick = async () => {
        if ((await Notification.requestPermission()) !== 'granted') { note = 'Notifications were not allowed.'; return paint(); }
        setLocalNotify(true); S.pushInfo = info; startDesktopWatch(); note = 'On. This app will show Coder’s notifications while it’s open.'; paint();
      };
      if ($('cdLocalOff')) $('cdLocalOff').onclick = () => { setLocalNotify(false); stopDesktopWatch(); note = 'Off in this app.'; paint(); };
      if ($('cdNotifyOff')) $('cdNotifyOff').onclick = async () => {
        const endpoint = sub ? sub.endpoint : '';
        try { if (sub) await sub.unsubscribe(); } catch (e) {}
        const x = await call('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
        if (x.status === 200) info.devices = x.data.devices;
        sub = null; note = 'Off for this device.'; paint();
      };
    };
    paint();
  }

  // GLOOPY'S SETTINGS (the owner, 2026-11-10: "all of it"; Grok Bot's Custom Rules under Auto Review, dots' Custom rules
  // under Permissions, OpenAI's website permissions): what Gloopy may do on its own (Ask, Always allow or Never for each
  // kind of step), the owner's rules in their own words (add, edit, delete) and their choice for each site. It lives
  // outside the redrawn chat (as Notifications does), so typing in it isn't lost while Gloopy works. A change that
  // closes a card waiting now shows in the chat behind it.
  const GSET_PERM_WORDS = { ask: 'Ask', allow: 'Always allow', deny: 'Never' };
  const GSET_SIGNED_HOW = { form: 'You signed in on the card', saved: 'With your saved login', code: 'With a code', 'took over': 'You signed in yourself' };
  // The menu down Settings' left (Grok Bot's): each page's key, name and icon.
  const GSET_ICON = (d) => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const GSET_PAGES = [
    ['perms', 'Permissions', GSET_ICON('<path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 10-4.1-1.7-7-5.6-7-10V6z"/>')],
    ['sites', 'Sites', GSET_ICON('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>')],
    ['vault', 'Vault', GSET_ICON('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8V7M12 17v-1.8M8.8 12H7M17 12h-1.8"/>')],
    ['computer', 'Computer', GSET_ICON('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>')],
  ];
  // Your rules, kind by kind (Grok Bot's Always Ask, then Allow without Asking): what each does, and an example.
  const GSET_RULE_ORDER = ['ask', 'allow', 'deny', 'handoff', 'when_asked'];
  const GSET_RULE_HINTS = { ask: 'Gloopy stops and asks you when a step fits one of these.', allow: 'Gloopy goes ahead without asking when a step fits one of these.', deny: 'Gloopy never takes a step that fits one of these. Never always wins.', handoff: 'Gloopy leaves a step that fits one of these to you.', when_asked: 'Gloopy takes a step that fits one of these only when your own message asks for it.' };
  const GSET_RULE_EXAMPLES = { ask: 'buy anything over $50', allow: 'read pages on news sites', deny: 'delete anything in my email', handoff: 'pay for something', when_asked: 'post on social media' };
  const gsetWhen = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  async function showGloopySettings() {
    if (!S.project) return;
    const base = '/projects/' + encodeURIComponent(S.project.id);
    const [pr, rr, sr, or, gr, cr, kr] = await Promise.all([call(base + '/permissions'), call(base + '/rules'), call(base + '/sites'), call(base + '/options'), call(base + '/signins'), call(base + '/cards'), call(base + '/contacts')]);
    if (pr.status !== 200 || rr.status !== 200 || sr.status !== 200 || or.status !== 200) { note(((pr.data || rr.data || sr.data || or.data || {}).error) || 'Gloopy’s settings could not be opened.'); return; }
    const st = {
      perms: pr.data.permissions || {}, permList: pr.data.list || [], permModes: pr.data.modes || ['ask', 'allow', 'deny'],
      rules: rr.data.rules || [], ruleModes: rr.data.modes || [], ruleWords: rr.data.words || {}, ruleMax: rr.data.max || 20,
      sites: sr.data.sites || [], siteModes: sr.data.modes || [], siteWords: sr.data.words || {}, siteMax: sr.data.max || 50,
      options: or.data.options || { monitor: true },
      // Where its browser is signed in, and your saved logins (the /signins card's), when they could be had.
      signins: gr.status === 200 && gr.data ? { sites: gr.data.sites || [], saved: gr.data.saved || [] } : null,
      // The Vault's cards and contact info (2026-11-13): never a card's number or security code, only whether one is kept.
      cards: cr.status === 200 && cr.data ? cr.data.cards || [] : null,
      contacts: kr.status === 200 && kr.data ? kr.data.contacts || [] : null,
      edit: '', editText: '', editMode: '', ruleText: '', ruleMode: 'ask', siteHost: '', siteMode: 'ask', outHost: '', note: '', busy: false,
      // The open page (the one you had open last, else Permissions) and the add form open on it (a rule's kind, or a site).
      page: GSET_PAGES.some(([k]) => k === S.gsetPage) ? S.gsetPage : 'perms', ruleOpen: '', siteOpen: false,
      // The Vault (2026-11-12): its search, what is open (`new`, `import`, or a login's id to change), the New item menu,
      // the form's words (never its password: that is read from the box when saved), a removal to confirm, and an
      // export read on this device (its rows, passwords and all, only until they are imported or cancelled).
      vault: { q: '', open: '', menu: false, site: '', user: '', nick: '', hint: '', sure: '', imp: null,
        // Its tabs (2026-11-13: Grok Bot's Vault holds logins, cards and contact info), and the card and contact forms' words
        // (never a card's number, expiry or security code: those are read from their boxes when saved).
        tab: 'logins', card: { nick: '', hint: '', name: '', postal: '', def: false, forget: false }, ct: {} },
    };
    const wrap = document.createElement('div'); wrap.className = 'cd-sure cd-gset-wrap';
    const box = document.createElement('div'); box.className = 'cd-sure-box cd-gset'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Gloopy’s settings');
    wrap.append(box); document.body.append(wrap);
    const close = () => { document.removeEventListener('keydown', key); wrap.remove(); };
    const key = (e) => { if (e.key === 'Escape' && !st.edit) close(); };
    document.addEventListener('keydown', key);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    const opts = (modes, words, cur) => modes.map((m) => '<option value="' + esc(m) + '"' + (m === cur ? ' selected' : '') + '>' + esc(words[m] || m) + '</option>').join('');
    // THE VAULT (owner, 2026-11-12: "do all 5 make sure you do similar frontend compare to grok bot"; Grok Bot's Settings
    // → Vault): New item (a login, or logins brought over from a password manager's export), Search Vault, the logins
    // with their username and hint (never a password), each to change or remove; and Grok Bot's note under it. Cards
    // join it (its Payments) with the payment tool.
    const vaultForm = (l) => '<form class="cd-vault-form" data-gs="vault-save"' + (l ? ' data-id="' + esc(l.id) + '"' : '') + '>' +
      '<label class="cd-gset-l" for="gsVaultSite">Website</label><input id="gsVaultSite" class="cd-gset-in" type="text" inputmode="url" placeholder="github.com" value="' + esc(st.vault.site) + '"' + PM_OFF + '>' +
      '<label class="cd-gset-l" for="gsVaultUser">Username or email</label><input id="gsVaultUser" class="cd-gset-in" type="text" name="gf-private-vault-user" value="' + esc(st.vault.user) + '"' + PM_OFF + '>' +
      '<label class="cd-gset-l" for="gsVaultPass">Password' + (l ? ' <small>(leave it empty to keep the saved one)</small>' : '') + '</label>' + secretField('gsVaultPass') +
      '<label class="cd-gset-l" for="gsVaultNick">Nickname <small>(optional)</small></label><input id="gsVaultNick" class="cd-gset-in" type="text" maxlength="60" placeholder="A short name, like “Work GitHub”" value="' + esc(st.vault.nick) + '" autocomplete="off">' +
      '<label class="cd-gset-l" for="gsVaultHint">Hints <small>(optional)</small></label><input id="gsVaultHint" class="cd-gset-in" type="text" maxlength="200" placeholder="When Gloopy should use it, like “Use for work”" value="' + esc(st.vault.hint) + '" autocomplete="off">' +
      '<div class="cd-gset-addrow cd-vault-btns">' + (l ? '<button type="button" class="cd-vault-rm" data-vault-remove="' + esc(l.id) + '"' + (st.busy ? ' disabled' : '') + '>' + (st.vault.sure === l.id ? 'Remove for good?' : 'Remove') + '</button>' : '') +
      '<span class="cd-vault-sp"></span><button type="button" data-vault="cancel">Cancel</button><button type="submit" class="cd-gset-go"' + (st.busy ? ' disabled' : '') + '>Save login</button></div></form>';
    const vaultImport = () => {
      const imp = st.vault.imp;
      const intro = '<div class="cd-vault-form cd-vault-imp"><b class="cd-vault-impt">Import from CSV</b><p class="cd-gset-hint">Export your passwords as a CSV file from 1Password, Chrome or Edge, Safari or Apple Passwords, Firefox, Bitwarden or LastPass, then choose it here. It’s read on this device; the file itself is never uploaded. At most 5 MB.</p>';
      if (!imp) return intro + '<label class="cd-gset-go cd-vault-file"><input type="file" id="gsVaultFile" accept=".csv,text/csv"> Choose CSV file</label><div class="cd-gset-addrow cd-vault-btns"><span class="cd-vault-sp"></span><button type="button" data-vault="cancel">Cancel</button></div></div>';
      const ready = imp.rows.filter((r) => r.status === 'Ready'), have = imp.rows.filter((r) => r.status === 'Already in your Vault').length, bad = imp.rows.length - ready.length - have;
      return intro + '<p class="cd-vault-sum"><b>' + esc(imp.name) + '</b>: ' + ready.length + ' ready' + (have ? ' · ' + have + ' already in your Vault (skipped)' : '') + (bad ? ' · ' + bad + ' can’t be imported' : '') + '</p>' +
        '<ul class="cd-vault-review">' + imp.rows.slice(0, 300).map((r) => '<li class="' + (r.status === 'Ready' ? 'is-ok' : 'is-skip') + '"><span><b>' + esc(r.site) + '</b>' + (r.username ? '<small>' + esc(r.username) + '</small>' : '') + '</span><em>' + esc(r.status) + '</em></li>').join('') + (imp.rows.length > 300 ? '<li class="is-skip"><span>And ' + (imp.rows.length - 300) + ' more rows</span></li>' : '') + '</ul>' +
        '<div class="cd-gset-addrow cd-vault-btns"><span class="cd-vault-sp"></span><button type="button" data-vault="cancel">Cancel</button><button type="button" class="cd-gset-go" data-vault="do-import"' + (st.busy || !ready.length ? ' disabled' : '') + '>Import ' + ready.length + (ready.length === 1 ? ' login' : ' logins') + '</button></div></div>';
    };
    // CARDS AND CONTACT INFO IN THE VAULT (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's Vault: "Pick
    // Login, Card, or Contact info", "cards show only their last four digits", "Under Hints, tell your Bots when to use an
    // entry", "Default payment method, which Grok Bot pays with first"). A card's number, expiry and security code are read
    // from their boxes when it is saved, never kept in this page's state; a saved card's number is never shown again.
    const cardIn = (id, label, attrs) => '<label class="cd-gset-l" for="' + id + '">' + label + '</label><input id="' + id + '" class="cd-gset-in" ' + attrs + PM_OFF + ' spellcheck="false">';
    const cardForm = (c) => {
      const k = st.vault.card;
      return '<form class="cd-vault-form" data-gs="card-save"' + (c ? ' data-id="' + esc(c.id) + '"' : '') + '>' +
        (c ? '<p class="cd-vault-cardt">' + ICON.cardsm + '<b>' + esc(c.brand) + ' ending ' + esc(c.last4) + '</b><small>To change its number, remove it and add it again.</small></p>'
          // FROM A PHOTO (Grok Bot's "Scan with camera or Upload a photo to fill it from the card, or type it in").
          : '<div class="cd-vault-scan"><label class="cd-gset-pill cd-vault-file"><input type="file" id="gsCardCam" accept="image/*" capture="environment"> Scan with camera</label><label class="cd-gset-pill cd-vault-file"><input type="file" id="gsCardPhoto" accept="image/*"> Upload a photo</label></div>' +
            (st.vault.scanning ? '<p class="cd-gset-hint">Reading the card…</p>' : '<p class="cd-gset-hint">The photo is read once to fill this form, and isn’t kept. Gloopy never sees it. Check what it filled in.</p>') +
            cardIn('gsCardNumber', 'Card number', 'type="text" inputmode="numeric" autocomplete="off" placeholder="1234 1234 1234 1234" maxlength="23"')) +
        '<div class="cd-pay-two"><div>' + cardIn('gsCardExp', 'Expiry date', 'type="text" inputmode="numeric" autocomplete="off" placeholder="MM / YY" maxlength="7"' + (c ? ' value="' + esc(String(c.month).padStart(2, '0') + ' / ' + String(c.year).slice(-2)) + '"' : '')) + '</div>' +
        '<div>' + cardIn('gsCardCvc', 'Security code' + (c ? ' <small>(' + (c.code ? 'empty keeps the saved one' : 'none saved yet') + ')</small>' : ''), 'type="password" inputmode="numeric" autocomplete="off" placeholder="CVC" maxlength="4"') + '</div></div>' +
        '<label class="cd-gset-l" for="gsCardName">Name on card <small>(optional)</small></label><input id="gsCardName" class="cd-gset-in" type="text" maxlength="100" value="' + esc(k.name) + '" autocomplete="off">' +
        '<label class="cd-gset-l" for="gsCardPostal">Billing postal code <small>(' + (c ? 'empty keeps the saved one' : 'optional') + ')</small></label><input id="gsCardPostal" class="cd-gset-in" type="text" maxlength="12" value="' + esc(k.postal) + '" autocomplete="off">' +
        '<label class="cd-gset-l" for="gsCardNick">Nickname <small>(optional)</small></label><input id="gsCardNick" class="cd-gset-in" type="text" maxlength="60" placeholder="A short name, like “Work card”" value="' + esc(k.nick) + '" autocomplete="off">' +
        '<label class="cd-gset-l" for="gsCardHint">Hints <small>(optional)</small></label><input id="gsCardHint" class="cd-gset-in" type="text" maxlength="200" placeholder="When Gloopy should use it, like “Use for work purchases”" value="' + esc(k.hint) + '" autocomplete="off">' +
        '<label class="cd-sign-save"><input type="checkbox" id="gsCardDefault"' + (k.def ? ' checked' : '') + '> Default payment method: Gloopy pays with this card first</label>' +
        (c && c.code ? '<label class="cd-sign-save"><input type="checkbox" id="gsCardForget"' + (k.forget ? ' checked' : '') + '> Forget its security code, so the card form asks for it each time</label>' : '') +
        '<div class="cd-gset-addrow cd-vault-btns">' + (c ? '<button type="button" class="cd-vault-rm" data-card-remove="' + esc(c.id) + '"' + (st.busy ? ' disabled' : '') + '>' + (st.vault.sure === c.id ? 'Remove for good?' : 'Remove') + '</button>' : '') +
        '<span class="cd-vault-sp"></span><button type="button" data-vault="cancel">Cancel</button><button type="submit" class="cd-gset-go"' + (st.busy ? ' disabled' : '') + '>Save card</button></div></form>';
    };
    const CT_PARTS = [['name', 'Full name', 'autocomplete="off"'], ['line1', 'Street address', 'autocomplete="off"'], ['line2', 'Flat, suite or floor <small>(optional)</small>', 'autocomplete="off"'], ['city', 'City', 'autocomplete="off"'], ['region', 'State or region', 'autocomplete="off"'], ['postal', 'Postal code', 'autocomplete="off"'], ['country', 'Country', 'autocomplete="off"'], ['phone', 'Phone', 'type="tel" autocomplete="off"'], ['email', 'Email', 'type="email" autocomplete="off"']];
    const contactForm = (x) => '<form class="cd-vault-form" data-gs="contact-save"' + (x ? ' data-id="' + esc(x.id) + '"' : '') + '>' +
      CT_PARTS.map(([k, label, attrs]) => '<label class="cd-gset-l" for="gsCt_' + k + '">' + label + '</label><input id="gsCt_' + k + '" class="cd-gset-in" ' + (/type=/.test(attrs) ? '' : 'type="text" ') + attrs + ' maxlength="200" value="' + esc(st.vault.ct[k] || '') + '">').join('') +
      '<label class="cd-gset-l" for="gsCt_nickname">Nickname <small>(optional)</small></label><input id="gsCt_nickname" class="cd-gset-in" type="text" maxlength="60" placeholder="A short name, like “Home” or “Work”" value="' + esc(st.vault.ct.nickname || '') + '" autocomplete="off">' +
      '<label class="cd-gset-l" for="gsCt_hint">Hints <small>(optional)</small></label><input id="gsCt_hint" class="cd-gset-in" type="text" maxlength="200" placeholder="When Gloopy should use it, like “Ship gifts here”" value="' + esc(st.vault.ct.hint || '') + '" autocomplete="off">' +
      '<div class="cd-gset-addrow cd-vault-btns">' + (x ? '<button type="button" class="cd-vault-rm" data-contact-remove="' + esc(x.id) + '"' + (st.busy ? ' disabled' : '') + '>' + (st.vault.sure === x.id ? 'Remove for good?' : 'Remove') + '</button>' : '') +
      '<span class="cd-vault-sp"></span><button type="button" data-vault="cancel">Cancel</button><button type="submit" class="cd-gset-go"' + (st.busy ? ' disabled' : '') + '>Save contact info</button></div></form>';
    const placeOf = (x) => [x.line1, x.line2, x.city, [x.region, x.postal].filter(Boolean).join(' '), x.country].filter(Boolean).join(', ');
    const vaultHTML = () => {
      const v = st.vault, all = st.signins ? st.signins.saved : null, cards = st.cards || [], contacts = st.contacts || [];
      const head = '<div class="cd-vault-head"><h2 class="cd-gset-pt">Vault</h2><span class="cd-vault-new"><button type="button" class="cd-vault-newbtn" data-vault="menu" aria-haspopup="menu" aria-expanded="' + (v.menu ? 'true' : 'false') + '"' + (st.busy || !all ? ' disabled' : '') + '>New item ' + ICON.chev + '</button>' +
        (v.menu ? '<span class="cd-vault-menu" role="menu"><button type="button" role="menuitem" data-vault="new">' + ICON.key + 'Login</button><button type="button" role="menuitem" data-vault="new-card">' + ICON.cardsm + 'Card</button><button type="button" role="menuitem" data-vault="new-contact">' + ICON.person + 'Contact info</button><button type="button" role="menuitem" data-vault="import">' + ICON.doc + 'Import from CSV…</button></span>' : '') + '</span></div>';
      if (!all) return '<section class="cd-vault">' + head + '<p class="cd-gset-none">Your Vault couldn’t be loaded. Close this and try again.</p></section>';
      const q = v.q.trim().toLowerCase();
      const hit = (xs) => !q || xs.some((x) => String(x || '').toLowerCase().includes(q));
      const bar = '<div class="cd-vault-bar"><span class="cd-vault-tabs" role="tablist">' + [['logins', 'Logins', all.length], ['cards', 'Cards', cards.length], ['contacts', 'Contact info', contacts.length]].map(([k, label, n]) => '<button type="button" role="tab" class="cd-vault-tab' + (v.tab === k ? ' is-on' : '') + '" data-vault-tab="' + k + '" aria-selected="' + (v.tab === k ? 'true' : 'false') + '">' + label + ' <i>' + n + '</i></button>').join('') + '</span><input id="gsVaultQ" class="cd-vault-q" type="search" placeholder="Search Vault" value="' + esc(v.q) + '" aria-label="Search Vault" autocomplete="off"></div>';
      const list = (rows, more) => '<div class="cd-gset-card cd-vault-card"><ul class="cd-gset-list cd-vault-list">' + rows.slice(0, 200).join('') + '</ul></div>' + (more || '');
      if (v.tab === 'cards') {
        if (st.cards === null) return '<section class="cd-vault">' + head + bar + '<p class="cd-gset-none">Your cards couldn’t be loaded. Close this and try again.</p></section>';
        const shown = cards.filter((c) => hit([c.brand, c.last4, c.nickname, c.hint, c.name])).slice().reverse();
        const row = (c) => v.open === c.id ? '<li class="cd-vault-item is-open">' + cardForm(c) + '</li>'
          : '<li class="cd-vault-item"><span class="cd-vault-ic">' + ICON.cardsm + '</span><span class="cd-gset-text">' + (c.nickname ? '<b class="cd-vault-nick">' + esc(c.nickname) + '</b><small>' + esc(c.brand) + ' ending ' + esc(c.last4) + ' · ' : '<b>' + esc(c.brand) + ' ending ' + esc(c.last4) + '</b><small>') + 'Expires ' + esc(String(c.month).padStart(2, '0') + '/' + String(c.year).slice(-2)) + (c.name ? ' · ' + esc(c.name) : '') + '</small>' +
            '<small class="cd-vault-tags">' + (c.default ? '<span class="cd-vault-tag is-def">Default</span>' : '') + '<span class="cd-vault-tag">' + (c.code ? 'Fills in without asking' : 'Asks for its security code') + '</span></small>' + (c.hint ? '<small class="cd-vault-hint">' + esc(c.hint) + '</small>' : '') + '</span>' +
            '<span class="cd-gset-btns"><button type="button" data-card-edit="' + esc(c.id) + '"' + (st.busy ? ' disabled' : '') + '>Edit</button><button type="button" data-card-remove="' + esc(c.id) + '"' + (st.busy ? ' disabled' : '') + '>' + (v.sure === c.id ? 'Remove for good?' : 'Remove') + '</button></span></li>';
        return '<section class="cd-vault">' + head + bar + (v.open === 'new-card' ? cardForm(null) : '') +
          (!cards.length ? '<p class="cd-gset-none cd-vault-empty">No cards yet. Add one with New item, or keep “Save to your Vault” ticked on a card form.</p>'
            : !shown.length ? '<p class="cd-gset-none cd-vault-empty">No card matches “' + esc(v.q.trim()) + '”.</p>' : list(shown.map(row))) +
          '<p class="cd-vault-foot">Gloopy never sees a saved card’s number or security code. It sees each card’s name, last 4 digits and hints, so it can pick the right one, and its computer fills the card in. A saved card fills in at checkout without asking you; with Buy or pay on Ask (in Permissions), you still see each order and choose Pay or Cancel.</p></section>';
      }
      if (v.tab === 'contacts') {
        if (st.contacts === null) return '<section class="cd-vault">' + head + bar + '<p class="cd-gset-none">Your contact info couldn’t be loaded. Close this and try again.</p></section>';
        const shown = contacts.filter((x) => hit([x.name, placeOf(x), x.phone, x.email, x.nickname, x.hint])).slice().reverse();
        const row = (x) => v.open === x.id ? '<li class="cd-vault-item is-open">' + contactForm(x) + '</li>'
          : '<li class="cd-vault-item"><span class="cd-vault-ic">' + ICON.person + '</span><span class="cd-gset-text">' + (x.nickname ? '<b class="cd-vault-nick">' + esc(x.nickname) + '</b><small>' + esc(x.name || '') + '</small>' : '<b>' + esc(x.name || x.email || x.phone || 'Contact info') + '</b>') +
            (placeOf(x) ? '<small>' + esc(placeOf(x)) + '</small>' : '') + ((x.phone || x.email) ? '<small>' + esc([x.phone, x.email].filter(Boolean).join(' · ')) + '</small>' : '') + (x.hint ? '<small class="cd-vault-hint">' + esc(x.hint) + '</small>' : '') + '</span>' +
            '<span class="cd-gset-btns"><button type="button" data-contact-edit="' + esc(x.id) + '"' + (st.busy ? ' disabled' : '') + '>Edit</button><button type="button" data-contact-remove="' + esc(x.id) + '"' + (st.busy ? ' disabled' : '') + '>' + (v.sure === x.id ? 'Remove for good?' : 'Remove') + '</button></span></li>';
        return '<section class="cd-vault">' + head + bar + (v.open === 'new-contact' ? contactForm(null) : '') +
          (!contacts.length ? '<p class="cd-gset-none cd-vault-empty">No contact info yet. Add your name and address with New item, or give them to Gloopy in a chat.</p>'
            : !shown.length ? '<p class="cd-gset-none cd-vault-empty">No contact info matches “' + esc(v.q.trim()) + '”.</p>' : list(shown.map(row))) +
          '<p class="cd-vault-foot">Gloopy can see your contact info, to fill in shipping and billing details for you. When you give it a name, address, phone number or email in a chat, it saves them here and tells you.</p></section>';
      }
      const shown = all.filter((l) => hit([l.site, l.username, l.nickname, l.hint])).slice().reverse();
      const row = (l) => v.open === l.id ? '<li class="cd-vault-item is-open">' + vaultForm(l) + '</li>'
        : '<li class="cd-vault-item"><span class="cd-vault-ic">' + ICON.key + '</span><span class="cd-gset-text">' + (l.nickname ? '<b class="cd-vault-nick">' + esc(l.nickname) + '</b><small><span class="cd-gset-host">' + esc(l.site) + '</span> · ' : '<b class="cd-gset-host">' + esc(l.site) + '</b><small>') + esc(l.username || 'No username') + (l.made ? ' · <span class="cd-vault-made">Password made by Gloopy</span>' : '') + '</small>' + (l.hint ? '<small class="cd-vault-hint">' + esc(l.hint) + '</small>' : '') + '</span>' +
          '<span class="cd-gset-btns"><button type="button" data-vault-edit="' + esc(l.id) + '"' + (st.busy ? ' disabled' : '') + '>Edit</button><button type="button" data-vault-remove="' + esc(l.id) + '"' + (st.busy ? ' disabled' : '') + '>' + (v.sure === l.id ? 'Remove for good?' : 'Remove') + '</button></span></li>';
      return '<section class="cd-vault">' + head + bar +
        (v.open === 'new' ? vaultForm(null) : v.open === 'import' ? vaultImport() : '') +
        (!all.length ? '<p class="cd-gset-none cd-vault-empty">Nothing saved yet. Add a login with New item, or tick “Save to your Vault” on a sign-in card.</p>'
          : !shown.length ? '<p class="cd-gset-none cd-vault-empty">No login matches “' + esc(v.q.trim()) + '”.</p>'
          : list(shown.map(row), shown.length > 200 ? '<p class="cd-gset-hint">' + (shown.length - 200) + ' more: search to find one.</p>' : '')) +
        '<p class="cd-vault-foot">Gloopy never sees a saved password. It sees each login’s website, username and hints, so it can pick the right one, and its computer types the password in for it.</p></section>';
    };
    const paint = () => {
      const top = box.querySelector('.cd-gset-body') ? box.querySelector('.cd-gset-body').scrollTop : 0;
      // What is being typed in a password or card box is put back after the redraw (it is never kept in this page's state).
      const typed = ['gsVaultPass', 'gsCardNumber', 'gsCardExp', 'gsCardCvc'].map((k) => { const n = box.querySelector('#' + k); return [k, n ? n.value : '']; }), focused = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : '';
      // GLOOPY'S SETTINGS AS GROK BOT'S (owner, 2026-11-12: "yes make the menu like grok bot , very similar"): a menu down
      // the left, an icon and a name for each page (the open one on a grey pill), the page's title at its top, its settings
      // in white cards under small grey labels (each a name and a line about it on the left, its control on the right: a
      // drop-down, a switch or a grey button, as Grok Bot's Theme, Check Spelling and Add Rule), and × in the top corner.
      // Rules sit under their kind, each kind with its own Add rule (Grok Bot's Always Ask and Allow without Asking). On a
      // phone, the menu is a row of tabs on top.
      const busy = st.busy ? ' disabled' : '';
      const what = (b, small) => '<span class="cd-gset-what"><b>' + b + '</b>' + (small ? '<small>' + small + '</small>' : '') + '</span>';
      const toggle = (id, on, label) => '<input type="checkbox" role="switch" class="cd-gset-tog" id="' + id + '"' + (on ? ' checked' : '') + busy + ' aria-label="' + label + '">';
      const ruleRow = (r) => st.edit === r.id
        ? '<li class="cd-gset-item is-edit"><form data-gs="save-rule" data-id="' + esc(r.id) + '"><textarea class="cd-gset-in" id="gsEditText" rows="2" maxlength="1000" aria-label="The rule">' + esc(st.editText) + '</textarea><div class="cd-gset-addrow"><select id="gsEditMode" class="cd-gset-dd" aria-label="What Gloopy should do">' + opts(st.ruleModes, st.ruleWords, st.editMode) + '</select><span class="cd-vault-sp"></span><button type="button" data-gs="cancel-edit">Cancel</button><button type="submit" class="cd-gset-go">Save rule</button></div></form></li>'
        : '<li class="cd-gset-item"><span class="cd-gset-text">' + esc(r.text) + '</span><span class="cd-gset-btns"><button type="button" data-gs-edit="' + esc(r.id) + '">Edit</button><button type="button" data-gs-del="' + esc(r.id) + '" aria-label="Delete this rule">Delete</button></span></li>';
      const ruleKinds = GSET_RULE_ORDER.filter((m) => st.ruleModes.includes(m)).concat(st.ruleModes.filter((m) => !GSET_RULE_ORDER.includes(m)));
      const sec = {
        watch: () => '<section><div class="cd-gset-card"><label class="cd-gset-row">' + what('Watch over each run', 'A second AI looks over what Gloopy does as it works, every few steps and right after anything is refused, and pauses the run if Gloopy seems to get around a safeguard or do what you didn’t ask. It uses a little more Grok.') + toggle('gsMonitor', st.options.monitor, 'Watch over each run') + '</label></div></section>',
        perms: () => '<section><h3 class="cd-gset-sl">What Gloopy may do on its own</h3><div class="cd-gset-card"><p class="cd-gset-cardnote">For each kind of step: ask you first, always allow it, or never do it. Your rules and your sites come first. Gloopy’s safety check runs either way.</p>' +
          st.permList.map((x) => '<div class="cd-gset-row">' + what(esc(x.label), esc(x.hint)) + '<select class="cd-gset-dd m-' + esc(st.perms[x.key] || '') + '" data-perm="' + esc(x.key) + '" aria-label="' + esc(x.label) + '"' + busy + '>' +
            st.permModes.map((m) => '<option value="' + esc(m) + '"' + (st.perms[x.key] === m ? ' selected' : '') + '>' + esc(GSET_PERM_WORDS[m] || m) + '</option>').join('') + '</select></div>').join('') + '</div></section>',
        rules: () => '<section><h3 class="cd-gset-sl">Your rules</h3><div class="cd-gset-card"><p class="cd-gset-cardnote">In your own words. A rule that fits a step comes before the settings above. Up to ' + st.ruleMax + ' of each kind.</p>' +
          ruleKinds.map((m) => {
            const mine = st.rules.filter((r) => r.mode === m);
            return '<div class="cd-gset-kind"><div class="cd-gset-row">' + what(esc(st.ruleWords[m] || m), esc(GSET_RULE_HINTS[m] || '')) + '<button type="button" class="cd-gset-pill" data-gs-rule-new="' + esc(m) + '"' + busy + '>Add rule</button></div>' +
              (st.ruleOpen === m ? '<form class="cd-gset-add" data-gs="add-rule"><label class="cd-gset-l" for="gsRuleText">When Gloopy wants to</label><textarea id="gsRuleText" class="cd-gset-in" rows="2" maxlength="1000" placeholder="' + esc(GSET_RULE_EXAMPLES[m] || '') + '">' + esc(st.ruleText) + '</textarea>' +
                '<div class="cd-gset-addrow"><span class="cd-vault-sp"></span><button type="button" data-gs="cancel-rule">Cancel</button><button type="submit" class="cd-gset-go"' + busy + '>Add rule</button></div></form>' : '') +
              (mine.length ? '<ul class="cd-gset-list">' + mine.map(ruleRow).join('') + '</ul>' : '') + '</div>';
          }).join('') + '</div></section>',
        sites: () => '<section><div class="cd-gset-card"><div class="cd-gset-row">' + what('Your sites', 'What Gloopy’s browser may do on a site and its subdomains.') + '<button type="button" class="cd-gset-pill" data-gs="site-new"' + busy + '>Add site</button></div>' +
          (st.siteOpen ? '<form class="cd-gset-add cd-gset-siteadd" data-gs="add-site"><input id="gsSiteHost" class="cd-gset-in" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="shop.example" value="' + esc(st.siteHost) + '" aria-label="Site"><select id="gsSiteMode" class="cd-gset-dd" aria-label="Choice for this site">' + opts(st.siteModes, st.siteWords, st.siteMode) + '</select>' +
            '<button type="button" data-gs="cancel-site">Cancel</button><button type="submit" class="cd-gset-go"' + busy + '>Add site</button></form>' : '') +
          (st.sites.length ? '<ul class="cd-gset-list">' + st.sites.map((x) => '<li class="cd-gset-item"><span class="cd-gset-text cd-gset-host">' + esc(x.host) + '</span><select class="cd-gset-dd m-' + esc(x.mode) + '" data-site="' + esc(x.host) + '" aria-label="Choice for ' + esc(x.host) + '"' + busy + '>' + opts(st.siteModes, st.siteWords, x.mode) + '</select><span class="cd-gset-btns"><button type="button" data-gs-unsite="' + esc(x.host) + '" aria-label="Remove ' + esc(x.host) + '">Remove</button></span></li>').join('') + '</ul>' : '<p class="cd-gset-none">No sites yet.</p>') + '</div></section>' +
          '<p class="cd-gset-foot">Never: it doesn’t open the site or do anything there. Ask first: it asks before opening it, and before each step there that would change something. Hand off to me: those steps are yours. Always allow: they go ahead unless the check finds another reason to stop.</p>',
        browser: () => '<section><h3 class="cd-gset-sl">Browser</h3><div class="cd-gset-card"><div class="cd-gset-row">' + what('Where Gloopy’s browser is signed in', 'Signing out of a site removes its cookies from Gloopy’s browser and from the copy kept for it.') + '</div>' +
          (!st.signins ? '<p class="cd-gset-none">Gloopy’s sign-ins couldn’t be loaded. Close this and try again.</p>'
            : (st.signins.sites.length ? '<ul class="cd-gset-list">' + st.signins.sites.map((x) => '<li class="cd-gset-item"><span class="cd-gset-text"><b class="cd-gset-host">' + esc(x.site) + '</b><small>' + esc(GSET_SIGNED_HOW[x.how] || 'Signed in') + (x.at ? ' · ' + esc(gsetWhen(x.at)) : '') + '</small></span><span class="cd-gset-btns"><button type="button" data-gs-signout="' + esc(x.site) + '"' + busy + '>Sign out</button></span></li>').join('') + '</ul>' : '<p class="cd-gset-none">Gloopy hasn’t signed in anywhere for you yet.</p>') +
            '<form class="cd-gset-add cd-gset-siteadd" data-gs="signout-site"><input id="gsOutHost" class="cd-gset-in" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Another site, like shop.example" value="' + esc(st.outHost) + '" aria-label="Sign out of another site"><button type="submit" class="cd-gset-pill"' + busy + '>Sign out</button></form>') + '</div></section>' +
          '<section><h3 class="cd-gset-sl">Through your own computer</h3><div class="cd-gset-card">' + (DESKTOP_ROUTE
            ? '<label class="cd-gset-row">' + what('Send Gloopy’s browser’s traffic through this computer', 'Sites then see this computer’s internet connection, as when you browse yourself, which helps with a site that turns cloud computers away. It works while this app is open. This computer’s private and VPN addresses stay closed to Gloopy.') + toggle('gsRoute', st.options.route, 'Send Gloopy’s browser’s traffic through this computer') + '</label>' +
              (st.options.route ? '<p class="cd-gset-route" role="status">' + esc(gsetRouteWords(st.route)) + '</p>' : '')
            : st.options.route ? '<div class="cd-gset-row">' + what('On', 'Gloopy’s browser goes through your computer while the Go Farther app is open on it.') + '<button type="button" class="cd-gset-pill" data-gs-route-off="1"' + busy + '>Turn it off</button></div>'
            : '<div class="cd-gset-row">' + what('Send Gloopy’s browser’s traffic through your own computer', 'In the Go Farther app for Mac or Windows, you can send Gloopy’s browser’s traffic through your own computer, so sites see your own internet connection.') + '</div>') + '</div></section>',
      };
      const pageHTML = st.page === 'sites' ? '<h2 class="cd-gset-pt">Sites</h2>' + sec.sites()
        : st.page === 'vault' ? vaultHTML()
        : st.page === 'computer' ? '<h2 class="cd-gset-pt">Computer</h2>' + sec.browser()
        : '<h2 class="cd-gset-pt">Permissions</h2>' + sec.watch() + sec.perms() + sec.rules();
      box.innerHTML = '<nav class="cd-gset-nav" aria-label="Gloopy’s settings">' + GSET_PAGES.map(([k, label, icon]) => '<button type="button" class="cd-gset-navb' + (st.page === k ? ' is-on' : '') + '" data-gs-page="' + k + '"' + (st.page === k ? ' aria-current="page"' : '') + '>' + icon + '<span>' + label + '</span></button>').join('') + '</nav>' +
        '<div class="cd-gset-main"><div class="cd-gset-body">' + pageHTML + '</div>' + (st.note ? '<div class="cd-gset-note" role="status">' + esc(st.note) + '</div>' : '') + '</div>' +
        '<button type="button" class="cd-gset-x" data-gs="close" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
      const b = box.querySelector('.cd-gset-body'); if (b) b.scrollTop = top;
      for (const [k, val] of typed) { const n = box.querySelector('#' + k); if (n && val) n.value = val; }
      if (focused === 'gsVaultQ') { const q = box.querySelector('#gsVaultQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    };
    // Each change: the answer is kept, and a card it closed shows in the chat behind.
    const save = async (path, body, ok) => {
      st.busy = true; st.note = ''; paint();
      const r = await call(base + path, { method: 'POST', body: JSON.stringify(body) });
      st.busy = false;
      if (r.status !== 200 || !r.data || r.data.error) st.note = (r.data && r.data.error) || 'That could not be saved.';
      else { ok(r.data); if (r.data.closed && S.project) { reloadChat(S.project.id); st.note = 'Saved. The card that was waiting closed, since your settings changed.'; } }
      paint();
      return r.status === 200 && !(r.data && r.data.error);
    };
    box.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'gsRuleText') st.ruleText = t.value; else if (t.id === 'gsEditText') st.editText = t.value; else if (t.id === 'gsSiteHost') st.siteHost = t.value; else if (t.id === 'gsOutHost') st.outHost = t.value;
      else if (t.id === 'gsVaultSite') st.vault.site = t.value; else if (t.id === 'gsVaultUser') st.vault.user = t.value; else if (t.id === 'gsVaultNick') st.vault.nick = t.value; else if (t.id === 'gsVaultHint') st.vault.hint = t.value;
      else if (t.id === 'gsVaultQ') { st.vault.q = t.value; paint(); }
      else if (t.id === 'gsCardName') st.vault.card.name = t.value; else if (t.id === 'gsCardPostal') st.vault.card.postal = t.value; else if (t.id === 'gsCardNick') st.vault.card.nick = t.value; else if (t.id === 'gsCardHint') st.vault.card.hint = t.value;
      else if (t.id && t.id.startsWith('gsCt_')) st.vault.ct[t.id.slice(5)] = t.value;
    });
    box.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'gsEditMode') st.editMode = t.value; else if (t.id === 'gsSiteMode') st.siteMode = t.value;
      else if (t.id === 'gsMonitor') save('/options', { set: { monitor: t.checked } }, (d) => { st.options = d.options; });
      else if (t.id === 'gsRoute') routeSwitch(t.checked);
      else if (t.id === 'gsVaultFile') vaultFile(t.files && t.files[0]);
      else if (t.id === 'gsCardDefault') st.vault.card.def = t.checked; else if (t.id === 'gsCardForget') st.vault.card.forget = t.checked;
      else if (t.id === 'gsCardCam' || t.id === 'gsCardPhoto') cardScan(t.files && t.files[0]);
      else if (t.dataset.perm) save('/permissions', { set: { [t.dataset.perm]: t.value } }, (x) => { st.perms = x.permissions; });
      else if (t.dataset.site) save('/sites', { set: { host: t.dataset.site, mode: t.value } }, (d) => { st.sites = d.sites; });
    });
    box.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, what = f.dataset.gs;
      if (what === 'add-rule') { const text = st.ruleText.trim(); if (!text) { st.note = 'Write the rule first.'; return paint(); } if (await save('/rules', { add: { text, mode: st.ruleMode } }, (d) => { st.rules = d.rules; })) { st.ruleText = ''; st.ruleOpen = ''; paint(); } }
      else if (what === 'save-rule') { if (await save('/rules', { change: { id: f.dataset.id, text: st.editText, mode: st.editMode } }, (d) => { st.rules = d.rules; })) { st.edit = ''; paint(); } }
      else if (what === 'add-site') { const host = st.siteHost.trim(); if (!host) { st.note = 'Write the site’s address first.'; return paint(); } if (await save('/sites', { set: { host, mode: st.siteMode } }, (d) => { st.sites = d.sites; })) { st.siteHost = ''; st.siteOpen = false; paint(); } }
      else if (what === 'vault-save') {
        const id = f.dataset.id || '', box2 = box.querySelector('#gsVaultPass'), password = box2 ? box2.value : '';
        const site = st.vault.site.trim();
        if (!site) { st.note = 'Type the website, such as github.com.'; return paint(); }
        if (!id && !password) { st.note = 'Type the password.'; return paint(); }
        // The password leaves the box as it is sent: it is never kept in this page's state.
        if (box2) box2.value = '';
        const body = id ? { edit: { id, site, username: st.vault.user.trim(), nickname: st.vault.nick, hint: st.vault.hint, ...(password ? { password } : {}) } } : { add: { site, username: st.vault.user.trim(), password, nickname: st.vault.nick, hint: st.vault.hint } };
        if (await save('/logins', body, (d) => { if (st.signins) st.signins.saved = d.logins || st.signins.saved; })) { st.vault.open = ''; st.vault.site = st.vault.user = st.vault.nick = st.vault.hint = ''; st.note = id ? 'Saved.' : 'Saved to your Vault.'; paint(); }
      }
      else if (what === 'card-save') {
        // A CARD (2026-11-13, Grok Bot's "New item → Card"): its number, expiry and security code leave their boxes as sent.
        const id = f.dataset.id || '', val = (k) => { const n = box.querySelector('#' + k); const x = n ? n.value : ''; if (n) n.value = ''; return x; };
        const number = id ? '' : val('gsCardNumber'), expiry = val('gsCardExp'), cvc = val('gsCardCvc'), k = st.vault.card;
        if (!id && !number.trim()) { st.note = 'Type the card number.'; return paint(); }
        // (A saved card's billing postal code is never sent back to this page: one typed here replaces it, an empty box keeps it.)
        const body = id ? { edit: { id, expiry, ...(cvc ? { cvc } : {}), name: k.name, ...(k.postal.trim() ? { postal: k.postal } : {}), nickname: k.nick, hint: k.hint, default: k.def, ...(k.forget ? { forgetCode: true } : {}) } }
          : { add: { number, expiry, cvc, name: k.name, postal: k.postal, nickname: k.nick, hint: k.hint, default: k.def } };
        if (await save('/cards', body, (x) => { st.cards = x.cards || st.cards; S.cards = st.cards; })) { st.vault.open = ''; st.vault.card = { nick: '', hint: '', name: '', postal: '', def: false, forget: false }; st.note = id ? 'Saved.' : 'Card saved to your Vault.'; paint(); }
      }
      else if (what === 'contact-save') {
        const id = f.dataset.id || '', c = { ...st.vault.ct };
        const body = id ? { edit: { id, ...c } } : { add: c };
        if (await save('/contacts', body, (x) => { st.contacts = x.contacts || st.contacts; })) { st.vault.open = ''; st.vault.ct = {}; st.note = id ? 'Saved.' : 'Contact info saved to your Vault.'; paint(); }
      }
      else if (what === 'signout-site') { const site = st.outHost.trim(); if (!site) { st.note = 'Write the site’s address first.'; return paint(); } if (await signOut(site)) { st.outHost = ''; paint(); } }
    });
    box.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t || t.disabled) return;
      const d = t.dataset;
      if (d.gs === 'close') close();
      else if (d.gs === 'cancel-edit') { st.edit = ''; paint(); }
      else if (d.gsPage) {
        // Another page: open forms and menus close (a password being typed is not carried over), and it opens at its top.
        Object.assign(st, { page: d.gsPage, edit: '', note: '' }); Object.assign(st.vault, { menu: false, sure: '' }); S.gsetPage = d.gsPage;
        paint(); const b = box.querySelector('.cd-gset-body'); if (b) b.scrollTop = 0;
        const n = box.querySelector('[data-gs-page="' + d.gsPage + '"]'); if (n) n.focus();
      }
      else if (d.gsRuleNew) { Object.assign(st, { ruleOpen: d.gsRuleNew, ruleMode: d.gsRuleNew, ruleText: '', edit: '' }); paint(); const i = box.querySelector('#gsRuleText'); if (i) i.focus(); }
      else if (d.gs === 'cancel-rule') { Object.assign(st, { ruleOpen: '', ruleText: '' }); paint(); }
      else if (d.gs === 'site-new') { st.siteOpen = true; paint(); const i = box.querySelector('#gsSiteHost'); if (i) i.focus(); }
      else if (d.gs === 'cancel-site') { Object.assign(st, { siteOpen: false, siteHost: '' }); paint(); }
      else if (d.gsEdit) { const r = st.rules.find((x) => x.id === d.gsEdit); if (r) { st.edit = r.id; st.editText = r.text; st.editMode = r.mode; paint(); const i = box.querySelector('#gsEditText'); if (i) i.focus(); } }
      else if (d.gsDel) save('/rules', { remove: d.gsDel }, (x) => { st.rules = x.rules; });
      else if (d.gsUnsite) save('/sites', { remove: d.gsUnsite }, (x) => { st.sites = x.sites; });
      else if (d.gsSignout) signOut(d.gsSignout);
      else if (d.gsRouteOff) routeSwitch(false);
      else if (d.gsForget) save('/logins', { remove: d.gsForget }, () => {}).then((ok) => (ok ? signinsAgain() : null));
      else if (d.eye) { const f = box.querySelector('#' + d.eye); if (f) { const show = t.getAttribute('aria-pressed') !== 'true'; if (MASKS) f.classList.toggle('is-masked', !show); else f.type = show ? 'text' : 'password'; t.setAttribute('aria-pressed', show ? 'true' : 'false'); t.setAttribute('aria-label', show ? 'Hide what you typed' : 'Show what you typed'); f.focus(); } }
      else if (d.vault === 'menu') { st.vault.menu = !st.vault.menu; paint(); }
      else if (d.vault === 'new') { Object.assign(st.vault, { tab: 'logins', menu: false, open: 'new', site: '', user: '', nick: '', hint: '', sure: '', imp: null }); paint(); const i = box.querySelector('#gsVaultSite'); if (i) i.focus(); }
      else if (d.vault === 'import') { Object.assign(st.vault, { tab: 'logins', menu: false, open: 'import', sure: '', imp: null }); paint(); }
      else if (d.vault === 'new-card') { Object.assign(st.vault, { tab: 'cards', menu: false, open: 'new-card', sure: '', card: { nick: '', hint: '', name: '', postal: '', def: !(st.cards || []).length, forget: false } }); paint(); const i = box.querySelector('#gsCardNumber'); if (i) i.focus(); }
      else if (d.vault === 'new-contact') { Object.assign(st.vault, { tab: 'contacts', menu: false, open: 'new-contact', sure: '', ct: {} }); paint(); const i = box.querySelector('#gsCt_name'); if (i) i.focus(); }
      else if (d.vaultTab) { Object.assign(st.vault, { tab: d.vaultTab, open: '', sure: '', menu: false }); st.note = ''; paint(); }
      else if (d.cardEdit) { const c = (st.cards || []).find((x) => x.id === d.cardEdit); if (c) { Object.assign(st.vault, { menu: false, open: c.id, sure: '', card: { nick: c.nickname || '', hint: c.hint || '', name: c.name || '', postal: '', def: !!c.default, forget: false } }); paint(); } }
      else if (d.cardRemove) {
        // Asked once more first (Remove for good?): Gloopy can no longer pay with a removed card.
        if (st.vault.sure !== d.cardRemove) { st.vault.sure = d.cardRemove; return paint(); }
        save('/cards', { remove: d.cardRemove }, (x) => { st.cards = x.cards || []; S.cards = st.cards; }).then((ok) => { if (ok) { Object.assign(st.vault, { sure: '', open: st.vault.open === d.cardRemove ? '' : st.vault.open }); st.note = 'Removed.'; paint(); } });
      }
      else if (d.contactEdit) { const x = (st.contacts || []).find((y) => y.id === d.contactEdit); if (x) { const { id: _i, at: _a, ...rest } = x; Object.assign(st.vault, { menu: false, open: x.id, sure: '', ct: { ...rest } }); paint(); } }
      else if (d.contactRemove) {
        if (st.vault.sure !== d.contactRemove) { st.vault.sure = d.contactRemove; return paint(); }
        save('/contacts', { remove: d.contactRemove }, (x) => { st.contacts = x.contacts || []; }).then((ok) => { if (ok) { Object.assign(st.vault, { sure: '', open: st.vault.open === d.contactRemove ? '' : st.vault.open }); st.note = 'Removed.'; paint(); } });
      }
      else if (d.vault === 'cancel') { Object.assign(st.vault, { open: '', sure: '', imp: null }); paint(); }
      else if (d.vault === 'do-import') vaultImportNow();
      else if (d.vaultEdit) { const l = (st.signins ? st.signins.saved : []).find((x) => x.id === d.vaultEdit); if (l) { Object.assign(st.vault, { menu: false, open: l.id, site: l.site, user: l.username || '', nick: l.nickname || '', hint: l.hint || '', sure: '', imp: null }); paint(); const i = box.querySelector('#gsVaultPass'); if (i) i.focus(); } }
      else if (d.vaultRemove) {
        // Asked once more first (Remove for good?): a removed login's password is gone.
        if (st.vault.sure !== d.vaultRemove) { st.vault.sure = d.vaultRemove; return paint(); }
        save('/logins', { remove: d.vaultRemove }, (x) => { if (st.signins) st.signins.saved = x.logins || []; }).then((ok) => { if (ok) { Object.assign(st.vault, { sure: '', open: st.vault.open === d.vaultRemove ? '' : st.vault.open }); st.note = 'Removed from your Vault.'; paint(); } });
      }
    });
    // AN EXPORT CHOSEN (2026-11-12; Grok Bot's "Import from CSV…"): read here, on this device; only the logins it holds go
    // to your Vault, once you press Import.
    const vaultFile = async (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { st.note = 'That file is over 5 MB.'; return paint(); }
      let text = '';
      try { text = await file.text(); } catch { st.note = 'That file couldn’t be read.'; return paint(); }
      const r = loginsFromCsv(text, st.signins ? st.signins.saved : []);
      if (r.error) { st.note = r.error; return paint(); }
      st.vault.imp = { name: file.name, rows: r.rows }; st.note = ''; paint();
    };
    // A CARD FROM A PHOTO (2026-11-13): made smaller here, read once by Coder's Worker, and its words put in the boxes.
    const cardScan = async (file) => {
      if (!file) return;
      const pic = await shrink(file);
      if (!pic) { st.note = 'That photo couldn’t be read. Try another, or type the card.'; return paint(); }
      st.vault.scanning = true; st.busy = true; st.note = ''; paint();
      const r = await call(base + '/cards', { method: 'POST', body: JSON.stringify({ scan: { type: pic.type, data: pic.data } }) });
      st.vault.scanning = false; st.busy = false;
      const d = r.data || {};
      if (d.name) st.vault.card.name = d.name;
      paint();
      const put = (k, v) => { const n = box.querySelector('#' + k); if (n && v) n.value = v; };
      put('gsCardNumber', d.number); put('gsCardExp', d.expiry);
      st.note = r.status === 200 ? 'Filled in from the photo. Check it, type the security code, then Save card.' : d.error || 'The photo couldn’t be read.';
      const n = st.note; paint(); st.note = n;
      put('gsCardNumber', d.number); put('gsCardExp', d.expiry);
    };
    const vaultImportNow = async () => {
      const imp = st.vault.imp;
      if (!imp) return;
      const ready = imp.rows.filter((r) => r.status === 'Ready').map((r) => ({ site: r.site, username: r.username, password: r.password }));
      if (!ready.length) return;
      let got = null;
      if (await save('/logins', { import: ready }, (d) => { if (st.signins) st.signins.saved = d.logins || st.signins.saved; got = d.imported || null; })) {
        // The export's passwords leave this page's memory.
        st.vault.imp = null; st.vault.open = '';
        const n = got ? got.added : ready.length;
        st.note = 'Imported ' + n + (n === 1 ? ' login' : ' logins') + (got && got.over ? ' (' + got.over + ' didn’t fit: the Vault holds 1000)' : '') + '. Delete the exported file now: it holds your passwords unencrypted.';
        paint();
      }
    };
    // The switch: on gives the app its link's ticket; off stops the link (and every ticket given before stops working).
    const routeSwitch = async (on) => {
      if (!(await save('/route', { on }, (x) => { st.options = x.options || st.options; st.offNow = x.now; if (DESKTOP_ROUTE) { if (on && x.ticket) DESKTOP_ROUTE.start({ url: x.url, ticket: x.ticket }).catch(() => {}); else if (!on) DESKTOP_ROUTE.stop().catch(() => {}); } }))) return;
      if (on) { st.note = 'On. Gloopy’s browser goes through this computer from its next run or take-over.'; paint(); }
      else { st.note = st.offNow === false ? 'Off. Gloopy’s browser goes straight out from its next run or take-over.' : 'Off. Gloopy’s browser goes straight out now.'; paint(); }
      routeLook();
    };
    // While Settings is open, how the link is doing, every 2 seconds.
    const routeLook = async () => {
      if (!DESKTOP_ROUTE || !wrap.isConnected) return;
      try { st.route = await DESKTOP_ROUTE.status(); } catch (e) { st.route = null; }
      if (st.options.route) { const r = box.querySelector('.cd-gset-route'); if (r) r.textContent = gsetRouteWords(st.route); else paint(); }
      clearTimeout(st.routeTimer); st.routeTimer = setTimeout(routeLook, 2000);
    };
    // Signing out (it can take a moment: Gloopy's computer is woken for it): its words, and the list as it is now.
    const signinsAgain = async () => { const l = await call(base + '/signins'); if (l.status === 200 && l.data) st.signins = { sites: l.data.sites || [], saved: l.data.saved || [] }; paint(); };
    const signOut = async (site) => {
      st.busy = true; st.note = 'Signing Gloopy out of ' + site + '…'; paint();
      const r = await call(base + '/signout', { method: 'POST', body: JSON.stringify({ site }) });
      st.busy = false;
      if (r.status !== 200 || !r.data || r.data.error) { st.note = (r.data && r.data.error) || 'That could not be done.'; paint(); return false; }
      if (st.signins && Array.isArray(r.data.sites)) st.signins.sites = r.data.sites;
      if (r.data.project) S.project = r.data.project;
      st.note = r.data.said || 'Signed out.'; paint();
      return true;
    };
    paint();
    routeLook();
    const first = box.querySelector('.cd-gset-navb.is-on'); if (first) first.focus();
  }
  // How the link from this computer is doing, in words.
  function gsetRouteWords(r) {
    if (!r) return 'Starting…';
    const blocked = r.blocked ? ' ' + r.blocked + (r.blocked === 1 ? ' site was' : ' sites were') + ' blocked this session (a private or VPN address' + (r.lastBlocked ? ', like ' + r.lastBlocked : '') + ').' : '';
    if (r.connected) return 'Linked: Gloopy’s browser goes through this computer. ' + r.opened + (r.opened === 1 ? ' connection' : ' connections') + ' so far.' + blocked;
    if (!r.on) return 'Not linked yet.';
    return 'Waiting for Gloopy’s computer (it may be asleep: the link comes back when Gloopy starts work or you take over).' + blocked;
  }

  // THE DESKTOP APP'S NOTIFICATIONS (owner item 8): its window has no web push, so while the app is open (a
  // minimized window too) it watches the chats itself and shows the same notifications, with the same two
  // switches: a long job finished, a job waiting for the owner, Coder's own notify in the open chat.
  const DESKTOP_APP = /GoFartherDesktop\//.test(navigator.userAgent);
  const localNotifyOn = () => { try { return localStorage.getItem('gf_local_notify') === '1'; } catch (e) { return false; } };
  const setLocalNotify = (on) => { try { if (on) localStorage.setItem('gf_local_notify', '1'); else localStorage.removeItem('gf_local_notify'); } catch (e) {} };
  /** What changed between two looks at the chat list that is worth a notification. */
  function desktopNews(before, now, o) {
    const out = [];
    for (const c of now || []) {
      const b = (before || []).find((x) => x.id === c.id);
      if (!b || b.status !== 'running' || c.status === 'running') continue;
      if (o.openId === c.id && o.focused) continue;
      const name = c.title || c.repo;
      if (c.waiting) { if (o.actions) out.push({ id: c.id, title: 'Coder needs your answer · ' + name, body: c.waiting === 'secret' ? 'Coder needs a key to go on.' : c.waiting === 'envchange' ? 'Coder asks to change the environment.' : 'Coder asked you something.' }); }
      else if (o.decides && Number(c.ran) >= 3 * 60000) out.push({ id: c.id, title: 'Coder finished · ' + name, body: 'Open the chat to see what it did.' });
    }
    return out;
  }
  function showLocal(n) {
    try {
      const x = new Notification(n.title, { body: n.body || '', tag: n.id, icon: '/icons/icon-192.png' });
      x.onclick = () => { try { window.focus(); } catch (e) {} x.close(); if (n.id && (!S.project || S.project.id !== n.id)) openProject(n.id); };
    } catch (e) {}
  }
  function stopDesktopWatch() { if (S.deskWatch) clearInterval(S.deskWatch); S.deskWatch = 0; }
  async function startDesktopWatch() {
    stopDesktopWatch();
    if (!DESKTOP_APP || !('Notification' in window) || Notification.permission !== 'granted' || !localNotifyOn()) return;
    if (!S.pushInfo) { const r = await call('/push'); if (r.status === 200) S.pushInfo = r.data; }
    let seen = S.projects.slice();
    S.deskWatch = setInterval(async () => {
      if (!seen.some((c) => c.status === 'running')) { seen = S.projects.slice(); if (!seen.some((c) => c.status === 'running')) return; }
      const r = await call('/projects');
      if (r.status !== 200) return;
      const now = (r.data.projects || []).map(entryOf);
      const info = S.pushInfo || { decides: true, actions: true };
      for (const n of desktopNews(seen, now, { decides: info.decides !== false, actions: info.actions !== false, openId: S.project && S.project.id, focused: document.hasFocus() })) showLocal(n);
      seen = now;
    }, 30000);
  }

  // CODER'S OWN BOX WITH SEVERAL CHOICES (Rewind's three, like Claude Code's).
  function askPick(title, text, choices) {
    return new Promise((done) => {
      const wrap = document.createElement('div'); wrap.className = 'cd-sure';
      const box = document.createElement('div'); box.className = 'cd-sure-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      const h = document.createElement('div'); h.className = 'cd-sure-title'; h.textContent = title;
      const p = document.createElement('div'); p.className = 'cd-sure-text'; p.textContent = text;
      const col = document.createElement('div'); col.className = 'cd-pick-col';
      const end = (v) => { document.removeEventListener('keydown', key); wrap.remove(); done(v); };
      const key = (e) => { if (e.key === 'Escape') end(null); };
      choices.forEach(([v, label]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => end(v); col.append(b); });
      const no = document.createElement('button'); no.type = 'button'; no.className = 'cd-sure-no'; no.textContent = 'Never mind'; no.onclick = () => end(null); col.append(no);
      box.append(h, p, col); wrap.append(box); document.body.append(wrap);
      wrap.onclick = (e) => { if (e.target === wrap) end(null); };
      document.addEventListener('keydown', key); col.firstChild.focus();
    });
  }
  // REWIND (like Claude Code's /rewind, 2026-11-06): back to before one of your messages.
  async function rewind(turn) {
    if (!S.project) return;
    // LIKE CLAUDE CODE'S REWIND (its docs, read 2026-11-07; owner item 9): the code choices only when a
    // later job changed files; Summarize from here / up to here; the message back in the box after the chat goes back.
    const mark = (S.project.marks || []).find((m) => m.turn === turn);
    const said = mark && S.events[mark.ev] && S.events[mark.ev].type === 'user' ? String(S.events[mark.ev].text || '') : '';
    const changed = (S.project.commits || []).some((c) => Number(c.turn) >= turn);
    const first = !(S.project.marks || []).some((m) => m.turn < turn);
    const choices = [...(changed ? [['both', 'Restore code and chat']] : []), ['chat', changed ? 'Restore chat only' : 'Restore chat'], ...(changed ? [['code', 'Restore code only']] : []),
      ['sumfrom', 'Summarize from here'], ...(first ? [] : [['sumupto', 'Summarize up to here']])];
    const pick = await askPick('Rewind to this message?', (changed ? 'Restoring goes back to how things were before you sent it. Code changes are undone with new commits on the branch, never deleted from GitHub. ' : 'No job changed files after this message, so only the chat can go back. ') + 'Summarizing turns that part of the conversation into a summary for Coder, to free room; files stay as they are and the chat still shows everything.', choices);
    if (!pick || !S.project) return;
    let body;
    if (pick === 'sumfrom' || pick === 'sumupto') {
      const focus = await askText('Summarize ' + (pick === 'sumfrom' ? 'from here' : 'up to here'), 'Anything the summary should keep? (Optional: leave it empty for a general summary.)', 'Summarize', '', { optional: true, max: 300 });
      if (focus === null || !S.project) return;
      body = { turn, summarize: pick === 'sumfrom' ? 'from' : 'upto', focus };
    } else body = { turn, code: pick !== 'chat', chat: pick !== 'code' };
    S.error = ''; S.rewinding = true; draw();
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/rewind', { method: 'POST', body: JSON.stringify(body) });
    S.rewinding = false;
    if (r.data && r.data.project) S.project = r.data.project;
    if (r.status === 200 && r.data) {
      S.events = r.data.events || S.events; S.error = '';
      // The message comes back to the box, to send again or change (like Claude Code).
      if ((pick === 'both' || pick === 'chat' || pick === 'sumfrom') && said && !S.draft) S.draft = said;
    } else S.error = (r.data && r.data.error) || 'Could not rewind.';
    syncEntry(); draw();
  }
  // CODER'S OWN BOX WITH A TEXT FIELD (a new environment's name).
  // `o.optional`: an empty answer is an answer (""), not a Cancel; `o.max`: the longest answer.
  function askText(title, text, yes, value, o = {}) {
    return new Promise((done) => {
      const wrap = document.createElement('div'); wrap.className = 'cd-sure';
      const box = document.createElement('div'); box.className = 'cd-sure-box is-text'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      const h = document.createElement('div'); h.className = 'cd-sure-title'; h.textContent = title;
      const p = document.createElement('div'); p.className = 'cd-sure-text'; p.textContent = text;
      const inp = document.createElement('input'); inp.className = 'cd-sure-in'; inp.maxLength = o.max || 40; inp.value = value || ''; inp.setAttribute('aria-label', title);
      const row = document.createElement('div'); row.className = 'cd-sure-row';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'cd-sure-no'; no.textContent = 'Cancel';
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'cd-sure-yes'; ok.textContent = yes;
      row.append(no, ok); box.append(h, p, inp, row); wrap.append(box); document.body.append(wrap);
      const end = (v) => { wrap.remove(); done(v); };
      no.onclick = () => end(null); ok.onclick = () => end(inp.value.trim() || (o.optional ? '' : null));
      inp.onkeydown = (e) => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') end(null); };
      wrap.onclick = (e) => { if (e.target === wrap) end(null); };
      inp.focus(); inp.select();
    });
  }
  // UNDO THE LAST JOB (owner, 2026-11-05): Coder's own "are you sure?", then the server reverts it.
  // REVIEW (owner, 2026-11-05): the server writes the review request; Coder only reads and reports.

  // THE REPO'S ENVIRONMENT (owner, 2026-11-05, "14"): setup script + variables, kept on the server.
  // THE REPO'S ENVIRONMENT (owner, 2026-11-06: "make similar" to Claude Code's
  // "Edit cloud environment"): four rows, each with its own page.
  // THE CHAT'S ENVIRONMENT (owner, 2026-11-06: environments like Claude Code's):
  // its name, and the list for the picker under the box before the first message.
  async function loadEnvInfo() {
    if (GLOOPY) return; // Gloopy has no environment, branches or repositories
    if (!S.project) return;
    const id = S.project.id;
    const r = await call('/projects/' + encodeURIComponent(id) + '/env');
    if (!S.project || S.project.id !== id || r.status !== 200 || !r.data) return;
    S.envInfo = { envId: r.data.envId, name: r.data.name || 'Default', isDefault: !!r.data.isDefault, locked: !!r.data.locked, environments: r.data.environments || [] };
    draw();
  }
  // SEVERAL REPOSITORIES IN ONE CHAT (2026-11-06, like Claude Code): up to 3 more,
  // added or taken away before the first message.
  async function loadAllRepos() {
    if (GLOOPY) return;
    if (S.allRepos || !S.project || S.project.turn) return;
    const r = await call('/github/repos');
    S.allRepos = ((r.data && r.data.repos) || []).map((x) => x.repo).filter(Boolean);
    draw();
  }
  async function changeRepos(repo, add) {
    if (!S.project) return;
    const base = '/projects/' + encodeURIComponent(S.project.id) + '/repos';
    const r = add ? await call(base, { method: 'POST', body: JSON.stringify({ repo }) }) : await call(base + '?repo=' + encodeURIComponent(repo), { method: 'DELETE' });
    if (r.status === 200 && r.data && r.data.project) { S.project = r.data.project; S.error = ''; }
    else S.error = (r.data && r.data.error) || 'That repository could not be ' + (add ? 'added.' : 'taken away.');
    draw();
  }
  // THE STARTING BRANCH (like Claude Code): picked before the first message.
  async function loadBranches() {
    if (GLOOPY) return;
    if (!S.project || S.project.turn) return;
    const id = S.project.id;
    const r = await call('/projects/' + encodeURIComponent(id) + '/branches');
    if (!S.project || S.project.id !== id || r.status !== 200 || !r.data) return;
    S.branches = r.data.branches || [];
    draw();
  }
  async function pickBase(base) {
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/base', { method: 'POST', body: JSON.stringify({ base }) });
    if (r.status === 200 && r.data && r.data.project) S.project = r.data.project;
    else S.error = (r.data && r.data.error) || 'That branch could not be picked.';
    draw();
  }
  async function pickEnv(envId) {
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/environment', { method: 'POST', body: JSON.stringify({ envId }) });
    if (r.status === 200 && r.data && r.data.project) S.project = r.data.project;
    else S.error = (r.data && r.data.error) || 'That environment could not be picked.';
    await loadEnvInfo();
  }
  async function loadEnv() {
    if (!S.project) return;
    S.env = null; S.envMsg = ''; S.envPage = 'main'; S.envForm = null;
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/env');
    S.env = r.status === 200 && r.data ? r.data : { script: '', vars: [], varsText: '', secrets: [], network: { mode: 'full', hosts: [] } };
    if (S.env.envId && S.envInfo) S.envInfo = { ...S.envInfo, name: S.env.name, environments: S.env.environments || S.envInfo.environments };
    draw();
  }
  async function envPost(body, done) {
    S.envBusy = true; S.envMsg = ''; draw();
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/env', { method: 'POST', body: JSON.stringify(body) });
    S.envBusy = false;
    if (r.status === 200 && r.data) { S.env = r.data; S.envPage = done || 'main'; S.envForm = null; if (S.envInfo && r.data.name) S.envInfo = { ...S.envInfo, name: r.data.name, environments: r.data.environments || S.envInfo.environments }; }
    else S.envMsg = (r.data && r.data.error) || 'It could not be saved.';
    draw();
  }
  const NET = { none: ['None', 'Coder\'s commands can\'t reach the internet (sites with a saved secret still work).'], trusted: ['Trusted', 'The default list: package registries, GitHub and other code hosts, container registries, cloud SDKs.'], full: ['Full', 'Coder\'s commands can reach any public site.'], custom: ['Custom', 'Your own list of sites, with or without the default list.'] };
  const SECRET_TYPES = {
    bearer: ['Bearer', 'headers', [{ name: 'Authorization', prefix: 'Bearer', value: '' }]],
    key: ['API key header', 'headers', [{ name: 'X-Api-Key', prefix: '', value: '' }]],
    basic: ['Basic', 'headers', [{ name: 'Authorization', prefix: 'Basic', value: '' }]],
    body: ['Body parameter', 'body'], oauth: ['OAuth 2.0 client credentials', 'oauth'], gcp: ['Google Cloud service account', 'gcp'], aws: ['AWS SigV4', 'aws'],
  };
  const CONFIG_FIELDS = {
    body: [['param', 'Parameter name', 'api_key', ''], ['value', 'Value', '', 'password']],
    oauth: [['tokenUrl', 'Token URL', 'https://auth.example.com/oauth/token', ''], ['clientId', 'Client ID', '', ''], ['clientSecret', 'Client secret', '', 'password'], ['scope', 'Scope (optional)', '', '']],
    gcp: [['keyJson', 'Service account key (JSON)', '{ "type": "service_account", … }', 'area'], ['scope', 'Scope', 'https://www.googleapis.com/auth/cloud-platform', '']],
    aws: [['accessKeyId', 'Access key ID', 'AKIA…', ''], ['secretAccessKey', 'Secret access key', '', 'password'], ['sessionToken', 'Session token (optional)', '', 'password'], ['region', 'Region', 'us-east-1', ''], ['service', 'Service', 's3', '']],
  };
  function envHTML() {
    const page = S.envPage || 'main', e = S.env, f = S.envForm;
    const head = (title, back) => '<div class="cd-em-head">' + (back ? '<button type="button" class="cd-em-x" data-envgo="' + back + '" aria-label="Back">‹</button>' : '') + '<b>' + esc(title) + '</b><button type="button" class="cd-em-x" id="envClose" aria-label="Close">×</button></div>';
    const foot = (yes, extra) => '<div class="cd-em-foot">' + (S.envMsg ? '<span class="cd-em-err">' + esc(S.envMsg) + '</span>' : '') + (extra || '') + '<button type="button" class="cd-em-cancel" data-envgo="' + (page === 'add' ? 'secrets' : 'main') + '">Cancel</button>' + (yes ? '<button type="button" class="cd-em-yes" id="envYes"' + (S.envBusy ? ' disabled' : '') + '>' + yes + '</button>' : '') + '</div>';
    let body = '';
    if (!e) body = head('Environment') + '<p class="cd-muted">Loading…</p>';
    else if (page === 'main') {
      const n = e.network || { mode: 'trusted', hosts: [], defaults: true };
      const rows = [
        ['network', 'Network access', (NET[n.mode] || NET.trusted)[0] + (n.mode === 'custom' ? ' · ' + n.hosts.length + ' site' + (n.hosts.length === 1 ? '' : 's') + (n.defaults ? ' + default list' : '') : '')],
        ['secrets', 'Network secrets', (e.secrets || []).length ? e.secrets.length + ' secret' + (e.secrets.length > 1 ? 's' : '') : 'None'],
        ['script', 'Setup script', e.script && e.script.trim() ? e.script.trim().split('\n')[0].slice(0, 60) : 'Not set'],
        ['vars', 'Environment variables', (e.vars || []).length ? e.vars.length + ' variable' + (e.vars.length > 1 ? 's' : '') : 'None for this repo'],
      ];
      if (!e.isDefault && e.envId) rows.unshift(['name', 'Name', e.name || '']);
      body = head('Environment: ' + (e.name || 'Default')) +
        '<p class="cd-em-help cd-em-top">' + (e.isDefault ? 'The Default environment: chats in all your repos can use it. ' : 'Used by every chat that picks it. ') + (e.locked ? 'This chat picked it before its first message.' : 'This chat can still pick another one under the message box, until its first message.') + '</p>' +
        '<div class="cd-em-rows">' + rows.map((r) => '<button type="button" class="cd-em-row" data-envgo="' + r[0] + '"><span><b>' + r[1] + '</b><small>' + esc(r[2]) + '</small></span><span aria-hidden="true">›</span></button>').join('') + '</div>' +
        (!e.isDefault && e.envId ? '<button type="button" class="cd-em-archive" id="envArchive">Archive this environment</button>' : '');
    } else if (page === 'name') {
      body = head('Name', 'main') + '<input id="envNameIn" class="cd-em-in" maxlength="40" autocomplete="off" spellcheck="false" value="' + esc(f.text) + '">' +
        '<p class="cd-em-help">Every chat that uses this environment shows the new name.</p>' + foot('Save changes');
    } else if (page === 'network') {
      body = head('Network access', 'main') + '<div class="cd-em-opts">' + Object.keys(NET).map((k) => '<button type="button" class="cd-em-opt' + (f.mode === k ? ' on' : '') + '" data-netmode="' + k + '"><b>' + NET[k][0] + '</b><small>' + NET[k][1] + '</small>' + (f.mode === k ? '<span aria-hidden="true">✓</span>' : '') + '</button>').join('') + '</div>' +
        (f.mode === 'trusted' ? '<p class="cd-em-help">The default list is Claude Code\'s: npm, PyPI, RubyGems, crates.io, Go, Maven, NuGet and other registries, GitHub, GitLab and Bitbucket, Docker and other container registries, and Google Cloud, Azure and AWS.</p>' : '') +
        (f.mode === 'custom' ? '<label class="cd-envnet"><input type="checkbox" id="envDefaults"' + (f.defaults ? ' checked' : '') + '> Also include the default list of common package managers</label><label class="cd-em-l">Allowed sites</label><div class="cd-em-list">' + (f.hosts.length ? f.hosts.map((h) => '<div class="cd-em-li"><code>' + esc(h) + '</code><button type="button" data-nethostdel="' + esc(h) + '" aria-label="Remove ' + esc(h) + '">×</button></div>').join('') : '<p class="cd-muted">No sites yet. Coder asks before adding one.</p>') + '</div>' +
          '<div class="cd-em-addrow"><input id="envHostIn" placeholder="api.example.com or *.example.com" autocomplete="off" spellcheck="false"><button type="button" class="cd-em-cancel" id="envHostAdd">Add</button></div>' : '') +
        foot('Save changes');
    } else if (page === 'secrets') {
      body = head('Network secrets', 'main') + '<div class="cd-em-list">' + ((e.secrets || []).length ? e.secrets.map((x) => '<div class="cd-em-li"><span><b>' + esc(x.name || x.hosts.join(', ')) + '</b><small>' + esc(x.hosts.join(', ') + (x.paths && x.paths.length ? ' · ' + x.paths.join(', ') : '') + ' · ' + x.headers.map((h) => h.name).join(', ')) + '</small></span><button type="button" data-secid="' + esc(x.id) + '" data-secname="' + esc(x.name || x.hosts.join(', ')) + '" aria-label="Remove">×</button></div>').join('') : '<p class="cd-muted">No secrets yet.</p>') + '</div>' +
        '<button type="button" class="cd-em-cancel cd-em-plus" data-envgo="add">+ Add secret</button>' +
        '<p class="cd-em-help">Requests to the sites you add go through a proxy that adds the secret, so Coder never sees it. Coder can also ask you for one with a card in the chat.</p>' + foot('');
    } else if (page === 'add') {
      const hosts = f.hosts.split(/[\s,]+/).filter(Boolean);
      const h0 = f.headers[0] || { name: 'Authorization', prefix: 'Bearer' };
      body = head('Add secret', 'secrets') +
        '<p class="cd-em-help">Use a key with only the access Coder needs: it can be used for any request to these sites.</p>' +
        '<label class="cd-em-l" for="secName">Name (optional)</label><input id="secName" class="cd-em-in" value="' + esc(f.name) + '" placeholder="Stripe test key" autocomplete="off">' +
        '<label class="cd-em-l" for="secType">Secret type</label><select id="secType" class="cd-em-in">' + Object.keys(SECRET_TYPES).map((k) => '<option value="' + k + '"' + (f.type === k ? ' selected' : '') + '>' + SECRET_TYPES[k][0] + '</option>').join('') + '</select>' +
        '<label class="cd-em-l" for="secHosts">Allowed websites</label><input id="secHosts" class="cd-em-in" value="' + esc(f.hosts) + '" placeholder="api.example.com" autocomplete="off" spellcheck="false">' +
        '<p class="cd-em-help">Coder\'s proxy only sends this key to these sites. Use * at the start for every subdomain (*.example.com). Separate several with commas.</p>' +
        '<label class="cd-em-l" for="secPaths">Path prefixes (optional)</label><input id="secPaths" class="cd-em-in" value="' + esc(f.paths) + '" placeholder="/api/v1/" autocomplete="off" spellcheck="false">' +
        '<p class="cd-em-help">Only add the key to requests under these paths. Leave empty for the whole site.</p>' +
        (SECRET_TYPES[f.type][1] !== 'headers'
          ? CONFIG_FIELDS[SECRET_TYPES[f.type][1]].map(([k, label, ph, kind]) => '<label class="cd-em-l" for="cfg-' + k + '">' + label + '</label>' + (kind === 'area' ? '<textarea id="cfg-' + k + '" data-cfg="' + k + '" class="cd-em-in cd-em-area" spellcheck="false" placeholder="' + esc(ph) + '">' + esc(f.config[k] || '') + '</textarea>' : '<input id="cfg-' + k + '" data-cfg="' + k + '" class="cd-em-in"' + (kind === 'password' ? ' type="password" autocomplete="new-password"' : ' autocomplete="off"') + ' spellcheck="false" value="' + esc(f.config[k] || '') + '" placeholder="' + esc(ph) + '">')).join('') +
            '<p class="cd-em-help">' + ({ body: 'Added to JSON and form request bodies sent to these sites.', oauth: 'Coder\'s proxy gets a token from the token URL (and a new one when it expires) and adds it as Authorization: Bearer.', gcp: 'Coder\'s proxy signs in as this service account and adds a Google access token to requests.', aws: 'Coder\'s proxy signs each request with AWS Signature Version 4.' })[SECRET_TYPES[f.type][1]] + '</p>'
          :         '<label class="cd-em-l">Headers</label><p class="cd-em-help">Use the header name from the API\'s docs, like Authorization or X-Api-Key, and leave Prefix empty if the API takes the key alone.</p>' +
        '<div class="cd-em-hdrs"><span>Header name</span><span>Prefix</span><span>Value</span><span></span>' + f.headers.map((h, i) => '<input data-hdr="' + i + '" data-k="name" value="' + esc(h.name) + '" autocomplete="off" spellcheck="false"><select data-hdr="' + i + '" data-k="prefix">' + ['', 'Bearer', 'Token', 'Key', 'Basic'].map((x) => '<option value="' + x + '"' + (h.prefix === x ? ' selected' : '') + '>' + (x || '(none)') + '</option>').join('') + '</select><input data-hdr="' + i + '" data-k="value" type="password" value="' + esc(h.value) + '" autocomplete="new-password" spellcheck="false" placeholder="••••••••"><button type="button" data-hdrdel="' + i + '" aria-label="Remove header"' + (f.headers.length < 2 ? ' disabled' : '') + '>×</button>').join('') + '</div>' +
        '<button type="button" class="cd-em-cancel cd-em-plus" id="secHdrAdd">+ Add header</button>' +
        '<details class="cd-em-curl"><summary>See resolved curl example</summary><pre>curl https://' + esc((hosts[0] || 'api.example.com').replace(/^\*\./, 'api.')) + ((f.paths.split(/[\s,]+/).filter(Boolean)[0]) || '/') + '\n  # Coder\'s proxy adds:\n' + f.headers.map((h) => '  -H "' + esc(h.name || 'Header') + ': ' + esc(h.prefix ? h.prefix + ' ' : '') + '••••••••"').join('\n') + '</pre></details>') +
        foot('Add');
    } else if (page === 'script') {
      body = head('Setup script', 'main') + '<div class="cd-em-code"><div class="cd-em-codebar"><span class="cd-em-tag">Bash</span><label class="cd-em-file">⬆ Choose file<input type="file" id="envFile" hidden></label><button type="button" id="envCopy" aria-label="Copy">⧉</button></div>' +
        '<textarea id="envScriptIn" spellcheck="false" placeholder="#!/bin/bash&#10;npm install">' + esc(f.text) + '</textarea><div class="cd-em-codefoot">Files up to 64 KB</div></div>' +
        '<p class="cd-em-help">Runs on Coder\'s machine before Coder starts, once per machine and again when you change it. It can\'t read your variables or secrets.</p>' +
        '<p class="cd-em-help">System packages: put each install on its own line, like <code>apt-get install -y jq</code>. Coder installs those as admin; every other line runs as Coder\'s own user, so other sudo commands don\'t work. Git, build tools, Python, Node, curl and jq are already there.</p>' + foot('Save changes');
    } else if (page === 'vars') {
      body = head('Environment variables', 'main') + '<textarea id="envVarsIn" class="cd-em-vars" spellcheck="false" placeholder="NODE_ENV=production&#10;GIT_AUTHOR_NAME=Your Name&#10;&#10;# Multiline values - wrap in quotes&#10;CONFIG=&quot;key1=val1&#10;key2=val2&quot;">' + esc(f.text) + '</textarea>' +
        '<p class="cd-em-help">One KEY=value per line, in .env format. Coder and its commands can see these values, so don\'t add secrets here: use Network secrets.</p>' + foot('Save changes');
    }
    return '<div class="cd-em" id="envWrap"><div class="cd-em-box" role="dialog" aria-modal="true" aria-label="Environment">' + body + '</div></div>';
  }
  function envGo(page) {
    const e = S.env || {}; S.envMsg = ''; S.envPage = page;
    S.envForm = page === 'network' ? { mode: (e.network && e.network.mode) || 'trusted', hosts: [...((e.network && e.network.hosts) || [])], defaults: !e.network || e.network.defaults !== false }
      : page === 'add' ? { name: '', type: 'bearer', hosts: '', paths: '', headers: SECRET_TYPES.bearer[2].map((h) => ({ ...h })), config: {} }
      : page === 'script' ? { text: e.script || '' } : page === 'vars' ? { text: e.varsText || '' } : page === 'name' ? { text: e.name || '' } : null;
    draw();
  }
  async function envYes() {
    const page = S.envPage, f = S.envForm;
    if (page === 'network') return envPost({ network: { mode: f.mode, hosts: f.hosts, defaults: f.defaults } });
    if (page === 'script') return envPost({ script: f.text });
    if (page === 'vars') return envPost({ varsText: f.text });
    if (page === 'name') return envPost({ name: f.text });
    if (page === 'add') {
      S.envBusy = true; S.envMsg = ''; draw();
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/secret', { method: 'POST', body: JSON.stringify({ name: f.name, kind: SECRET_TYPES[f.type][1], hosts: f.hosts.split(/[\s,]+/).filter(Boolean), paths: f.paths.split(/[\s,]+/).filter(Boolean), headers: SECRET_TYPES[f.type][1] === 'headers' ? f.headers : [], config: f.config }) });
      S.envBusy = false;
      if (r.status === 200) { S.env.secrets = r.data.secrets; S.envPage = 'secrets'; S.envForm = null; } else S.envMsg = (r.data && r.data.error) || 'It could not be saved.';
      draw();
    }
  }

  async function removeChat(id) {
    const x = S.projects.find((p) => p.id === id);
    if (!x || !(await askSure('Remove “' + (x.title || 'New chat') + '”?', 'Its branch and pull request stay on GitHub.', 'Remove'))) return;
    const r = await call('/projects/' + encodeURIComponent(id), { method: 'DELETE' });
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'The chat could not be removed.'; return draw(); }
    S.projects = S.projects.filter((p) => p.id !== id);
    if (S.project && S.project.id === id) { stopPoll(); S.project = null; S.draft = ''; S.pics = []; S.comments = []; return S.projects.length ? openProject(S.projects[0].id) : showPicker('new'); }
    delete S.drafts[id];
    draw();
  }

  // EACH CHAT ITS OWN MESSAGE BOX (live test, 2026-11-08: a message that failed to send in one chat was still
  // in the box in the next one, with its pictures and line comments, and went there). What was typed,
  // attached or commented stays with its chat; a new chat starts empty. The landing page's ask goes to the first.
  function keepDraft(st, was, id) {
    if (was === id) return;
    if (was) st.drafts[was] = { draft: st.draft, pics: st.pics, comments: st.comments };
    const kept = st.drafts[id]; delete st.drafts[id];
    if (was || kept) { st.draft = kept ? kept.draft : ''; st.pics = kept ? kept.pics : []; st.comments = kept ? kept.comments : []; st.mention = null; }
  }

  async function openProject(id) {
    stopPoll();
    keepDraft(S, S.project && S.project.id, id);
    S.phase = 'chat'; S.project = null; S.events = []; S.next = 0; S.error = ''; S.showChanges = false; S.changes = null; S.compareAgainst = ''; S.compareBranches = null; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); draw();
    const r = await call('/projects/' + encodeURIComponent(id));
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'The project could not be opened.'; return draw(); }
    S.project = r.data.project; S.events = r.data.events || [];
    S.running = S.project.status === 'running';
    S.envInfo = null; loadEnvInfo();
    S.branches = null; loadBranches();
    loadAllRepos();
    draw(true);
    // A turn still running: its own steps come from the machine, after the saved ones.
    if (S.running) { S.next = 0; startPoll(); }
  }

  // ── A MESSAGE, THEN FOLLOWING THE WORK ────────────────────────────────────
  const PR_ASK = 'Create a pull request for this branch. Write its title and description from the changes.';
  const PR_ASK_DRAFT = 'Create a draft pull request for this branch. Write its title and description from the changes.';
  // `opts.card`: the message only answers one of Gloopy's cards (a step the owner said no to stays refused until their own next message).
  async function send(text, opts) {
    text = String(text || '').trim();
    // COMMENTS ON THE CHANGES go with the message; the server writes them in.
    const comments = S.comments.map((c) => ({ file: c.file, line: c.line, quote: c.quote, text: c.text }));
    const pics = (S.pics || []).slice();
    const att = (S.attach || []).filter((f) => f.id);
    if ((S.attach || []).some((f) => f.up)) return note('Wait for the file to finish attaching.');
    if ((!text && !comments.length && !pics.length && !att.length) || !S.project || S.running || S.sending) return;
    if (GLOOPY) desktopRouteKick();
    S.comments = []; S.pics = []; S.attach = []; S.mention = null;
    // Your message hands Gloopy's browser back to it (its machine does so as the turn starts).
    if (S.web && S.web.control) S.web.control = false;
    // ITS OWN ID (live test, 2026-11-12): a browser sends a message again when its connection drops; Coder's Worker then
    // knows the second copy for the same message, and never starts it twice.
    const mid = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    S.sending = true; S.error = ''; S.draft = ''; S.unsent = text;
    const base = S.events.length;
    S.events.push({ type: 'user', text: text || (att.length ? '(see the attached file' + (att.length > 1 ? 's' : '') + ')' : pics.length ? '(see the picture)' : '(comments on the changes)'), at: Date.now(), local: true, ...(pics.length ? { images: pics.length, thumbs: pics.map((x) => x.url) } : {}), ...(att.length ? { files: att.map((f) => ({ id: f.id, name: f.name, size: f.size })) } : {}) });
    draw(true);
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/message', { method: 'POST', body: JSON.stringify({ mid, text, comments, images: pics.map((x) => ({ type: x.type, data: x.data })), ...(att.length ? { files: att.map((f) => f.id) } : {}), model: S.pick.model, effort: S.pick.effort, ...(opts && opts.card ? { card: true } : {}), ...(opts && opts.marked ? { marked: opts.marked } : {}), ...(opts && opts.taught ? { taught: opts.taught } : {}), ...(GLOOPY ? { tz: deviceZone() } : {}) }) });
    S.sending = false; S.unsent = '';
    if (r.status !== 200) {
      S.events = S.events.slice(0, base);
      S.draft = text; S.pics = pics; S.attach = att;
      S.error = (r.data && r.data.error) || 'The message was not sent.';
      if (r.data && r.data.connect) S.phase = 'connect';
      return draw();
    }
    // /compact (like Claude Code's): the summary is made; no job runs.
    // /pause, /resume and /schedules in Gloopy's chat (the audit, 2026-11-10): done by the Worker; no job runs either.
    if (r.data.compacted || r.data.handled) { S.project = r.data.project; S.events = S.events.slice(0, base).concat(r.data.events || []); if (r.data.handled) { S.sched = null; S.schedMsg = ''; S.signins = null; S.signinsMsg = ''; } syncEntry(); return draw(true); }
    S.project = r.data.project; S.running = true; syncEntry();
    S.next = 0;
    startPoll(); draw(true);
  }

  function startPoll() { stopPoll(); S.poll = setTimeout(tick, 300); webWake(); }
  // A TURN THAT STARTS WAKES A PAUSED LIVE VIEW (live test, 2026-11-10: opened more than 2 minutes before the message, it
  // said "Gloopy is using it" over an old picture, without Gloopy's steps, until Refresh).
  function webWake() { const w = S.web; if (w && w.paused) { w.paused = false; w.touched = Date.now(); webTick(); } }
  function stopPoll() { if (S.poll) clearTimeout(S.poll); S.poll = 0; }
  async function tick() {
    S.poll = 0;
    if (!S.project || !S.running) return;
    const id = S.project.id;
    // Looking at this chat (visible and focused): no notification about it (owner item 8, like Claude Code).
    const seen = document.visibilityState === 'visible' && document.hasFocus() ? '&seen=1' : '';
    const r = await call('/projects/' + encodeURIComponent(id) + '/state?since=' + S.next + seen);
    if (!S.project || S.project.id !== id) return;
    // AFTER ERRORS THE PAGE ASKS LESS OFTEN (the audit), and says so after a few.
    if (r.status !== 200) {
      S.fails = (S.fails || 0) + 1;
      if (S.fails === 5) { S.events = S.events.concat([{ at: Date.now(), type: 'error', text: GLOOPY ? "Gloopy's computer is not answering. Still trying…" : "Coder's machine is not answering. Still trying…" }]); draw(true); }
      if (S.running) S.poll = setTimeout(tick, Math.min(POLL_MS * Math.pow(2, S.fails), 30000));
      return;
    }
    S.fails = 0;
    if (r.status === 200 && r.data) {
      if (r.data.reload) { if (r.data.project) S.project = r.data.project; S.running = false; syncEntry(); draw(); return reloadChat(id); }
      // The message shown when it was sent is not drawn twice.
      const fresh = (r.data.events || []).filter((e) => {
        if (e.type !== 'user') return true;
        const mine = S.events.find((x) => x.local && x.text === e.text);
        if (mine) { mine.local = false; return false; }
        return true;
      });
      if (fresh.length) S.events = S.events.concat(fresh);
      // THE DESKTOP APP, its window not in front: Coder's own notify, or a question, in this chat (owner item 8).
      if (DESKTOP_APP && localNotifyOn() && !document.hasFocus() && 'Notification' in window && Notification.permission === 'granted') {
        const info = S.pushInfo || { decides: true, actions: true };
        const name = S.project.title || S.project.repo;
        for (const e of fresh) {
          if (e.type === 'notify' && info.decides !== false) showLocal({ id, title: GLOOPY ? 'Gloopy' : 'Coder · ' + name, body: e.text });
          else if (['question', 'secret', 'envchange'].includes(e.type) && info.actions !== false) showLocal({ id, title: GLOOPY ? 'Gloopy needs your answer' : 'Coder needs your answer · ' + name, body: (e.text ? e.text + (Array.isArray(e.questions) && e.questions.length > 1 ? ' (and ' + (e.questions.length - 1) + ' more)' : '') : '') || e.reason || '' });
        }
      }
      S.next = r.data.next || S.next;
      if (r.data.project) S.project = r.data.project;
      // A JOB THAT JUST ENDED (live test, 2026-11-10): the schedules card asks again, so a run that was Running says how
      // it went (Succeeded, Failed, Waiting for you) without typing /schedules.
      if (GLOOPY && S.running && !r.data.running) S.sched = null;
      S.running = !!r.data.running;
      syncEntry();
      draw(fresh.length > 0);
    }
    if (S.running) S.poll = setTimeout(tick, POLL_MS);
  }

  // SAVED ELSEWHERE (another tab, or Coder's every-minute run while no tab was
  // open): the saved chat is loaded, with the save's own lines.
  async function reloadChat(id) {
    const r = await call('/projects/' + encodeURIComponent(id));
    if (r.status !== 200 || !r.data || !r.data.project || !S.project || S.project.id !== id) return;
    S.project = r.data.project; S.events = r.data.events || [];
    if (GLOOPY) S.sched = null;
    S.running = S.project.status === 'running';
    syncEntry(); draw(true);
    if (S.running) { S.next = 0; startPoll(); }
  }

  async function loadChanges() {
    if (!S.project) return;
    const id = S.project.id;
    S.changes = null;
    // COMPARE AGAINST (like Claude Code's diff view, owner item 4): the base branch unless another is picked.
    if (!S.compareBranches) loadCompareBranches();
    const r = await call('/projects/' + encodeURIComponent(id) + '/changes' + (S.compareAgainst ? '?against=' + encodeURIComponent(S.compareAgainst) : ''));
    if (!S.project || S.project.id !== id) return;
    S.changes = r.status === 200 && r.data && Array.isArray(r.data.files) ? r.data : { files: [], add: 0, del: 0, error: (r.data && r.data.error) || '' };
    draw();
  }
  async function loadCompareBranches() {
    if (!S.project) return;
    const id = S.project.id;
    S.compareBranches = [];
    const r = await call('/projects/' + encodeURIComponent(id) + '/branches?all=1');
    if (!S.project || S.project.id !== id || r.status !== 200 || !r.data) return;
    S.compareBranches = r.data.branches || [];
    draw();
  }
  async function stop() {
    if (!S.project) return;
    const id = S.project.id;
    const r = await call('/projects/' + encodeURIComponent(id) + '/stop', { method: 'POST' });
    // The machine was gone: the chat was freed, with what the job saved as it went.
    if (r.status === 200 && r.data && r.data.reload && S.project && S.project.id === id) { stopPoll(); S.running = false; return reloadChat(id); }
  }

  // ── DRAWING ───────────────────────────────────────────────────────────────
  const ICON = {
    eye: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    key: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M14 9l2 2"/></svg>',
    page: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    web: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M7 6h.01M10 6h.01"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    hook: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L4 14h8l-1 8 9-12h-8l1-8z"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/></svg>',
    clip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
    gh: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    term: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l6-5-6-5M12 19h8"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    // The Vault's cards and contact info, and a filled form (2026-11-13).
    check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    cardsm: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/></svg>',
    person: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.6 4.4-5.5 8-5.5s6.5 1.9 8 5.5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    branch: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/></svg>',
  };

  // Light formatting for what the AI writes: `code`, ``` blocks, links.
  // CODER'S ANSWERS, lightly formatted (owner, 2026-11-06: "nicer answer
  // rendering"): code blocks, bullet and numbered lists, small headings, bold,
  // `code`, [text](https://…) links and [[1]](https://…) source marks.
  function inline(s) {
    const links = [];
    const keep = (html) => '\u0000' + (links.push(html) - 1) + '\u0000';
    let h = esc(s)
      .replace(/\[\[(\d{1,2})\]\]\((https:\/\/[^\s)]+)\)/g, (_, n, u) => keep('<a class="cd-cite" href="' + u + '" target="_blank" rel="noopener">' + n + '</a>'))
      .replace(/\[([^\]\n]{1,200})\]\((https:\/\/[^\s)]+)\)/g, (_, txt, u) => keep('<a href="' + u + '" target="_blank" rel="noopener">' + txt + '</a>'))
      .replace(/`([^`\n]+)`/g, (_, c) => keep('<code>' + c + '</code>'))
      .replace(/(https:\/\/[^\s<*]+[^\s<.,;:!?)*])/g, (u) => keep('<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'))
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    return h.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
  }
  // A TABLE (the audit, 2026-11-10: answers showed "| Hotel | Price |" lines as they were): a header row, a line of dashes
  // (":---:" for centred, "---:" for right), then rows; the cells formatted as the rest of the answer is.
  const SEP_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  const cellsOf = (l) => { const t = l.trim().replace(/^\|/, '').replace(/\|$/, ''); return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')); };
  function tableHTML(lines) {
    const head = cellsOf(lines[0]), align = cellsOf(lines[1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
    const cell = (tag, c, k) => '<' + tag + (align[k] ? ' style="text-align:' + align[k] + '"' : '') + '>' + inline(c) + '</' + tag + '>';
    return '<div class="cd-table"><table><thead><tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr></thead><tbody>' +
      lines.slice(2).map((l) => { const cs = cellsOf(l); return '<tr>' + head.map((_, k) => cell('td', cs[k] || '', k)).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function blocks(text) {
    const out = [];
    for (const block of String(text).trim().split(/\n{2,}/)) {
      const lines = block.split('\n');
      const bullet = (l) => /^\s*[-*•]\s+/.test(l), num = (l) => /^\s*\d{1,3}[.)]\s+/.test(l);
      // A table, with or without a line of words before it and after it in the same block.
      const at = lines.findIndex((l, k) => l.includes('|') && k + 1 < lines.length && SEP_ROW.test(lines[k + 1]) && cellsOf(l).length > 1);
      if (at >= 0) {
        let to = at + 2;
        while (to < lines.length && lines[to].includes('|')) to++;
        if (at > 0) out.push(blocks(lines.slice(0, at).join('\n')));
        out.push(tableHTML(lines.slice(at, to)));
        if (to < lines.length) out.push(blocks(lines.slice(to).join('\n')));
        continue;
      }
      if (lines.every(bullet)) out.push('<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>');
      else if (lines.every(num)) out.push('<ol>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*\d{1,3}[.)]\s+/, '')) + '</li>').join('') + '</ol>');
      else if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) out.push('<h4>' + inline(lines[0].replace(/^#{1,4}\s+/, '')) + '</h4>');
      else {
        // A paragraph followed by its own list (no blank line between them).
        const first = lines.findIndex((l) => bullet(l) || num(l));
        if (first > 0 && lines.slice(first).every(bullet)) { out.push('<p>' + lines.slice(0, first).map(inline).join('<br>') + '</p>'); out.push('<ul>' + lines.slice(first).map((l) => '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>'); }
        else if (first > 0 && lines.slice(first).every(num)) { out.push('<p>' + lines.slice(0, first).map(inline).join('<br>') + '</p>'); out.push('<ol>' + lines.slice(first).map((l) => '<li>' + inline(l.replace(/^\s*\d{1,3}[.)]\s+/, '')) + '</li>').join('') + '</ol>'); }
        else out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
      }
    }
    return out.join('');
  }
  function prose(t) {
    const parts = String(t || '').split(/```[a-zA-Z0-9_-]*\n?/);
    return parts.map((p, i) => i % 2 ? '<pre class="cd-pre">' + esc(p.replace(/\n$/, '')) + '</pre>' : (p.trim() ? blocks(p) : '')).join('');
  }

  // ONE COMMAND as a quiet line, "Ran <command> ▸", like the Claude app
  // (owner, 2026-11-05: "look at the frontend of this"). Tap it for the output.
  // OWNER, 2026-11-05 ("option a without the colors"): every step has its own
  // grey icon, a dark verb, the target in code type, and ✓ / ✕ error / running on the right.
  const STEP_ICON = {
    bash: 'M4 17l6-6-6-6M12 19h8', monitor_job: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', stop_job: 'M6 6h12v12H6z',
    read: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    write: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 18v-6M9 15h6', grep: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    glob: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', lsp: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    web_fetch: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20', browser: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M7 6h.01M10 6h.01', sign_in: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', vault: 'M7.5 20a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.7 12.3L21 2M16 7l3 3M14 9l2 2', pay: 'M2.5 7.5a2.5 2.5 0 0 1 2.5-2.5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5zM2.5 10h19M6.5 15h4', webhook: 'M13 2L4 14h8l-1 8 9-12h-8l1-8z', files: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3', handoff: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M9 14l2 2 4-4', schedule: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', helpers: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.7', page: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', web_search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    setup: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  };
  function stepIcon(e) {
    const k = e.tool === 'monitor' ? 'monitor_job' : e.tool && STEP_ICON[e.tool] ? e.tool : 'bash';
    return '<span class="cd-sic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + STEP_ICON[k] + '"/></svg></span>';
  }
  function cmdHTML(e, r, state, key) {
    const open = !!S.open[key];
    // File and web tools say what they did: Read, Edited, Wrote, Searched… (2026-11-05).
    const verb = e.verb ? (state === 'run' ? e.verb.replace(/^Read$/, 'Reading').replace(/^Wrote$/, 'Writing').replace(/^Edited$/, 'Editing').replace(/^Searched/, 'Searching').replace(/^Found$/, 'Finding').replace(/^Fetched$/, 'Fetching').replace(/^Opened$/, 'Opening').replace(/^Looked at$/, 'Looking at').replace(/^Clicked$/, 'Clicking').replace(/^Hovered$/, 'Hovering').replace(/^Typed into$/, 'Typing into').replace(/^Typed$/, 'Typing').replace(/^Pressed$/, 'Pressing').replace(/^Chose in$/, 'Choosing in').replace(/^Chose$/, 'Choosing').replace(/^Scrolled$/, 'Scrolling').replace(/^Went back$/, 'Going back') : e.verb) : state === 'run' ? 'Running' : 'Ran';
    // WHAT A BROWSER STEP DID, said in words once it is done ("Clicked “Go”"), in place of its verb and the element's number.
    const said = r && typeof r.label === 'string' && r.label ? r.label : '';
    // A HELPER'S STEP: its name first, then what it does (live test, 2026-11-10: "Searched the web for “Rome population” ·
    // …" read as if its name was what it searched for).
    const who = !said && /^h\d+-/.test(String(e.id || '')) && typeof e.command === 'string' ? /^“[^”\n]{1,100}” · /.exec(e.command) : null;
    const what = who ? e.command.slice(who[0].length) : e.command;
    const tail = state === 'run' ? '<span class="cd-st"><span class="cd-spin" aria-label="working"></span></span>'
      : state === 'bad' ? '<span class="cd-st cd-st-bad">✕ ' + (r.timedOut ? 'timed out' : e.tool ? 'error' : 'exit ' + esc(r.code)) + '</span>'
      : state === 'bg' ? '<span class="cd-st cd-st-bg"><i></i>running</span>'
      : state === 'ok' ? '<span class="cd-st cd-st-ok" aria-label="done">✓</span>' : '';
    return '<div class="cd-cmd is-' + state + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="cd-cmd-row" data-step="' + esc(key) + '"' + (r ? '' : ' disabled') + '>' +
        stepIcon(e) + '<span class="cd-cmd-verb">' + (said ? '<span class="cd-cmd-said" title="' + esc(said) + '">' + esc(said) + '</span>' : (who ? esc(who[0]) : '') + verb) + '</span>' + (said || !what ? '' : ' <code class="cd-cmd-text">' + esc(what.split('\n')[0]) + '</code>') +
        tail +
      '</button>' +
      // THE PICTURE A READ OPENED, small, under its step (the owner, 2026-11-08: "Fix those 3"; like Claude Code's).
      stepPics(r) +
      (open && r ? '<pre class="cd-out">' + esc(r.output || '(no output)') + '</pre>' : '') +
    '</div>';
  }
  // THE LIVE SCREEN IN A HAND-OFF CARD (2026-11-12): the live view's picture, from the same stream; asleep, paused, or
  // still coming are said in its place.
  // A FIELD YOUR OWN BROWSER LEAVES ALONE (owner, 2026-11-12: "do all 5"; found live on 11-11: Chrome on the test
  // computer said a password typed on the sign-in card "was found in a data breach", treating the card as a site's own
  // sign-in, and could offer to save it): a plain text box drawn masked where browsers can (-webkit-text-security), so
  // their password managers don't offer to save, fill or check it, with password managers' own "leave this alone"
  // marks; a password box only where a browser can't mask text. The eye shows what you typed (Grok Bot's Secure Form).
  const MASKS = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-text-security', 'disc');
  const PM_OFF = ' autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" data-form-type="other"';
  function secretField(id, label) {
    return '<span class="cd-secret-pw"><input id="' + id + '" class="cd-secret-in' + (MASKS ? ' is-masked' : '') + '" type="' + (MASKS ? 'text' : 'password') + '" name="gf-private-' + id + '"' + PM_OFF + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' +
      '<button type="button" class="cd-secret-eye" data-eye="' + id + '" aria-label="Show what you typed" aria-pressed="false" title="Show what you typed">' + ICON.eye + '</button></span>';
  }
  // A PASSWORD MANAGER'S EXPORT (owner, 2026-11-12: "do all 5"; Grok Bot's "Import from CSV…": 1Password, Chrome or
  // Edge, Safari or Apple Passwords, Firefox, Bitwarden, LastPass), read on this device: each row's website, username and
  // password, by its column's name in any of those apps' files, with why one can't come in (no website, not a secure
  // https one, no password) or is skipped (already in your Vault, or twice in the file).
  function csvRows(text) {
    const rows = [], t = String(text || '').replace(/^\uFEFF/, '');
    let row = [], f = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ''));
  }
  function loginsFromCsv(text, saved) {
    const rows = csvRows(text);
    const head = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const col = (...names) => { for (const n of names) { const k = head.indexOf(n); if (k >= 0) return k; } return -1; };
    const cu = col('url', 'login_uri', 'website', 'web site', 'login url', 'address'), cp = col('password', 'login_password');
    const cn = col('username', 'login_username', 'user name', 'login', 'email', 'email address', 'login name'), ct = col('type');
    if (cu < 0 || cp < 0) return { error: 'That doesn’t look like a passwords export: it needs a website (url) column and a password column.' };
    if (rows.length < 2) return { error: 'That file has no logins in it.' };
    const key = (site, user) => String(site || '').toLowerCase().replace(/^www\./, '') + '\n' + String(user || '');
    const have = new Set((saved || []).map((l) => key(l.site, l.username))), seen = new Set();
    const out = [];
    for (const r of rows.slice(1)) {
      // Bitwarden's notes, cards and identities aren't logins.
      if (ct >= 0 && String(r[ct] || '').trim() && String(r[ct]).trim().toLowerCase() !== 'login') continue;
      const url = String(r[cu] || '').trim(), username = cn >= 0 ? String(r[cn] || '').trim().slice(0, 500) : '', password = String(r[cp] || '');
      let site = '', why = '', u = null;
      if (!url) why = 'No website';
      else {
        try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : 'https://' + url); } catch { u = null; }
        if (!u || !/^https?:$/.test(u.protocol) || !/^[a-z0-9.-]+$/i.test(u.hostname) || !u.hostname.includes('.')) why = 'Not a website';
        else if (u.protocol !== 'https:') why = 'Not a secure (https) website';
        else site = u.host.toLowerCase().replace(/^www\./, '');
      }
      if (!why && !password) why = 'No password';
      if (!why && password.length > 1000) why = 'Password too long';
      const k = key(site, username);
      const status = why || (have.has(k) ? 'Already in your Vault' : seen.has(k) ? 'Twice in the file' : 'Ready');
      if (status === 'Ready') seen.add(k);
      out.push({ site: site || url.slice(0, 80) || '(no website)', username, password: status === 'Ready' ? password : '', status });
    }
    return out.length ? { rows: out } : { error: 'That file has no logins in it.' };
  }
  function hoScreen() {
    const w = S.web;
    if (!S.webOK) return '';
    if (w && w.shot && !w.paused) return '<div class="cd-ho-screen"><img id="cdHoImg" src="' + w.shot + '" alt="Gloopy’s browser, live"></div>';
    const why = !w ? 'Connecting…' : w.paused ? '' : w.asleep ? 'Gloopy’s computer is asleep: take over to wake it.' : w.off ? 'Gloopy’s browser isn’t open.' : w.error ? String(w.error) : 'Connecting…';
    return '<div class="cd-ho-screen is-empty">' + (w && w.paused ? '<button type="button" class="cd-card-no" data-ho-resume="1">Show the screen</button>' : '<span>' + esc(why) + '</span>') + '</div>';
  }
  // THE RESULT, SHOWN (owner, 2026-11-12: "yes build all four"; Grok Bot attaches screenshots of the result to its
  // answer): the pictures of the pages Gloopy's browser ended on, under its answer, as large as the chat allows.
  function resultPics(e) {
    const list = e && Array.isArray(e.shots) ? e.shots.filter((u) => typeof u === 'string' && u.length <= 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(u)).slice(0, 2) : [];
    return list.length ? '<div class="cd-result-pics">' + list.map((u) => '<img src="' + u + '" alt="The page Gloopy’s browser ended on" loading="lazy">').join('') + '</div>' : '';
  }
  /** The small copies of the pictures a step opened: only JPEG data URLs, as Coder's machine makes them. */
  function stepPics(r) {
    const list = r && Array.isArray(r.thumbs) ? r.thumbs.filter((u) => typeof u === 'string' && u.length <= 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(u)).slice(0, 4) : [];
    return list.length ? '<div class="cd-cmd-pics">' + list.map((u) => '<img src="' + u + '" alt="The picture Coder opened" loading="lazy">').join('') + '</div>' : '';
  }

  /**
   * THE LINE OVER A GROUP OF STEPS, AS CLAUDE CODE WRITES IT (the owner, 2026-11-08: "do it like this … 'Ran 1 command,
   * read 4 files'"; Claude Code names each kind in a collapsed group, in its docs and changelog: "Ran 3 shell commands",
   * "Read N files", "Searched for", "Listed N directories"): each kind with how many, in the order they first came, and
   * what failed by its kind ("a read failed": the line said "a command failed" for a failed read). `steps`: [{ tool,
   * failed }], a step with no tool being a command.
   */
  function groupWords(steps) {
    const W = { bash: ['ran', 'command', 'commands', 'command'], read: ['read', 'file', 'files', 'read'], write: ['wrote', 'file', 'files', 'write'], edit: ['edited', 'file', 'files', 'edit'], grep: ['searched for', 'pattern', 'patterns', 'search'], glob: ['searched for', 'pattern', 'patterns', 'search'], lsp: ['made', 'code lookup', 'code lookups', 'lookup'], web_fetch: ['fetched', 'page', 'pages', 'fetch'], browser: ['took', 'browser step', 'browser steps', 'browser step'], sign_in: ['asked you to sign in', '', '', 'sign-in'], sign_in_saved: ['signed in with a saved login', '', '', 'sign-in'], pay: ['asked you for a card', '', '', 'card request'], webhook: ['worked with', 'webhook', 'webhooks', 'webhook step'], files: ['worked with', 'file', 'files', 'file step'], handoff: ['asked you to take over', '', '', 'handoff'], schedule: ['worked with', 'schedule', 'schedules', 'schedule step'], helpers: ['started', 'helper team', 'helper teams', 'helper team'], page: ['published', 'page', 'pages', 'page'], web_search: ['searched the web', '', '', 'web search'], monitor: ['checked', 'background job', 'background jobs', 'check'], stop_job: ['stopped', 'background job', 'background jobs', 'stop'], review: ['reviewed the changes', '', '', 'review'], undo: ['undid the last job', '', '', 'undo'], setup: ['ran the setup script', '', '', 'setup'] };
    const said = new Map(), bad = new Map();
    for (const s of steps) {
      const w = Object.prototype.hasOwnProperty.call(W, s.tool || 'bash') ? W[s.tool || 'bash'] : ['did', 'step', 'steps', 'step'];
      const key = w[0] + '|' + w[1];
      said.set(key, { w, n: (said.has(key) ? said.get(key).n : 0) + 1 });
      if (s.failed) bad.set(w[3], (bad.get(w[3]) || 0) + 1);
    }
    const line = [...said.values()].map(({ w, n }) => (w[1] ? w[0] + ' ' + n + ' ' + (n === 1 ? w[1] : w[2]) : w[0] + (n === 1 ? '' : ' ' + n + ' times'))).join(', ');
    const nBad = [...bad.values()].reduce((a, b) => a + b, 0), kind = [...bad.keys()][0];
    const failed = !nBad ? '' : bad.size > 1 ? nBad + ' steps failed' : nBad === 1 ? (/^[aeiou]/.test(kind) ? 'an ' : 'a ') + kind + ' failed' : nBad + ' ' + (/(ch|sh|s|x)$/.test(kind) ? kind + 'es' : kind + 's') + ' failed';
    return { line: line.charAt(0).toUpperCase() + line.slice(1), failed };
  }

  // WHAT GLOOPY IS DOING NOW, under the chat while it works (owner, 2026-11-12: "yes build all four"; Grok Bot's status
  // line, "Running dynamic loading test"): its latest line to the owner this turn, else the step running now, else
  // "Thinking". Seen even when its steps are folded away.
  function statusLine(turn, results) {
    const run = turn.filter((e) => e.type === 'bash' && !results[e.id]).pop();
    const said = turn.filter((e) => e.type === 'text' && typeof e.text === 'string' && e.text.trim()).pop();
    const first = (t) => { const one = String(t).replace(/\s+/g, ' ').trim(); const m = /^(.{8,140}?[.!?…])(\s|$)/.exec(one); return m ? m[1] : one.slice(0, 140); };
    const step = run ? String(run.verb || 'Working') + (run.command ? ' ' + String(run.command).split('\n')[0].slice(0, 100) : '') : '';
    const text = said ? first(said.text) : step || 'Thinking';
    return '<div class="cd-status" role="status"><span class="cd-spin" aria-hidden="true"></span><span class="cd-status-t">' + esc(text) + '</span></div>';
  }
  function stepsHTML() {
    const out = [];
    const results = {};
    for (const e of S.events) if (e.type === 'result' && e.id) results[e.id] = e;
    let lastUser = -1;
    S.events.forEach((e, i) => { if (e.type === 'user') lastUser = i; });
    // A CARD STILL OPEN (Gloopy's): no message of the owner's after it, not marked expired, and its time not up (a card
    // from a run the owner did not start waits 30 minutes for them; the audit, 2026-11-10). A card that expired says so.
    const expiredOf = (i, e) => S.events.slice(i + 1).find((x) => x.type === 'expired' && x.id === e.id) || (Number(e.expires) > 0 && Date.now() > Number(e.expires) ? { text: 'Expired: not answered within 30 minutes. Nothing was done.' } : null);
    // A CARD YOU ANSWERED IS CLOSED (live test, 2026-11-12: its answer was taken, the message after it failed, and the card
    // looked open again): in Gloopy's chat, only the one Gloopy is waiting on is open.
    const waitedOn = (e) => !GLOOPY || !e.id || !S.project || (S.project.pending && S.project.pending.id === e.id);
    const cardOpen = (i, e) => !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user') && !expiredOf(i, e) && waitedOn(e);
    // WHAT BECAME OF A SECURE FORM (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's "A filled form says
    // Filled into the page. Secret values were never shown to your Bot", or "Could not fill into the page"): on the card.
    // AN ORDER'S ITEMS AND WHERE IT SHIPS (Grok Bot's order card), as Gloopy read them off the page.
    const orderBits = (e) => {
      const items = Array.isArray(e.items) ? e.items.filter((x) => x && x.name).slice(0, 20) : [];
      return (items.length ? '<ul class="cd-order-items">' + items.map((x) => '<li><span>' + (Number(x.quantity) > 1 ? esc(String(x.quantity)) + ' × ' : '') + esc(x.name) + '</span>' + (x.price ? '<b>' + esc(x.price) + '</b>' : '') + '</li>').join('') + '</ul>' : '') + (e.shipTo ? '<p class="cd-order-row"><span>Ship to</span><b>' + esc(e.shipTo) + '</b></p>' : '');
    };
    const filledLine = (i, e) => {
      const f = e.filled === true ? { ok: true } : S.events.slice(i + 1).find((x) => x.type === 'filled' && x.id === e.id);
      return !f ? '' : f.ok ? '<p class="cd-filled is-ok">' + ICON.check + 'Filled into the page. Secret values were never shown to Gloopy.</p>'
        : '<p class="cd-filled is-no">Could not fill into the page' + (f.why ? ': ' + esc(f.why) : '') + '. Nothing you typed was shown to Gloopy.</p>';
    };
    const until = (i, e) => (cardOpen(i, e) && Number(e.expires) > 0 ? '<p class="cd-card-until">Waits for you until ' + esc(new Date(Number(e.expires)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) + '</p>' : '');
    const gone = (i, e) => { const x = !S.events.slice(i + 1).some((y) => y.type === 'user') && expiredOf(i, e); return x ? '<p class="cd-card-expired">' + esc(x.text || 'Expired.') + '</p>' : ''; };
    // Redrawn when the soonest open card's time is up.
    const soon = S.events.map((e, i) => (['approval', 'signin', 'pay', 'handoff', 'key'].includes(e.type) && cardOpen(i, e) && Number(e.expires) > 0 ? Number(e.expires) : 0)).filter(Boolean).sort((a, b) => a - b)[0];
    clearTimeout(S.expiryTimer); if (soon) S.expiryTimer = setTimeout(draw, Math.max(1000, soon - Date.now() + 500));
    const stateOf = (e, i) => { const r = results[e.id]; return !r ? (S.running && i > lastUser ? 'run' : 'gone') : r.background ? 'bg' : r.code === 0 ? 'ok' : 'bad'; };
    // Commands in a row (with nothing said between them) are one group.
    let group = [];
    const flush = () => {
      if (!group.length) return;
      if (group.length === 1) { const [e, i] = group[0]; out.push(cmdHTML(e, results[e.id], stateOf(e, i), String(e.id || i))); }
      else {
        const gk = 'g' + String(group[0][0].id || group[0][1]);
        const shut = !!S.open[gk];
        // The line names each kind of step and what failed, as Claude Code's does (groupWords).
        // A sign-in Gloopy did with a saved login, with no card (2026-11-09), is said so, not "asked you to sign in".
        const words = groupWords(group.map(([e, i]) => ({ tool: e.tool === 'sign_in' && results[e.id] && results[e.id].saved === true ? 'sign_in_saved' : e.tool || '', failed: stateOf(e, i) === 'bad' })));
        out.push('<div class="cd-group' + (shut ? ' is-shut' : '') + '">' +
          '<button type="button" class="cd-group-head" data-group="' + esc(gk) + '">' + esc(words.line) + ' <span class="cd-caret">' + (shut ? '▸' : '▾') + '</span>' + (words.failed ? '<span class="cd-bad">' + esc(words.failed) + '</span>' : '') + '</button>' +
          (shut ? '' : '<div class="cd-group-box">' + group.map(([e, i]) => cmdHTML(e, results[e.id], stateOf(e, i), String(e.id || i))).join('') + '</div>') +
        '</div>');
      }
      group = [];
    };
    S.events.forEach((e, i) => {
      if (e.type === 'bash') { group.push([e, i]); return; }
      if (e.type === 'result') return;
      // A line of Gloopy's said soon after another: the status line only (SAY_EVERY_MS), not the chat.
      if (e.type === 'text' && e.quiet === true) return;
      flush();
      const mark = e.type === 'user' && !S.running && S.project && Array.isArray(S.project.marks) ? S.project.marks.find((m) => m.ev === i) : null;
      if (e.type === 'user') out.push('<div class="cd-user">' + (mark && !GLOOPY ? '<button type="button" class="cd-rewind" data-rewind="' + Number(mark.turn) + '" title="Rewind to before this message">Rewind</button>' : '') + (e.thumbs && e.thumbs.length ? '<div class="cd-thumbs">' + e.thumbs.map((u) => '<img src="' + esc(u) + '" alt="">').join('') + '</div>' : e.images ? '<div class="cd-imgnote">' + esc(e.images) + ' picture' + (e.images > 1 ? 's' : '') + '</div>' : '') + (Array.isArray(e.files) && e.files.length ? '<div class="cd-user-files">' + e.files.map((f) => '<button type="button" class="cd-file-chip" data-file-get="' + esc(f.id) + '" data-file-name="' + esc(f.name) + '" title="Download">' + ICON.doc + '<span class="cd-file-n">' + esc(f.name) + '</span><small>' + esc(sizeWords(Number(f.size) || 0)) + '</small></button>').join('') + '</div>' : '') + '<div class="cd-bubble">' + esc(e.text) + '</div></div>');
      else if (e.type === 'text' || e.type === 'done') out.push('<div class="cd-ai">' + prose(e.text) + '</div>' + (e.type === 'done' ? resultPics(e) : ''));
      else if (e.type === 'github') out.push('<div class="cd-gh">' + ICON.gh + '<span>' + prose(e.text).replace(/^<p>|<\/p>$/g, '') + '</span></div>');
      else if (e.type === 'error') out.push('<div class="cd-err">' + esc(e.text) + '</div>');
      else if (e.type === 'question') {
        // CODER'S QUESTIONS, LIKE CLAUDE CODE'S (owner, 2026-11-06, "2"; up to 4 in one card, owner pick 4,
        // 2026-11-08): each with its header chip and its choices with their explanations, the recommended
        // one first and already chosen, Other to type your own answer; one Skip and one Submit. Live only
        // on the last card.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const qs = askQuestions(e);
        // The choices are kept here, not in the page, so a redraw never loses them.
        const chatId = S.project ? S.project.id : '';
        if (live && (!S.ask || S.ask.at !== i || S.ask.chat !== chatId)) S.ask = { chat: chatId, at: i, qs, answers: qs.map((q) => ({ picked: q.multi || !q.options.length ? [] : [q.options[0].label], other: '' })) };
        const many = qs.length > 1;
        out.push('<div class="cd-ask' + (live ? ' is-live' : '') + (many ? ' is-many' : '') + '" data-ask="' + i + '">' + qs.map((q, k) => {
          const a = live ? S.ask.answers[k] : { picked: [], other: '' };
          const kind = q.multi ? 'checkbox' : 'radio', name = 'cdq' + i + '-' + k;
          return '<div class="cd-ask-one" data-q="' + k + '"><div class="cd-ask-q">' + (q.header ? '<span class="cd-ask-h">' + esc(q.header) + '</span>' : '') + '<span class="cd-ask-qt">' + esc(q.text) + '</span>' + (q.multi ? '<span class="cd-ask-multi">Choose any</span>' : '') + '</div><div class="cd-ask-list" role="' + (q.multi ? 'group' : 'radiogroup') + '">' +
            q.options.map((o) => '<label class="cd-ask-row"><input type="' + kind + '" name="' + name + '" value="' + esc(o.label) + '"' + (a.picked.includes(o.label) ? ' checked' : '') + (live ? '' : ' disabled') + '><span class="cd-ask-t"><b>' + esc(o.label) + '</b>' + (o.description ? '<small>' + esc(o.description) + '</small>' : '') + '</span></label>').join('') +
            '<label class="cd-ask-row cd-ask-other"><input type="' + kind + '" name="' + name + '" value="__other"' + (a.picked.includes('__other') ? ' checked' : '') + (live ? '' : ' disabled') + '><span class="cd-ask-t"><b>Other</b>' + (live ? '<input type="text" class="cd-ask-in" placeholder="Type your own answer" value="' + esc(a.other) + '" maxlength="500" autocomplete="off">' : '') + '</span></label>' +
            '</div></div>';
        }).join('') + (live ? '<div class="cd-ask-btns"><button type="button" class="cd-ask-skip" data-ask-skip="' + i + '">Skip</button><button type="button" class="cd-ask-go" data-ask-go="' + i + '">Submit' + (many ? ' answers' : '') + ' <kbd>Ctrl ↵</kbd></button></div>' : '') + '</div>' +
          (live ? '<div class="cd-ask-wait">Needs your input</div>' : ''));
      }
      else if (e.type === 'envchange') {
        // AN ENVIRONMENT CHANGE CODER PROPOSES (owner, 2026-11-06, like Claude Code): shown exactly, approved here.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const host = e.kind === 'allow_host', made = e.kind === 'new_environment';
        const envName = S.envInfo ? S.envInfo.name : 'this chat\'s environment';
        if (made) {
          // A NEW ENVIRONMENT, LIKE CLAUDE CODE'S "Create new environment?" (owner, 2026-11-06).
          out.push('<div class="cd-secret cd-envchange cd-newenv"><div class="cd-secret-icon">' + ICON.cloud.replace('width="15" height="15"', 'width="26" height="26"') + '</div><b class="cd-secret-t">Create new environment?</b>' +
            (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
            '<div class="cd-ne"><div class="cd-ne-head"><b>' + esc(e.name) + '</b><span>Personal</span></div>' +
              '<div class="cd-ne-sec"><small>Network access</small><div><span class="cd-ne-plus">+</span>' + esc((NET[e.network] || NET.trusted)[0]) + '</div></div>' +
              '<div class="cd-ne-sec"><small>Repositories</small><div><span class="cd-ne-plus">+</span>For <code>' + esc(S.project ? S.project.repo : '') + '</code></div></div>' +
              '<div class="cd-ne-sec"><small>Setup script</small><pre class="cd-envchange-pre">' + String(e.script || '').split('\n').map((l, k) => '<span class="cd-ne-n">' + (k + 1) + '</span>' + esc(l)).join('\n') + '</pre></div></div>' +
            '<p class="cd-secret-p">This chat keeps its environment (picked before its first message). New chats of this repo start with the new one.</p>' +
            (live ? (S.envChangeMsg ? '<p class="cd-secret-err">' + esc(S.envChangeMsg) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-envchange-no="' + i + '">Deny</button><button type="button" class="cd-secret-save" data-envchange-ok="' + i + '">Create environment</button></div>' : '') + '</div>');
        } else
        out.push('<div class="cd-secret cd-envchange"><div class="cd-secret-icon">' + (host ? ICON.globe : ICON.term) + '</div><b class="cd-secret-t">' + (host ? 'Allow Coder to reach ' + esc(e.host) + '?' : 'Update the setup script of ' + esc(envName) + '?') + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          (host ? '<p class="cd-secret-p">Adds ' + esc(e.host) + ' to the sites Coder may reach in the environment ' + esc(envName) + ', for every chat that uses it. You can remove it in Environment.</p>'
            : '<p class="cd-secret-p">The whole new script, run on Coder\'s machine before it starts, in every chat that uses ' + esc(envName) + ' (it cannot read your variables or keys):</p><pre class="cd-envchange-pre">' + esc(e.script) + '</pre>') +
          (live ? (S.envChangeMsg ? '<p class="cd-secret-err">' + esc(S.envChangeMsg) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-envchange-no="' + i + '">Decline</button><button type="button" class="cd-secret-save" data-envchange-ok="' + i + '">Approve</button></div>' : '') + '</div>');
      }
      else if (e.type === 'approval' && e.order && typeof e.order === 'object') {
        // THE ORDER CARD (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's "an order card with the store,
        // the items, Ship to, Pay with, and the Total ... choose the pay button, which shows the total, or choose Cancel. If
        // you cancel, nothing is charged. Once the order is placed, the card shows what you Paid with"): placing the order
        // waits for you here (Buy or pay on Ask). Pay is Allow once; Cancel is Deny.
        const live = cardOpen(i, e), o = e.order;
        const after = S.events.slice(i + 1), done = after.find((x) => x.type === 'paid');
        const said = after.find((x) => x.type === 'user');
        out.push('<div class="cd-secret cd-order"><div class="cd-secret-icon">' + ICON.card + '</div><b class="cd-secret-t">' + esc(e.site || 'Your order') + '</b>' +
          (o.reason ? '<p class="cd-secret-why">' + esc(o.reason) + '</p>' : '') + orderBits(o) +
          '<p class="cd-order-row"><span>Pay with</span><b>' + esc(o.payWith || 'The card in the payment form') + '</b></p>' +
          '<p class="cd-order-row is-total"><span>Total</span><b>' + esc(o.total || '') + '</b></p>' +
          (e.bySite ? '<p class="cd-card-rule">Your setting for ' + esc(e.bySite) + ' says to ask first.</p>' : e.byRule ? '<p class="cd-card-rule">One of your rules says to ask first.</p>' : '') +
          until(i, e) + gone(i, e) +
          (done ? '<p class="cd-filled ' + (done.ok ? 'is-ok">' + ICON.check + 'Paid with ' + esc(done.payWith || o.payWith || 'your card') : 'is-no">Not paid' + (done.note ? ': ' + esc(done.note) : '')) + '</p>'
            : !live && said && /^(Denied: |Cancelled the order)/.test(String(said.text || '')) ? '<p class="cd-filled is-no">Cancelled. Nothing was charged.</p>' : '') +
          (live ? (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-approve="deny" data-card="' + esc(e.id) + '">Cancel</button><button type="button" class="cd-card-yes" data-approve="once" data-card="' + esc(e.id) + '">Pay ' + esc(o.total || '') + '</button></div>' : '') + '</div>');
      }
      else if (e.type === 'approval') {
        // A BROWSER STEP WAITING FOR YOUR OK (Gloopy, 2026-11-09; like Grok Bot's approval cards and dots' Auto-review):
        // the step, the site and why it asks; Allow once, Always allow (a rule for steps like it) or Deny. Live on the last card.
        // A request one of Gloopy's commands sent with a saved key (`request`, the audit, 2026-11-10) shows what it sends.
        const live = cardOpen(i, e);
        const step = String(e.step || '');
        // A card a rule of the owner's asked for (Grok Bot's: "Allow" and "Not now"); one that offers no rule (a schedule, a
        // webhook, a change to one): "Allow" only. A warning by what the step does (the docs, 2026-11-10).
        const ruleOffered = !(e.kind === 'schedule' || e.kind === 'webhook');
        const yes = e.byRule || !ruleOffered ? 'Allow' : 'Allow once', nay = e.byRule ? 'Not now' : 'Deny';
        out.push('<div class="cd-secret cd-approve"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Gloopy wants to ' + esc(step.charAt(0).toLowerCase() + step.slice(1)) + '</b>' +
          (e.site ? '<p class="cd-secret-how">On <code>' + esc(e.site) + '</code></p>' : '') +
          (e.warn ? '<p class="cd-card-warn">' + esc(e.warn) + '</p>' : '') +
          (e.why ? '<p class="cd-secret-why">' + esc(e.why) + '</p>' : '') +
          (e.bySite ? '<p class="cd-card-rule">Your setting for ' + esc(e.bySite) + ' says to ask first.</p>' : e.byRule ? '<p class="cd-card-rule">One of your rules says to ask first.</p>' : '') +
          // A NEW SCHEDULE (2026-11-09): its task, and no "Always allow" (each schedule is its own OK).
          // What a request sends, or what the form holds (the second docs check, 2026-11-10: Grok Bot's card shows the inputs).
          ((e.request || e.form) && e.detail ? '<span class="cd-secret-l">What it sends</span><pre class="cd-envchange-pre cd-approve-body">' + esc(e.detail) + '</pre>' : e.detail ? '<p class="cd-secret-p">' + esc(e.detail) + '</p>' : '') +
          until(i, e) + gone(i, e) +
          // EXPIRED, IT CAN STILL BECOME A RULE (Grok Bot's "Always allow next time").
          (!live && ruleOffered && !e.byRule && expiredOf(i, e) && !S.events.slice(i + 1).some((x) => x.type === 'user') ? (S.ruleSaved === e.id ? '<p class="cd-card-until">Saved: next time Gloopy goes ahead.</p>' : '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-allow-next="' + esc(e.id) + '" data-step="' + esc(step + (e.site ? ' on ' + e.site : '')) + '">Always allow next time</button></div>') : '') +
          (live ? (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-approve="deny" data-card="' + esc(e.id) + '">' + nay + '</button>' + (!ruleOffered || e.byRule ? '' : '<button type="button" class="cd-card-no" data-approve="always" data-card="' + esc(e.id) + '" title="Allow steps like this from now on (a rule Gloopy’s checks follow)">Always allow</button>') + '<button type="button" class="cd-card-yes" data-approve="once" data-card="' + esc(e.id) + '">' + yes + '</button></div>' : '') + '</div>');
      }
      else if (e.type === 'key') {
        // YOUR SECURITY KEY FOR GLOOPY'S BROWSER (2026-11-11; Grok Bot's "Use hardware security keys"): a page there asks to
        // sign in with a security key; in the Go Farther app on your Mac or Windows computer, your own key (plugged in) signs
        // that page's request, for that site only. Asked each time; elsewhere, the card says where your key works.
        const live = cardOpen(i, e);
        const site = esc(e.site || 'the site');
        const msg = S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '';
        out.push('<div class="cd-secret cd-signin cd-keycard"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Use your security key for ' + site + '</b>' +
          '<p class="cd-secret-p">' + site + ' asks Gloopy’s browser to sign in with a security key. ' + (DESKTOP_KEY ? 'With your key plugged into this computer, choose “Use my security key”, then touch it. It signs in for Gloopy on ' + site + ' only.' : 'Your key works from the Go Farther app on your Mac or Windows computer, plugged into it: open this chat there.') + '</p>' + until(i, e) + gone(i, e) +
          (live ? msg + '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-key-skip="' + esc(e.id) + '">Not now</button>' + (DESKTOP_KEY ? '<button type="button" class="cd-card-yes" data-key-use="' + esc(e.id) + '">Use my security key</button>' : '') + '</div>' : '') + '</div>');
      }
      else if (e.type === 'signin') {
        // THE PRIVATE SIGN-IN FORM (Gloopy, 2026-11-09; like Grok Bot's Secure Form and dots' private sign-in): what you type
        // goes straight into Gloopy's browser on that site. Never kept in this page's state; the box is emptied once sent.
        // The audit (2026-11-10), as dots' card: a code the site sent you (`code`), the login you saved for the site
        // (`saved`: when your setting for saved logins is Ask), Take over (do it yourself in Gloopy's browser), and a
        // warning when the page may not be the real one (`warn`).
        const live = cardOpen(i, e);
        const site = esc(e.site || 'the site');
        const warn = e.warn && e.warn.text ? '<p class="cd-sign-warn ' + (e.warn.level === 'danger' ? 'is-danger' : 'is-caution') + '">' + esc(e.warn.text) + '</p>' : '';
        // THE OWNER'S SAVED LOGINS FOR THIS SITE (2026-11-12, the Vault): one button each, its hint under it (an older
        // card's `saved: true` is the site's newest).
        const choices = Array.isArray(e.saved) ? e.saved.filter((l) => l && typeof l === 'object').slice(0, 10)
          : e.saved ? (S.logins || []).filter((l) => l.site === e.site).slice(-1) : [];
        const msg = S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '';
        const take = '<button type="button" class="cd-card-no" data-signin-take="' + esc(e.id) + '"' + (S.webOK ? '' : ' disabled') + ' title="Open Gloopy’s browser and do it yourself there">Take over</button>';
        if (e.code) out.push('<div class="cd-secret cd-signin"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Enter the code for ' + site + '</b>' + warn +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-p">Type the code ' + site + ' sent you (by text message, email or an app). It goes straight into Gloopy’s browser; Gloopy never sees it.</p>' + until(i, e) + gone(i, e) + filledLine(i, e) +
          (live ? '<label class="cd-secret-l" for="cdSignCode">Code</label><input id="cdSignCode" class="cd-secret-in cd-sign-code" type="text" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" maxlength="16">' + msg +
            '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-signin-skip="' + esc(e.id) + '">Not now</button>' + take + '<button type="button" class="cd-card-yes" data-signin-code="' + esc(e.id) + '" disabled>Enter code</button></div>' : '') + '</div>');
        else out.push('<div class="cd-secret cd-signin"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Sign in to ' + site + '</b>' + warn +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-p">What you type goes straight into Gloopy’s browser on ' + esc(e.site || 'the site') + '. Gloopy never sees it, and it’s saved to your Vault unless you untick the box below.</p>' + until(i, e) + gone(i, e) + filledLine(i, e) +
          (live ? (choices.length ? choices.map((l) => '<button type="button" class="cd-card-yes cd-sign-saved" data-signin-saved="' + esc(e.id) + '" data-login="' + esc(l.id || '') + '">Use your saved login' + (l.nickname ? ' · ' + esc(l.nickname) + (l.username ? ' (' + esc(l.username) + ')' : '') : l.username ? ' · ' + esc(l.username) : '') + (l.hint ? '<small>' + esc(l.hint) + '</small>' : '') + '</button>').join('') + '<p class="cd-sign-or">or type it</p>' : '') +
            (e.user ? '<label class="cd-secret-l" for="cdSignUser">' + esc(e.user) + '</label><input id="cdSignUser" class="cd-secret-in" type="text" name="gf-private-user"' + PM_OFF + '>' : '') +
            '<label class="cd-secret-l" for="cdSignPass">Password</label>' + secretField('cdSignPass') +
            // SAVE FOR NEXT TIME (2026-11-09; Grok Bot's Vault, dots' "Save to Passwords"): kept sealed only if signing in works.
            '<label class="cd-sign-save"><input type="checkbox" id="cdSignSave" checked> Save to your Vault, so Gloopy can sign in to ' + esc(e.site || 'the site') + ' for you next time</label>' +
            msg +
            '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-signin-skip="' + esc(e.id) + '">Not now</button>' + take + '<button type="button" class="cd-card-yes" data-signin="' + esc(e.id) + '" disabled>Sign in</button></div>' : '') + '</div>');
      }
      else if (e.type === 'pay' && e.filled) {
        // A SAVED CARD FILLED IN FROM THE VAULT (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's "A card
        // saved in Vault fills in at checkout without asking you each time"): no form; the card says which, and that it went in.
        out.push('<div class="cd-secret cd-pay is-filled"><div class="cd-secret-icon">' + ICON.card + '</div><b class="cd-secret-t">Pay ' + esc(e.total || '') + ' on ' + esc(e.site || 'the site') + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') + orderBits(e) +
          '<p class="cd-secret-p">Gloopy filled your saved <b>' + esc(e.label || 'card') + '</b> into the payment form on ' + esc(e.site || 'the site') + (e.via ? ' (its card fields are from ' + esc(e.via) + ')' : '') + ', from your Vault. Nothing is paid until the order is placed.</p>' + filledLine(i, e) + '</div>');
      }
      else if (e.type === 'pay') {
        // PAYING AT A CHECKOUT (Gloopy, 2026-11-09: "can we try both"; Grok Bot's card form and Vault, dots' asking before a
        // payment): the card goes straight into the payment form in Gloopy's browser. Nothing typed here is kept in this
        // page's state. AS GROK BOT'S (owner, 2026-11-13): a saved card keeps its security code, so the form asks for it only
        // when it isn't kept, and a card saved here fills in without this form next time.
        const has = (f) => Array.isArray(e.fields) && e.fields.includes(f);
        const live = cardOpen(i, e);
        const now = new Date(), thisMonth = now.getFullYear() * 12 + now.getMonth();
        const saved = (S.cards || []).filter((c) => Number(c.year) * 12 + Number(c.month) - 1 >= thisMonth);
        const first = saved.find((c) => c.id === e.use) || saved.find((c) => c.default) || saved[0];
        const use = S.payUse && S.payUse.id === e.id ? S.payUse.use : (first ? first.id : '');
        const usedCard = saved.find((c) => c.id === use);
        const box = (id, label, attrs) => '<label class="cd-secret-l" for="' + id + '">' + label + '</label><input id="' + id + '" class="cd-secret-in" ' + attrs + ' spellcheck="false">';
        const two = (a, b) => '<div class="cd-pay-two"><div>' + a + '</div><div>' + b + '</div></div>';
        const cvcBox = has('cvc') ? box('cdPayCvc', 'Security code', 'type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="CVC"') : '';
        out.push('<div class="cd-secret cd-pay"><div class="cd-secret-icon">' + ICON.card + '</div><b class="cd-secret-t">Pay ' + esc(e.total || '') + ' on ' + esc(e.site || 'the site') + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') + orderBits(e) +
          '<p class="cd-secret-p">Your card goes straight into the payment form in Gloopy’s browser on ' + esc(e.site || 'the site') + (e.via ? ' (its card fields are from ' + esc(e.via) + ')' : '') + '. Gloopy never sees it. Nothing is paid until Gloopy places the order.</p>' + until(i, e) + gone(i, e) + filledLine(i, e) +
          (live ? (saved.length ? '<div class="cd-pay-pick">' + saved.map((c) => '<label class="cd-pay-opt"><input type="radio" name="cdPayUse" value="' + esc(c.id) + '" data-pay-for="' + esc(e.id) + '"' + (use === c.id ? ' checked' : '') + '> ' + (c.nickname ? esc(c.nickname) + ' · ' : '') + esc(c.brand) + ' ending ' + esc(c.last4) + (c.default ? ' <em>Default</em>' : '') + ' <small>' + esc(String(c.month).padStart(2, '0') + '/' + String(c.year).slice(-2)) + '</small></label>').join('') + '<label class="cd-pay-opt"><input type="radio" name="cdPayUse" value="" data-pay-for="' + esc(e.id) + '"' + (use ? '' : ' checked') + '> Another card</label></div>' : '') +
            (use ? (usedCard && usedCard.code ? '<p class="cd-secret-p">Its security code is in your Vault.</p>' : cvcBox)
              : box('cdPayNumber', 'Card number', 'type="text" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234"') +
                two(box('cdPayExp', 'Expiry date', 'type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY"'), cvcBox) +
                (has('name') ? box('cdPayName', 'Name on card', 'type="text" autocomplete="cc-name"') : '') +
                (has('postal') ? box('cdPayPostal', 'Billing postal code', 'type="text" autocomplete="postal-code"') : '') +
                // SAVE TO THE VAULT (Grok Bot's "Securely save to Bot's vault"): kept sealed once it went in, with its
                // security code; next time it fills in without this form. Untick it to give the card this once.
                '<label class="cd-sign-save"><input type="checkbox" id="cdPaySave" checked> Save to your Vault, so next time Gloopy fills it in without asking you</label>') +
            (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') +
            '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-pay-skip="' + esc(e.id) + '">Not now</button><button type="button" class="cd-card-yes" data-pay="' + esc(e.id) + '">Fill in card</button></div>' : '') + '</div>');
      }
      else if (e.type === 'paid') {
        // HOW THE ORDER WENT (owner, 2026-11-13; Grok Bot's "Once the order is placed, the card shows what you Paid with").
        out.push('<div class="cd-receipt ' + (e.ok ? 'is-ok' : 'is-no') + '">' + (e.ok ? ICON.check : ICON.card) + '<span>' + (e.ok ? 'Paid ' + esc(e.total || '') + ' on ' + esc(e.site || 'the site') + (e.payWith ? ' with ' + esc(e.payWith) : '') : 'Not paid on ' + esc(e.site || 'the site')) + (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '</span></div>');
      }
      else if (e.type === 'file') {
        // A FILE GLOOPY MADE (2026-11-09: "4"; Grok Bot's file cards): its name, size and Download (always saved, never opened here).
        const ext = (/\.([A-Za-z0-9]{1,6})$/.exec(String(e.name || '')) || [])[1] || '';
        // A PDF or a picture can be looked at here first (the audit, 2026-11-10).
        const viewable = /^(pdf|png|jpe?g|gif|webp)$/i.test(ext);
        out.push('<div class="cd-filecard"><span class="cd-filecard-icon">' + ICON.doc + (ext ? '<b>' + esc(ext.toUpperCase()) + '</b>' : '') + '</span><span class="cd-filecard-t"><b>' + esc(e.name || 'File') + '</b><small>' + esc(sizeWords(Number(e.size) || 0)) + '</small></span>' + (viewable ? '<button type="button" class="cd-card-no cd-filecard-view" data-file-view="' + esc(e.id) + '" data-file-name="' + esc(e.name || 'file') + '">Preview</button>' : '') + '<button type="button" class="cd-card-yes cd-filecard-get" data-file-get="' + esc(e.id) + '" data-file-name="' + esc(e.name || 'file') + '">Download</button></div>');
      }
      else if (e.type === 'hook') {
        // A WEBHOOK GLOOPY SET UP (2026-11-09: "2"; Grok Bot's routine webhook fields): its address, and its key when the
        // owner asks for it, to paste into the service that should call it.
        const key = S.hookKey && S.hookKey.id === e.id ? S.hookKey.key : '';
        out.push('<div class="cd-secret cd-hook"><div class="cd-secret-icon">' + ICON.hook + '</div><b class="cd-secret-t">Webhook: ' + esc(e.name || '') + '</b>' +
          (e.task ? '<p class="cd-secret-why">' + esc(e.task) + '</p>' : '') +
          '<p class="cd-secret-p">Gloopy does this task whenever a service calls this address with its key. Paste both into that service.</p>' +
          '<span class="cd-secret-l">Address</span><code class="cd-hook-v">' + esc(e.url || '') + '</code>' +
          '<span class="cd-secret-l">Key</span>' + (key ? '<code class="cd-hook-v">' + esc(key) + '</code>' : '<button type="button" class="cd-card-no cd-hook-show" data-hook-key="' + esc(e.id) + '">Show key</button>') +
          '<p class="cd-hook-how">Send the key as the header <code>Authorization: Bearer &lt;key&gt;</code>. For a GitHub webhook: the address as the Payload URL, content type application/json, and the key as the Secret.</p>' +
          (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') + '</div>');
      }
      else if (e.type === 'signins') {
        // WHERE GLOOPY'S BROWSER IS SIGNED IN (the audit, 2026-11-10), as /signins showed it: Sign out for each site (its
        // cookies go, from the browser and from the copy Coder keeps), Forget for each saved login.
        const newest = !S.events.slice(i + 1).some((x) => x.type === 'signins');
        const d = newest && S.signins ? S.signins : { sites: e.sites || [], saved: e.saved || [] };
        const HOW = { form: 'You signed in on the card', saved: 'With your saved login', code: 'With a code', 'took over': 'You signed in yourself' };
        const when = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        out.push('<div class="cd-sched cd-signins"><div class="cd-sched-head"><b>Where Gloopy is signed in</b></div>' +
          (d.sites.length ? d.sites.map((x) => '<div class="cd-sched-row"><div class="cd-sched-t"><b>' + esc(x.site) + '</b><small>' + esc(HOW[x.how] || 'Signed in') + (x.at ? ' · ' + esc(when(x.at)) : '') + '</small></div>' + (newest ? '<div class="cd-sched-btns"><button type="button" class="cd-card-no cd-sched-btn" data-signout="' + esc(x.site) + '">Sign out</button></div>' : '') + '</div>').join('')
            : '<p class="cd-sched-none">Gloopy hasn’t signed in anywhere for you yet.</p>') +
          '<p class="cd-sched-none">For any other site: type /signout and the site, like /signout shop.example.</p>' +
          (d.saved.length ? '<div class="cd-sched-log"><small>Saved logins</small>' + d.saved.map((l) => '<div class="cd-signins-saved"><span>' + esc(l.site) + (l.username ? ' · ' + esc(l.username) : '') + '</span>' + (newest ? '<button type="button" class="cd-card-no cd-sched-btn" data-login-forget="' + esc(l.id) + '">Forget</button>' : '') + '</div>').join('') + '</div>' : '') +
          (newest && S.signinsMsg ? '<p class="cd-secret-err">' + esc(S.signinsMsg) + '</p>' : '') + '</div>');
      }
      else if (e.type === 'schedules') {
        const runWords = (l, log) => {
          if (l.result === 'skipped') return esc('Skipped' + (l.why ? ': ' + l.why : ''));
          const how = l.result === 'test' ? 'Test run · ' : l.kind === 'event' ? 'Called · ' : '';
          const going = !l.outcome && S.running && S.project && S.project.run && S.project.run.id === l.id && log.filter((x) => x.id === l.id).at(-1) === l;
          const word = l.outcome === 'succeeded' ? '<b class="cd-run-ok">Succeeded</b>' : l.outcome === 'failed' ? '<b class="cd-run-bad">Failed</b>' + (l.why ? ': ' + esc(l.why) : '') : l.outcome === 'waiting' ? '<b class="cd-run-wait">Waiting for you</b>' : going ? '<b class="cd-run-wait">Running</b>' : esc(l.kind === 'event' ? 'called' : 'ran');
          return esc(how) + word;
        };
        // YOUR SCHEDULES (the audit, 2026-11-10; Grok Bot's routines: pause, run once, past runs), as /schedules showed them;
        // the newest such card stays up to date (S.sched) and has the buttons: Run now, Pause or Resume, Pause all.
        const newest = !S.events.slice(i + 1).some((x) => x.type === 'schedules');
        if (newest && !S.sched && !S.schedLoading && S.project) { S.schedLoading = true; call('/projects/' + encodeURIComponent(S.project.id) + '/schedules').then((r) => { S.schedLoading = false; if (r.status === 200 && r.data) { S.sched = { items: r.data.schedules || [], paused: !!r.data.paused, log: r.data.log || [] }; draw(); } }); }
        const d = newest && S.sched ? S.sched : { items: e.items || [], paused: !!e.paused, log: e.log || [] };
        const when = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        out.push('<div class="cd-sched"><div class="cd-sched-head"><b>Your schedules</b>' +
          (newest ? '<button type="button" class="cd-card-no cd-sched-btn" data-sched-all="' + (d.paused ? 'resume' : 'pause') + '">' + (d.paused ? 'Resume all' : 'Pause all') + '</button>' : '') + '</div>' +
          (d.paused ? '<p class="cd-sched-paused">Paused: no schedule, wake-up or webhook call runs until you resume.</p>' : '') +
          // Each one's task too, as Grok Bot's routine shows its Instruction; Edit starts the words in the box, Delete asks first.
          (d.items.length ? d.items.map((x) => '<div class="cd-sched-row' + (x.paused ? ' is-paused' : '') + '"><div class="cd-sched-t"><b>' + esc(x.name) + '</b><small>' + esc(x.when) + (x.paused ? ' · Paused' : x.nextLocal ? ' · Next: ' + esc(x.nextLocal) : '') + '</small>' + (x.task ? '<span class="cd-sched-task">' + esc(x.task) + '</span>' : '') + '</div>' +
            (newest ? '<div class="cd-sched-btns"><button type="button" class="cd-card-no cd-sched-btn" data-sched-run="' + esc(x.id) + '"' + (S.running ? ' disabled' : '') + '>Run now</button><button type="button" class="cd-card-no cd-sched-btn" data-sched-' + (x.paused ? 'resume' : 'pause') + '="' + esc(x.id) + '">' + (x.paused ? 'Resume' : 'Pause') + '</button><button type="button" class="cd-card-no cd-sched-btn" data-sched-edit="' + esc(x.name) + '">Edit</button><button type="button" class="cd-card-no cd-sched-btn cd-sched-del" data-sched-remove="' + esc(x.id) + '" data-name="' + esc(x.name) + '">Delete</button></div>' : '') + '</div>').join('')
            : '<p class="cd-sched-none">No schedules yet. Ask Gloopy to do something every day or week.</p>') +
          // RECENT RUNS, each with how it went (Grok Bot's run history: Running, Succeeded or Failed, with the reason).
          (d.log.length ? '<div class="cd-sched-log"><small>Recent runs</small>' + d.log.slice(-6).reverse().map((l) => '<div>' + esc(when(l.at)) + ' · ' + esc(l.name) + ' · ' + runWords(l, d.log) + '</div>').join('') + '</div>' : '') +
          (newest && S.schedMsg ? '<p class="cd-secret-err">' + esc(S.schedMsg) + '</p>' : '') + '</div>');
      }
      else if (e.type === 'page') {
        // A PAGE GLOOPY MADE (2026-11-09; Grok Bot's page card, "the page's title and Open"): it opens the latest version;
        // a card for a page published again later says so.
        const later = S.events.slice(i + 1).some((x) => x.type === 'page' && x.id === e.id);
        const sub = later ? 'Updated below' : Number(e.version) > 1 ? 'Updated' + (e.note ? ': ' + e.note : '') : 'Page';
        out.push('<div class="cd-pagecard"><span class="cd-pagecard-ic">' + ICON.page + '</span><span class="cd-pagecard-txt"><b>' + esc(e.title || 'Page') + '</b><span>' + esc(sub) + '</span></span><button type="button" class="cd-card-yes cd-pagecard-open" data-page-open="' + esc(e.id) + '">Open</button></div>');
      }
      else if (e.type === 'handoff') {
        // A STEP ONLY YOU CAN DO, IN GLOOPY'S BROWSER (2026-11-09; Grok Bot hands you the computer, dots' browser handoff):
        // Open browser takes over at once; "Done, hand it back" answers it there.
        // THE LIVE SCREEN IN THE CARD (owner, 2026-11-12: "yes build all four"; Grok Bot's card shows its screen, with Skip,
        // I'm done and Take over): Gloopy's browser, live, right here (a QR code can be scanned from it); "I'm done" when the
        // step is done without taking over; "Take over" to use the browser yourself.
        const live = cardOpen(i, e);
        out.push('<div class="cd-secret cd-handoff"><div class="cd-secret-icon">' + ICON.web.replace('width="16" height="16"', 'width="26" height="26"') + '</div><b class="cd-secret-t">Gloopy needs you in its browser</b>' +
          '<p class="cd-secret-how">' + esc(e.task || '') + (e.site ? ' · <code>' + esc(e.site) + '</code>' : '') + '</p>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          (live ? hoScreen() : '') +
          '<p class="cd-secret-p">Do only this step, then choose “I’m done”. To use Gloopy’s browser yourself, take over. Gloopy sees the page again after.</p>' + until(i, e) + gone(i, e) +
          (live ? (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-handoff-skip="' + esc(e.id) + '">Skip</button><button type="button" class="cd-card-no" data-handoff-done="' + esc(e.id) + '">I’m done</button><button type="button" class="cd-card-yes" data-handoff-open="' + esc(e.id) + '"' + (S.webOK ? '' : ' disabled') + '>Take over</button></div>' : '') + '</div>');
      }
      else if (e.type === 'secret') {
        // A KEY FOR ONE HOST (owner, 2026-11-06, like Claude Code's card): typed here, sealed on the server, added by the proxy; Coder never sees it.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        // In Gloopy's chat (2026-11-09): a key kept for Gloopy alone (its own store, not one of Coder's environments).
        out.push('<div class="cd-secret"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">' + (GLOOPY ? 'Gloopy needs a key for ' : 'Coder needs a secret for ') + esc(e.host) + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-how">Sent as <code>' + esc(e.header || 'Authorization') + ': ' + esc(e.prefix == null ? 'Bearer ' : (e.prefix ? e.prefix + ' ' : '')) + '&lt;your key&gt;</code></p>' +
          (GLOOPY ? '<p class="cd-secret-p">It’s kept sealed for Gloopy and only sent to ' + esc(e.host) + ': it is added to Gloopy’s requests to ' + esc(e.host) + ' after they leave its computer, so Gloopy never sees it.</p>'
            : '<p class="cd-secret-p">This secret is saved on the environment ' + esc(S.envInfo ? S.envInfo.name : 'of this chat') + ': every chat that uses it can reach ' + esc(e.host) + ' with it. It\'s kept secure: Coder never sees it, and it\'s only sent to ' + esc(e.host) + '.</p>') +
          (live ? '<label class="cd-secret-l" for="cdSecretIn">' + esc(e.name || 'Token') + '</label><input id="cdSecretIn" class="cd-secret-in" type="password" autocomplete="off" spellcheck="false">' +
            (S.secretMsg ? '<p class="cd-secret-err">' + esc(S.secretMsg) + '</p>' : '') +
            '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-secret-no="' + esc(e.host) + '">Decline</button><button type="button" class="cd-secret-save" data-secret-host="' + esc(e.host) + '" data-secret-header="' + esc(e.header || 'Authorization') + '" data-secret-prefix="' + esc(e.prefix == null ? 'Bearer' : e.prefix) + '" data-secret-name="' + esc(e.name || '') + '" disabled>Save</button></div>'
          : '') + '</div>');
      }
      else if (e.type === 'todo') { if (S.events.slice(i + 1).some((x) => x.type === 'todo')) return; out.push('<div class="cd-todo"><b>Plan</b>' + (e.items || []).map((x) => '<div class="cd-todo-i is-' + esc(x.status) + '"><span class="cd-todo-box">' + (x.status === 'done' ? '✓' : x.status === 'in_progress' ? '•' : '') + '</span>' + esc(x.text) + '</div>').join('') + '</div>'); }
      // STOPPED, AND GOING ON FROM THERE (the docs, 2026-11-10; dots' Pause stops the current task, Resume continues it):
      // on Gloopy's last stop, while nothing came after it, a Resume button.
      else if (e.type === 'stopped') out.push('<div class="cd-note">Stopped.' + (GLOOPY && !S.running && !S.sending && i === S.events.length - 1 ? ' <button type="button" class="cd-card-no cd-resume" data-resume="1">Resume</button>' : '') + '</div>');
      else if (e.type === 'note') out.push('<div class="cd-localnote">' + esc(e.text) + '</div>');
      else if (e.type === 'expired') return;
      else if (e.type === 'notify') out.push('<div class="cd-localnote">Notified you: ' + esc(e.text) + '</div>');
      // ITS MONITOR PAUSED THE RUN (2026-11-10; dots' "a pause can surface a warning for the owner to review").
      else if (e.type === 'paused') out.push('<div class="cd-paused" role="status"><b>Gloopy paused this task</b><p>' + esc(e.why || 'Something in it looked wrong.') + '</p><p class="cd-paused-how">Its monitor watches over each run and stops when something looks off. Tell Gloopy how to carry on, or leave it.</p></div>');
    });
    flush();
    if (S.running && GLOOPY) out.push(statusLine(S.events.slice(lastUser + 1), results));
    else if (S.running && !S.events.slice(lastUser + 1).some((e) => e.type === 'bash' && !results[e.id])) out.push('<div class="cd-thinking"><span></span><span></span><span></span></div>');
    return out.join('');
  }

  // THE CHAT'S OWN BAR: its title, repository and branch, the pull request,
  // See changes. ☰ opens the chats on a phone.
  // GLOOPY'S CHAT (owner, 2026-11-09): its figure and name on top (the ☰ opens the side on a phone, the way back to
  // Coder), one chat in the side, and its welcome before the first message, with ways to start.
  const gloopyFig = (h) => (typeof window.gloopyHTML === 'function' ? window.gloopyHTML(h) : '');
  function gloopyHeadHTML() {
    return '<div class="cd-head">' +
      '<button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button>' +
      '<span class="cd-gl-av" aria-hidden="true">' + gloopyFig(26) + '</span><b class="cd-title-bar">' + esc((S.project && S.project.title) || 'Gloopy') + '</b>' +
      (S.webOK && S.project ? '<button type="button" class="cd-hbtn cd-web-btn" id="cdWeb"' + (S.web && !S.web.card ? ' aria-pressed="true"' : '') + '>' + ICON.web + 'Browser' + (S.web && S.web.control ? ' · You' : S.running ? ' · Live' : '') + '</button>' : '') +
      // WHAT GLOOPY MAY DO (the owner, 2026-11-10: "all of it"): its settings, your rules and your sites, in one place.
      (S.project ? '<button type="button" class="cd-hbtn cd-web-btn" id="cdGset">' + ICON.sliders + 'Settings</button>' : '') +
    '</div>' + (S.web && !S.web.card ? webHTML() : '') + (S.view ? viewHTML() : '');
  }
  // A PREVIEW OF A FILE (the audit, 2026-11-10): a PDF or a picture Gloopy made, shown over the chat at its signed address
  // (10 minutes), with Download; Escape or × closes it.
  function viewHTML() {
    const v = S.view;
    return '<div class="cd-view" id="cdView" role="dialog" aria-modal="true" aria-label="' + esc(v.name) + '"><div class="cd-view-box">' +
      '<div class="cd-view-bar"><b>' + esc(v.name) + '</b><button type="button" class="cd-card-no cd-sched-btn" data-file-get="' + esc(v.id) + '" data-file-name="' + esc(v.name) + '">Download</button><button type="button" class="cd-view-x" id="cdViewClose" aria-label="Close">×</button></div>' +
      '<div class="cd-view-body">' + (v.type === 'application/pdf' ? '<iframe src="' + esc(v.url) + '" title="' + esc(v.name) + '"></iframe>' : '<img src="' + esc(v.url) + '" alt="' + esc(v.name) + '">') + '</div></div></div>';
  }

  // A PAGE GLOOPY MADE, OPENED (2026-11-09; src/gloopy-pages.mjs): over the chat, from its own short-lived address, in a
  // frame sealed off from the app (its own sandbox: no sign-in, nothing stored for the site, nothing sent anywhere). It
  // lives outside the redrawn chat, so it does not reload while Gloopy works. Close or Escape returns to the chat.
  const pageEsc = (e) => { if (e.key === 'Escape') closePage(); };
  function closePage() { const v = document.getElementById('cdPageView'); if (v) v.remove(); document.removeEventListener('keydown', pageEsc); }
  async function openPage(id) {
    if (!S.project) return;
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/pages', { method: 'POST', body: JSON.stringify({ open: id }) });
    if (r.status !== 200 || !r.data || !r.data.url) { S.error = (r.data && r.data.error) || 'The page could not be opened.'; return draw(); }
    closePage();
    const v = document.createElement('div');
    v.className = 'cd-pageview'; v.id = 'cdPageView';
    v.innerHTML = '<div class="cd-pageview-bar"><span class="cd-pageview-ic">' + ICON.page + '</span><b class="cd-pageview-t"></b><span class="cd-pageview-v"></span><button type="button" class="cd-pageview-x" aria-label="Close the page">×</button></div>' +
      '<iframe class="cd-pageview-frame" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>';
    v.querySelector('.cd-pageview-t').textContent = r.data.page.title;
    v.querySelector('.cd-pageview-v').textContent = 'Version ' + r.data.page.version;
    const f = v.querySelector('iframe');
    f.title = r.data.page.title;
    f.src = r.data.url;
    v.querySelector('.cd-pageview-x').addEventListener('click', closePage);
    document.body.appendChild(v);
    document.addEventListener('keydown', pageEsc);
  }

  // GLOOPY'S BROWSER, LIVE (owner, 2026-11-09: "Ok you can start"; Grok Bot's computer preview and Take control, dots'
  // Open computer, Take over and Return control): the page in Gloopy's browser as it is now, refreshed while you watch,
  // and yours to use once you take over (clicks, typing, keys, scrolling, Back), until you hand it back or send a message.
  // It looks only while it is worth it: while Gloopy works, while you use it (up to 15 minutes without a touch) and for 2
  // minutes after you open it; then it pauses, so it never keeps Gloopy's computer awake for nothing. A look never wakes
  // a computer that is asleep (its browser is closed then).
  const WEB_EVERY_MS = 800, WEB_WATCH_MS = 2 * 60 * 1000, WEB_HOLD_MS = 15 * 60 * 1000, WEB_WAIT_MS = 6000, WEB_NEXT_MS = 30;
  const webPath = () => '/projects/' + encodeURIComponent(S.project.id) + '/screen';
  // What you were asked to do in Gloopy's browser: a handoff, or a sign-in you chose to do there yourself (Take over on its card).
  const webHandoff = () => { const p = S.project && S.project.pending; return !p ? null : p.kind === 'handoff' ? p : p.kind === 'signin' && S.signTake === p.id ? { ...p, task: (p.code ? 'Type the code for ' : 'Sign in to ') + (p.site || 'the site'), signin: true } : null; };
  function webHTML() {
    const w = S.web;
    const st = w.control ? ['is-you', 'You have control'] : w.working || S.running ? ['is-work', 'Gloopy is using it'] : w.asleep ? ['', 'Asleep'] : w.off ? ['', 'Closed'] : ['', 'Gloopy isn’t using it'];
    const host = (() => { try { return w.url && /^https?:/.test(w.url) ? new URL(w.url).host : ''; } catch (e) { return ''; } })();
    const empty = w.none ? 'Gloopy’s browser isn’t on this computer.'
      : w.asleep ? (S.running ? 'Gloopy’s computer is waking up. Its browser shows here once Gloopy opens it.' : 'Gloopy’s computer is asleep. Its browser opens when Gloopy uses it, or when you take over.')
      : w.off ? 'Gloopy’s browser is closed. It opens when Gloopy uses it, or when you take over.'
      : !w.shot ? (w.error ? 'The browser could not be shown: ' + w.error : 'Opening…') : '';
    const ho = webHandoff();
    return '<div class="cd-web" id="cdWebPanel">' +
      '<div class="cd-web-bar"><span class="cd-web-st ' + st[0] + '"><i></i>' + st[1] + '</span>' +
        // ITS HELPERS' OWN TABS (2026-11-10: several browsers at once), while they browse: Gloopy's page, or a helper's.
        (w.lanes && w.lanes.length && !w.control ? '<span class="cd-web-lanes" role="group" aria-label="Whose tab">' + [{ id: 0, title: '' }, ...w.lanes].map((x) => '<button type="button" class="cd-web-lane" data-web-lane="' + x.id + '" aria-pressed="' + ((w.lane || 0) === x.id ? 'true' : 'false') + '"' + (x.title ? ' title="' + esc(x.title) + '"' : '') + '>' + (x.id ? 'Helper ' + x.id : 'Gloopy') + '</button>').join('') + '</span>' : '') +
        // THROUGH YOUR COMPUTER (2026-11-11): while its new connections go through the owner's computer.
        (w.route === 'desktop' && !w.lane ? '<span class="cd-web-route" title="Sites see your computer’s internet connection">Through your computer</span>' : '') +
        '<span class="cd-web-addr" id="cdWebAddr" title="' + esc(w.url || '') + '">' + esc(w.title || '') + (host ? ' · ' + esc(host) : '') + '</span>' +
        (w.paused ? '<button type="button" class="cd-web-mini" id="cdWebResume">Refresh</button>' : '') +
        // MARK A PART OF THE PAGE (dots' annotations): drag over it, then say what about it.
        (w.shot && !empty && !w.lane && !S.webTerm ? (w.marking ? '<button type="button" class="cd-web-mini" id="cdWebMarkOff">Cancel marking</button>' : '<button type="button" class="cd-web-mini" id="cdWebMarkOn">Mark a part</button>') : '') +
        '<button type="button" class="cd-web-x" id="cdWebClose" aria-label="Close the browser view">×</button></div>' +
      // THE WHOLE COMPUTER (owner, 2026-11-12: "yes build all four"; Grok Bot's live view is a real browser with its tabs
      // and address bar, and a terminal): Gloopy's tabs and its terminal, then the address row, as a browser has them.
      (w.lane ? '' : webTabsHTML(w)) +
      (w.lane || S.webTerm ? '' : w.control ? webNavHTML() : '<div class="cd-web-tools cd-web-nav cd-web-ro"><span class="cd-web-lock" aria-hidden="true">' + (/^https:/.test(w.url || '') ? '🔒' : 'ⓘ') + '</span><span class="cd-web-full" id="cdWebFull" title="' + esc(w.url || '') + '">' + esc(w.url || '') + '</span></div>') +
      (S.webTerm && !w.lane ? webTermHTML(w) : '<div class="cd-web-screen' + (w.control ? ' is-you' : '') + (w.marking ? ' is-marking' : '') + '" id="cdWebScreen"' + (w.control ? ' tabindex="0" aria-label="Gloopy’s browser: click to use it, type to type into it"' : '') + '>' +
        // WHERE GLOOPY JUST ACTED (the second docs check, 2026-11-10: Grok Bot's preview shows "clicks, typing,
        // navigation"): a mark over the element of its last step, for a while.
        (empty ? '<p class="cd-web-empty">' + esc(empty) + '</p>' : '<span class="cd-web-pic"><img id="cdWebImg" src="' + esc(w.shot) + '" alt="Gloopy’s browser" draggable="false"><i class="cd-web-mark" id="cdWebMark"' + webMarkStyle(w) + '></i><i class="cd-web-sel" id="cdWebSel"' + webSelStyle(w) + '></i></span>') + '</div>') +
      // WHAT ABOUT THE PART YOU MARKED: your note, sent to Gloopy with what that part shows.
      (w.marking ? '<div class="cd-web-tools cd-web-note">' + (w.sel ? '<input id="cdWebNote" class="cd-web-in" type="text" placeholder="What about this part?" autocomplete="off" value="' + esc(S.webNote || '') + '"><button type="button" class="cd-web-go" id="cdWebNoteSend">Send to Gloopy</button>' : '<span>Drag over the part of the page you mean.</span>') + '</div>' : '') +
      (w.control && !S.webTerm ? '<div class="cd-web-tools"><input id="cdWebType" class="cd-web-in" type="text" placeholder="Type into the page" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(S.webBox || '') + '">' +
        '<button type="button" id="cdWebSend">Type</button><button type="button" data-web-key="Enter">Enter</button><button type="button" data-web-key="Tab">Tab</button><button type="button" data-web-key="Backspace" aria-label="Backspace">⌫</button>' +
        '<button type="button" data-web-scroll="-600" aria-label="Scroll up">↑</button><button type="button" data-web-scroll="600" aria-label="Scroll down">↓</button></div>' +
        // A FILE FROM YOUR DEVICE, when the page asks for one (its own file box never shows here).
        (w.chooser ? '<div class="cd-web-tools cd-web-file"><span>The page asks for a file.</span><label class="cd-web-pick">Choose a file<input type="file" id="cdWebFile" hidden></label></div>' : '') +
        // YOUR SECURITY KEY (2026-11-11), when the page asks for one: signed in the Go Farther app, or not now.
        (w.key ? '<div class="cd-web-tools cd-web-file cd-web-key"><span>The page asks for your security key, to sign in to ' + esc(w.key.site) + '.</span>' + (DESKTOP_KEY ? '<button type="button" class="cd-web-pick" id="cdWebKeyUse">Use my security key</button>' : '<span class="cd-web-keyhow">Your key works from the Go Farther app on your Mac or Windows computer.</span>') + '<button type="button" class="cd-web-pick" id="cdWebKeyNo">Not now</button></div>' : '') : '') +
      // TEACH A TASK (Grok Bot's): do it once while you have control, then name it; Gloopy writes it down as a how-to.
      (w.control && w.taught ? '<div class="cd-web-tools cd-web-note"><input id="cdWebTaskName" class="cd-web-in" type="text" placeholder="What should Gloopy call this task?" autocomplete="off" maxlength="80" value="' + esc(S.webTask || '') + '"><button type="button" class="cd-web-go" id="cdWebTaskSend">Send to Gloopy</button><button type="button" id="cdWebTaskDrop">Discard</button></div>' : '') +
      '<div class="cd-web-foot">' + (w.lane && !w.control ? '<p>Helper ' + w.lane + '’s own tab: you can watch it. Gloopy’s page is the one you can take over.</p></div></div>' : '') + (w.lane && !w.control ? '' : (w.msg ? '<p class="cd-web-err">' + esc(w.msg) + '</p>' : w.control && w.teaching ? '<p>Teaching Gloopy: do the task, then press Done. ' + w.teaching.steps + ' step' + (w.teaching.steps === 1 ? '' : 's') + ' so far' + (w.teaching.full ? ' (that’s the most it keeps)' : '') + '. Passwords and card details aren’t kept.</p>' : w.control && w.taught ? '<p>' + w.taught.steps.filter((x) => !/^On https?:/.test(x)).length + ' steps written down. Name the task to send them to Gloopy.</p>' : w.control ? '<p>Click on the page to use it. ' + (ho ? 'Do only this: ' + esc(ho.task) + (/[.!?…]$/.test(ho.task) ? '' : '.') : 'Gloopy sees the page again when you hand it back.') + '</p>' : w.working || S.running ? '<p id="cdWebDid">' + (w.last ? 'Gloopy: ' + esc(w.last.did) : 'You’re watching Gloopy work.') + '</p>' : '<p>Take over to use Gloopy’s browser yourself, then hand it back.</p>') +
        (w.control && !ho && !w.taught ? (w.teaching ? '<button type="button" class="cd-card-no" id="cdWebTeachOff">Done teaching</button>' : '<button type="button" class="cd-card-no" id="cdWebTeachOn">Teach Gloopy</button>') : '') +
        (w.control ? '<button type="button" class="cd-card-yes" id="cdWebGive">' + (ho ? 'Done, hand it back' : 'Hand it back') + '</button>'
          // TAKING OVER WHILE GLOOPY WORKS stops it first (one press: Stop, then Take over).
          : '<button type="button" class="cd-card-yes" id="cdWebTake"' + (w.none ? ' disabled' : '') + '>' + (w.working || S.running ? 'Stop and take over' : 'Take over') + '</button>') +
      '</div></div>');
  }
  const webAddr = () => { const u = S.web && S.web.url; return u && /^https?:/.test(u) ? u : 'Go to an address'; };
  // YOUR OWN WAY AROUND (dots: Take over gives "its mouse and keyboard"): Back, Forward, Reload and an address; above the
  // page since 2026-11-12, where a browser has them.
  function webNavHTML() {
    return '<div class="cd-web-tools cd-web-nav"><button type="button" id="cdWebBack">Back</button><button type="button" id="cdWebFwd">Forward</button><button type="button" id="cdWebReload">Reload</button>' +
      // The page's own address shows in the box (live test, 2026-11-12: Chrome's does), until you type another.
      '<input id="cdWebUrl" class="cd-web-in" type="text" inputmode="url" placeholder="' + esc(webAddr()) + '" aria-label="Go to an address" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(S.webUrl || '') + '"><button type="button" id="cdWebGo">Go</button></div>';
  }
  // GLOOPY'S TABS AND ITS TERMINAL, as tabs (2026-11-12): each tab of its browser (one, with its page's title, until a
  // second opens); while you have control, switch to one, close one (never the last) or open one (+). Terminal shows its
  // command line.
  function webTabsHTML(w) {
    const list = w.tabs && w.tabs.length ? w.tabs : [{ id: 0, title: w.title || '', url: w.url || '', on: true }];
    const many = list.length > 1;
    const host = (u) => { try { return /^https?:/.test(u) ? new URL(u).host.replace(/^www\./, '') : ''; } catch (e) { return ''; } };
    return '<div class="cd-web-tabs" role="tablist" aria-label="Gloopy’s tabs">' + list.map((x) => {
      const on = x.on && !S.webTerm;
      const name = x.title || host(x.url) || 'New tab';
      return '<span class="cd-web-tabwrap' + (on ? ' is-on' : '') + '"><button type="button" class="cd-web-tab" role="tab" data-web-tab="' + x.id + '" aria-selected="' + (on ? 'true' : 'false') + '" title="' + esc(x.url || name) + '"><i aria-hidden="true">' + esc((host(x.url) || name || '·').slice(0, 1).toUpperCase()) + '</i><span>' + esc(name) + '</span></button>' +
        (w.control && many && x.id ? '<button type="button" class="cd-web-tabx" data-web-tabx="' + x.id + '" aria-label="Close this tab">×</button>' : '') + '</span>';
    }).join('') +
      (w.control ? '<button type="button" class="cd-web-tabnew" id="cdWebNewTab" aria-label="New tab" title="New tab">+</button>' : '') +
      '<button type="button" class="cd-web-tab cd-web-termtab" role="tab" id="cdWebTermTab" aria-selected="' + (S.webTerm ? 'true' : 'false') + '"><i aria-hidden="true">›_</i><span>Terminal</span></button></div>';
  }
  // GLOOPY'S TERMINAL (2026-11-12; Grok Bot's computer has one, and its Bot checked a site from it): the commands Gloopy
  // ran in this chat, with what they printed, then yours; while you have control, a command of your own, run on its
  // computer as Gloopy's are (and Gloopy is told at its next message).
  function webTermHTML(w) {
    const results = {};
    for (const e of S.events) if (e.type === 'result' && e.id) results[e.id] = e;
    const its = S.events.filter((e) => e.type === 'bash' && (!e.tool || e.tool === 'bash') && typeof e.command === 'string').slice(-30);
    const line = (who, cmd, r) => '<div class="cd-term-cmd"><span class="cd-term-who">' + who + '</span><span class="cd-term-p">$</span> ' + esc(cmd) + '</div>' +
      (r ? '<pre class="cd-term-out' + (Number(r.code) && Number(r.code) !== 0 ? ' is-bad' : '') + '">' + esc(String(r.output || '').slice(-4000)) + (r.timedOut ? '\n[stopped after a minute]' : '') + '</pre>' : '<pre class="cd-term-out is-run">…</pre>');
    const body = its.map((e) => line('gloopy', e.command.split('\n').slice(0, 6).join('\n'), results[e.id])).join('') + (S.webRan || []).map((x) => line('you', x.command, x.done ? x : null)).join('');
    return '<div class="cd-web-term" id="cdWebTerm" role="log" aria-label="Gloopy’s terminal">' + (body || '<p class="cd-term-none">Gloopy hasn’t run a command in this chat yet.' + (w.control ? ' Run one below.' : '') + '</p>') + '</div>' +
      (w.control ? '<div class="cd-web-tools cd-web-cmd"><span class="cd-term-p" aria-hidden="true">$</span><input id="cdWebCmd" class="cd-web-in" type="text" placeholder="A command for Gloopy’s computer" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(S.webCmd || '') + '"' + (S.webRunning ? ' disabled' : '') + '><button type="button" id="cdWebRun"' + (S.webRunning ? ' disabled' : '') + '>' + (S.webRunning ? 'Running…' : 'Run') + '</button></div>' : '<div class="cd-web-tools cd-web-ro"><span>Take over to run a command of your own.</span></div>');
  }
  // The box you are marking, over the picture.
  function webSelStyle(w) {
    const b = w.marking && w.sel;
    if (!b) return ' hidden';
    const W = w.w || 1280, H = w.h || 800, pc = (v, of) => Math.max(0, Math.min(100, (v / of) * 100)).toFixed(2) + '%';
    return ' style="left:' + pc(b.x, W) + ';top:' + pc(b.y, H) + ';width:' + pc(b.w, W) + ';height:' + pc(b.h, H) + '"';
  }
  // The mark's place over the picture, in shares of the page's width and height.
  function webMarkStyle(w) {
    const b = !w.control && w.last && w.last.box;
    if (!b) return ' hidden';
    const W = w.w || 1280, H = w.h || 800, pc = (v, of) => Math.max(0, Math.min(100, (v / of) * 100)).toFixed(2) + '%';
    return ' style="left:' + pc(b.x, W) + ';top:' + pc(b.y, H) + ';width:' + pc(b.w, W) + ';height:' + pc(b.h, H) + '"';
  }
  function webOpen(take, card) {
    if (!S.project) return;
    S.web = { url: '', title: '', shot: '', hash: '', control: false, working: false, touched: Date.now(), msg: '', card: !!card && !take };
    draw();
    if (take) webTake(); else webTick();
  }
  function webClose() {
    if (S.webTimer) clearTimeout(S.webTimer);
    S.webTimer = 0;
    if (S.webAbort) S.webAbort.abort();
    // Closing the view while you have control hands the browser back.
    if (S.web && S.web.control && S.project) call(webPath(), { method: 'POST', body: JSON.stringify({ take: false }) });
    S.web = null; S.webBox = ''; draw();
  }
  // What the machine said about the browser, kept for the view; a new picture only when it changed.
  function webTake_(d) {
    const w = S.web;
    if (!w || !d) return;
    w.asleep = d.asleep === true; w.off = d.off === true; w.none = d.none === true;
    w.error = d.error ? String(d.error) : '';
    if (typeof d.control === 'boolean') w.control = d.control;
    w.working = d.working === true;
    if (typeof d.url === 'string') w.url = d.url;
    if (typeof d.title === 'string') w.title = d.title;
    if (d.shot) { w.shot = 'data:image/jpeg;base64,' + d.shot; w.hash = d.hash || ''; }
    if (Number(d.w) > 0 && Number(d.h) > 0) { w.w = Number(d.w); w.h = Number(d.h); }
    // Gloopy's last step (its words, and where on the page), and a page asking you for a file.
    w.last = d.last && typeof d.last.did === 'string' ? { did: d.last.did.slice(0, 200), box: d.last.box && Number.isFinite(d.last.box.x) ? d.last.box : null } : null;
    w.chooser = !!d.chooser;
    // A page waiting for your security key (2026-11-11): its site, and its request (for the Go Farther app to sign).
    w.key = d.key && typeof d.key.site === 'string' && d.key.request && typeof d.key.request === 'object' ? { site: d.key.site.slice(0, 200), origin: String(d.key.origin || '').slice(0, 300), request: d.key.request } : null;
    // Through the owner's computer (2026-11-11): "desktop" while its new connections go through it.
    w.route = d.route === 'desktop' || d.route === 'cloud' ? d.route : '';
    // Its helpers' tabs: a helper's that closed returns the view to Gloopy's page.
    w.lanes = Array.isArray(d.lanes) ? d.lanes.filter((x) => x && Number.isInteger(x.id) && x.id > 0).slice(0, 4).map((x) => ({ id: x.id, title: String(x.title || '').slice(0, 120) })) : [];
    // GLOOPY'S TABS (2026-11-12): all of them while there is more than one (a site's new tab, or one you opened).
    if (!d.lane && !w.lane) w.tabs = Array.isArray(d.tabs) ? d.tabs.filter((x) => x && Number.isInteger(x.id) && x.id > 0).slice(0, 12).map((x) => ({ id: x.id, title: String(x.title || '').slice(0, 120), url: String(x.url || '').slice(0, 500), on: x.on === true })) : [];
    if (w.lane && !w.lanes.some((x) => x.id === w.lane)) { w.lane = 0; w.hash = ''; }
    w.teaching = d.teaching && typeof d.teaching.steps === 'number' ? { steps: d.teaching.steps, full: d.teaching.full === true } : null;
    if (w.asleep || w.off || w.none) { w.shot = ''; w.hash = ''; }
  }
  // Paints the new picture in place when only it changed (no redraw while you type or click); redraws otherwise.
  function webPaint(before) {
    const w = S.web;
    if (!w) return;
    const shape = webShape();
    const img = S.root && S.root.querySelector('#cdWebImg');
    const ho = S.root && S.root.querySelector('#cdHoImg');
    if (ho && w.shot && ho.getAttribute('src') !== w.shot) ho.setAttribute('src', w.shot);
    if (before === shape && !img && ho && w.card) return;
    if (before === shape && img) {
      if (img.getAttribute('src') !== w.shot) img.setAttribute('src', w.shot);
      // Gloopy's last step, in words and as a mark, in place.
      const mk = S.root.querySelector('#cdWebMark');
      if (mk) { const st = webMarkStyle(w); if (st === ' hidden') mk.hidden = true; else { mk.hidden = false; mk.setAttribute('style', st.replace(/^ style="|"$/g, '')); } }
      const did = S.root.querySelector('#cdWebDid');
      if (did) did.textContent = w.last ? 'Gloopy: ' + w.last.did : 'You’re watching Gloopy work.';
      const full = S.root.querySelector('#cdWebFull');
      if (full && full.textContent !== (w.url || '')) { full.textContent = w.url || ''; full.title = w.url || ''; }
      const box = S.root.querySelector('#cdWebUrl');
      if (box && box.placeholder !== webAddr()) box.placeholder = webAddr();
      const a = S.root.querySelector('#cdWebAddr');
      if (a) { let host = ''; try { host = /^https?:/.test(w.url) ? new URL(w.url).host : ''; } catch (e) { host = ''; } a.textContent = (w.title || '') + (host ? ' · ' + host : ''); a.title = w.url || ''; }
      return;
    }
    draw();
  }
  const webShape = () => { const w = S.web; return w ? [w.control, w.working, w.asleep, w.off, w.none, !!w.shot, w.paused, w.msg, w.error, S.running, !!w.chooser, !!w.marking, !!w.sel, !!w.teaching, w.teaching ? w.teaching.steps : '', !!w.taught, w.lane || 0, !!w.card, (w.tabs && w.tabs.length ? w.tabs.map((x) => x.id + (x.on ? '*' : '') + x.title).join('\n') : w.title || ''), !!S.webTerm, (w.lanes || []).map((x) => x.id).join(','), w.route || '', w.key ? w.key.site : ''].join('|') : ''; };
  // NEAR-VIDEO (the owner, 2026-11-10: "all of it"; both apps stream the screen): once there is a picture, the view is a
  // stream (live test, 2026-11-10: each look paid the sign-in check, about half a second, so it showed about two pictures
  // a second): one request carries the page's pictures as they come, for up to 25 seconds, and the next starts at once.
  // Where a stream can't be had, each look asks the machine to answer when the page next changes (wait). One at a time.
  async function webTick() {
    if (S.webTimer) clearTimeout(S.webTimer);
    S.webTimer = 0;
    const w = S.web;
    if (!w || !S.project || !S.root || !S.root.isConnected || S.webQuiet) return;
    if (S.webLooking) { S.webAgain = true; return; }
    const quiet = Date.now() - w.touched;
    if (!S.running && !w.working && quiet > (w.control || w.card ? WEB_HOLD_MS : WEB_WATCH_MS)) { const b = webShape(); w.paused = true; return webPaint(b); }
    let next = WEB_EVERY_MS;
    if (!S.root.hidden && document.visibilityState === 'visible') {
      const b = webShape();
      const live = !!w.hash && !w.asleep && !w.off && !w.none && !w.error;
      const q = [w.hash ? 'since=' + encodeURIComponent(w.hash) : '', live && !w.lane ? 'wait=' + WEB_WAIT_MS : '', w.lane ? 'lane=' + w.lane : ''].filter(Boolean).join('&');
      // The look is for one tab; moving to another cancels it (live test, 2026-11-10: a helper's tab waited for Gloopy's
      // page's look, up to 6 seconds, and that look's picture could have shown under the helper's name).
      const asked = w.lane || 0, ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      S.webLooking = true; S.webAbort = ctrl;
      let r = null, streamed = false;
      try {
        if (live && ctrl && !S.webNoStream) streamed = await webStream(w, ctrl);
        if (!streamed && S.web === w && !(ctrl && ctrl.signal.aborted)) r = await call(webPath() + (q ? '?' + q : ''), ctrl ? { signal: ctrl.signal } : undefined);
      } finally { S.webLooking = false; S.webAbort = null; }
      if (S.web !== w) return;
      if ((ctrl && ctrl.signal.aborted) || (w.lane || 0) !== asked) next = 0;
      else if (streamed) next = WEB_NEXT_MS;
      else if (r) {
        if (r.status === 200) { webTake_(r.data); if (live && !w.lane) next = WEB_NEXT_MS; } else w.error = (r.data && r.data.error) || 'Gloopy’s computer could not be reached.';
        webPaint(b);
      }
    }
    if (S.webAgain) { S.webAgain = false; next = 0; }
    S.webTimer = setTimeout(webTick, next);
  }
  // Whether the view still wants pictures: shown, not paused, and worth it (as webTick decides).
  const webKeep = (w) => S.web === w && !!S.root && S.root.isConnected && !S.root.hidden && document.visibilityState === 'visible' && !S.webQuiet && !w.asleep && !w.off && !w.none && !w.error && (S.running || w.working || Date.now() - w.touched <= (w.control || w.card ? WEB_HOLD_MS : WEB_WATCH_MS));
  // THE STREAM: the machine's events (each a look's answer), taken as they come. True once it was read (it ends after up
  // to 25 seconds, or when the view no longer wants it); false when it can't be had, so a look is asked instead. A stream
  // that brought nothing is not asked for again on this page.
  async function webStream(w, ctrl) {
    if (typeof TextDecoder !== 'function') return false;
    const r = await call(webPath() + '?stream=1&since=' + encodeURIComponent(w.hash) + (w.lane ? '&lane=' + w.lane : ''), { signal: ctrl.signal, stream: true });
    if (ctrl.signal.aborted) return true;
    if (!r.stream) {
      // A refusal (call() has dealt with it): a look is asked instead. One look's answer (Gloopy's computer asleep, or one
      // from before streams, which answers at once): taken as a look's, and looks (which wait) from now on, on this page.
      if (r.status !== 200) return false;
      if (!r.data.asleep) S.webNoStream = true;
      if (S.web === w) { const b = webShape(); webTake_(r.data); webPaint(b); }
      return true;
    }
    if (!r.stream.body || typeof r.stream.body.getReader !== 'function') { S.webNoStream = true; return false; }
    const rd = r.stream.body.getReader(), dec = new TextDecoder();
    let buf = '', got = 0;
    try {
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
          const ev = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = ev.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('');
          let d = null;
          try { d = data ? JSON.parse(data) : null; } catch (e) { d = null; }
          if (!d) continue;
          if (S.web !== w || ctrl.signal.aborted) return true;
          got++;
          const b = webShape(); webTake_(d); webPaint(b);
          if (!webKeep(w)) { ctrl.abort(); return true; }
        }
        if (buf.length > 4e6) buf = '';
      }
    } catch (e) { /* cut off, or stopped */ }
    if (!got && !ctrl.signal.aborted) S.webNoStream = true;
    return true;
  }
  // WHILE YOU TAKE OVER OR HAND BACK, the stream stops (its pictures may still say who had control before) and starts
  // again with the answer.
  function webQuiet(on) { S.webQuiet = on; if (on && S.webAbort) S.webAbort.abort(); }
  async function webTake() {
    const w = S.web;
    if (!w) return;
    w.msg = ''; w.touched = Date.now(); w.paused = false;
    // Taking over is of Gloopy's own page (a helper's tab is only watched).
    if (w.lane) { w.lane = 0; w.hash = ''; if (S.webAbort) S.webAbort.abort(); }
    // STOP AND TAKE OVER (the second docs check, 2026-11-10): while Gloopy works, it is stopped first (as Stop does),
    // and you take over once its turn has ended (it ends at its next step).
    if (S.running || w.working) {
      w.msg = 'Stopping Gloopy…'; draw();
      await stop();
      for (let i = 0; i < 60 && S.running && S.web === w; i++) await new Promise((ok) => setTimeout(ok, 500));
      if (S.web !== w) return;
      if (S.running) { w.msg = 'Gloopy is still finishing a step. Try again in a moment.'; return draw(); }
    }
    const b = webShape();
    w.msg = 'Taking over…'; webPaint(b);
    desktopRouteKick();
    webQuiet(true);
    // (With your device's time zone: the browser a take-over starts is on your clock, so Gloopy's next turn needn't restart it.)
    const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ take: true, tz: deviceZone() }) });
    webQuiet(false);
    if (S.web !== w) return;
    w.msg = r.status === 200 && !(r.data && r.data.error) ? '' : (r.data && r.data.error) || 'Gloopy’s browser could not be taken over.';
    if (r.status === 200) webTake_(r.data);
    draw();
    const sc = S.root && S.root.querySelector('#cdWebScreen');
    if (sc && w.control) sc.focus();
    webTick();
  }
  // Hand it back: a handoff Gloopy is waiting on is answered (and its words start Gloopy's next turn); otherwise the
  // browser is simply Gloopy's again, and Gloopy hears of it with your next message.
  async function webGive() {
    const w = S.web;
    if (!w) return;
    const ho = webHandoff();
    webQuiet(true);
    if (ho) {
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/' + (ho.signin ? 'signin' : 'handoff'), { method: 'POST', body: JSON.stringify(ho.signin ? { id: ho.id, tookOver: true } : { id: ho.id, done: true }) });
      webQuiet(false);
      if (r.status !== 200) { w.msg = (r.data && r.data.error) || 'Your answer could not be sent.'; draw(); return webTick(); }
      if (r.data && r.data.project) S.project = r.data.project;
      w.control = false; w.touched = Date.now();
      draw(); webTick();
      return send((r.data && r.data.said) || 'Done.', { card: true });
    }
    const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ take: false }) });
    webQuiet(false);
    if (S.web !== w) return;
    w.control = false; w.touched = Date.now(); w.msg = r.status === 200 ? '' : (r.data && r.data.error) || '';
    draw(); webTick();
  }
  // Your click, typing, key, scroll or Back, in order; the picture after it comes back with the answer.
  function webInput(input) {
    const w = S.web;
    if (!w || !w.control) return;
    w.touched = Date.now();
    S.webQueue = (S.webQueue || Promise.resolve()).then(async () => {
      if (S.web !== w || !w.control) return;
      const b = webShape();
      const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ input }) });
      if (S.web !== w) return;
      if (r.status === 200 && !(r.data && r.data.error)) { w.msg = ''; webTake_(r.data); }
      else { w.msg = (r.data && r.data.error) || 'That did not reach Gloopy’s browser.'; if (r.status === 409) w.control = false; }
      webPaint(b);
    });
  }
  // YOUR SECURITY KEY'S ANSWER (or "not now"), while you have control: through Gloopy's computer, to the page waiting.
  function webKeySend(key) {
    const w = S.web;
    if (!w || !w.control) return;
    S.webQueue = (S.webQueue || Promise.resolve()).then(async () => {
      const b = webShape();
      const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ key }) });
      if (S.web !== w) return;
      w.msg = r.status === 200 && r.data && (r.data.ok || r.data.skipped) ? '' : String((r.data && (r.data.why || r.data.error)) || 'Your key’s answer didn’t reach Gloopy’s browser.');
      w.key = null;
      webPaint(b); webTick();
    });
  }
  // Keys typed on the page itself: letters go together (a short pause sends them); Enter, Tab, arrows and the like one by one.
  const WEB_KEYS = new Set(['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
  function webKey(e) {
    const w = S.web;
    if (!w || !w.control) return;
    const flush = () => { if (S.webTyped) { const t = S.webTyped; S.webTyped = ''; webInput({ kind: 'type', text: t }); } };
    if ((e.ctrlKey || e.metaKey) && /^[a-z]$/i.test(e.key)) { e.preventDefault(); flush(); return webInput({ kind: 'key', key: (e.ctrlKey ? 'Control+' : 'Meta+') + e.key.toUpperCase() }); }
    if (WEB_KEYS.has(e.key)) { e.preventDefault(); flush(); return webInput({ kind: 'key', key: e.key }); }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      S.webTyped = (S.webTyped || '') + e.key;
      if (S.webTypeTimer) clearTimeout(S.webTypeTimer);
      S.webTypeTimer = setTimeout(flush, 250);
    }
  }
  function gloopySide(sd) {
    if (!sd || !sd.tools || !sd.tools.isConnected) return;
    sd.tools.innerHTML = '';
    sd.recents.innerHTML = '<div class="gf-item on" title="Your chat with Gloopy"><span class="gf-item-t">Your chat with Gloopy</span>' + (S.running ? '<i class="gf-dot" title="Gloopy is working"></i>' : '') + '</div>';
  }
  const GLOOPY_STARTS = ['Introduce yourself and ask me about my work', 'Research something for me, with sources', 'Help me plan my week'];
  function gloopyEmptyHTML() {
    return '<div class="cd-empty cd-gl-empty"><div class="cd-gl-fig" aria-hidden="true">' + gloopyFig(120) + '</div>' +
      '<b>Hi, I’m Gloopy</b><p>Your own assistant, with my own computer in the cloud. I look things up, keep track of what you hand me, and remember what matters to you. I never see your passwords or card numbers, and when I work on my own, I ask before I send, buy or delete anything.</p>' +
      '<div class="cd-starts">' + GLOOPY_STARTS.map((s) => '<button type="button" class="cd-start" data-answer="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div></div>';
  }

  function headHTML() {
    if (GLOOPY) return gloopyHeadHTML();
    const p = S.project;
    const title = p ? (p.title || 'New chat') : '';
    return '<div class="cd-head">' +
      '<button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button>' +
      (p ? '<b class="cd-title-bar" title="' + esc(title) + '">' + esc(title) + '</b><span class="cd-repo-bar" title="' + esc(p.repo) + '">' + ICON.gh + '<span class="cd-ell">' + esc(p.repo) + '</span></span>' : '') +
      (p ? '<span class="cd-branch" title="' + esc(p.branch) + '">' + ICON.branch + '<span class="cd-ell">' + esc(p.branch) + '</span></span>' : '') +
      // A READ-ONLY REPOSITORY (owner item 5, like Claude Code: any public repository can be worked on).
      (p && p.readOnly ? '<span class="cd-ro" title="You can read this repository on GitHub but not push to it, so Coder keeps its work on its machine (See changes shows it, and downloads it as a patch file).">Read-only</span>' : '') +
      (p && p.pr && p.pr.url ? '<a class="cd-pr" href="' + esc(p.pr.url) + '" target="_blank" rel="noopener">Pull request #' + esc(p.pr.number) + '</a><button type="button" class="cd-hbtn cd-autofix' + (p.autofix === true ? ' on' : '') + '" id="cdAutofix" title="Like Claude Code\'s auto-fix: when one of its checks fails or you review it, Coder fixes it in this chat (up to 3 tries in a row). Off until you turn it on.">Auto-fix: ' + (p.autofix === true ? 'On' : 'Off') + '</button>' : '') +
      // CREATE PR / CREATE DRAFT PR, like Claude Code's buttons (owner, 2026-11-06:
      // "Finish all this"): once the branch has work and no pull request yet.
      // Coder writes the title and description from the changes.
      (p && !p.readOnly && !(p.pr && p.pr.url) && Array.isArray(p.commits) && p.commits.length ? '<button type="button" class="cd-hbtn" id="cdMakePr"' + (S.running || S.sending ? ' disabled' : '') + '>Create PR</button><button type="button" class="cd-hbtn" id="cdMakeDraft"' + (S.running || S.sending ? ' disabled' : '') + '>Create draft PR</button>' : '') +
      (p ? '<button type="button" class="cd-hbtn" id="cdEnv"' + (S.showEnv ? ' aria-pressed="true"' : '') + '>Environment</button>' : '') +
      (p ? '<button type="button" class="cd-hbtn" id="cdChanges"' + (S.showChanges ? ' aria-pressed="true"' : '') + '>See changes</button>' : '') +
    '</div>' +
    (S.showChanges ? changesHTML() : '') + (S.showEnv ? envHTML() : '');
  }

  // THE SIDEBAR: New chat, Repositories, and Recents (the chats).
  const SIDE_ICON = {
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };
  function drawSide() {
    const sd = S.side;
    // Only the tab that is showing draws the side (the other may still be following a job).
    if (!S.root || S.root.hidden) return;
    if (GLOOPY) return gloopySide(sd);
    if (!sd || !sd.tools || !sd.tools.isConnected) return;
    const ready = S.github && S.github.connected;
    sd.tools.innerHTML =
      '<button type="button" class="gf-nav" id="cdSideNew"' + (ready ? '' : ' disabled') + '>' + SIDE_ICON.plus + 'New chat</button>' +
      '<button type="button" class="gf-nav" id="cdSideRepos"' + (ready ? '' : ' disabled') + '>' + ICON.gh.replace('width="16" height="16"', 'width="18" height="18"') + 'Repositories</button>';
    const cur = S.project && S.phase === 'chat' ? S.project.id : '';
    sd.recents.innerHTML = S.projects.length ? S.projects.map((x) =>
      '<div class="gf-item' + (x.id === cur ? ' on' : '') + '" data-chat="' + esc(x.id) + '" role="button" tabindex="0" title="' + esc((x.title || 'New chat') + ' · ' + x.repo) + '">' +
        '<span class="gf-item-t">' + esc(x.title || 'New chat · ' + x.repo.split('/').pop()) + '</span>' +
        (x.status === 'running' ? '<i class="gf-dot" title="Coder is working"></i>' : x.pr ? '<em class="gf-prn">#' + esc(x.pr) + '</em>' : '') +
        '<button type="button" class="gf-x" data-remove="' + esc(x.id) + '" aria-label="Remove this chat">×</button>' +
      '</div>').join('') : '<p class="gf-none">' + (ready ? 'No chats yet. Start one with New chat.' : 'Connect GitHub to start.') + '</p>';
    const on = (el, sel, ev, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));
    on(sd.tools, '#cdSideNew', 'click', () => showPicker('new'));
    on(sd.tools, '#cdSideRepos', 'click', () => showPicker('repos'));
    on(sd.recents, '.gf-item', 'click', (e) => { if (e.target.closest('.gf-x')) return; openProject(e.currentTarget.dataset.chat); });
    on(sd.recents, '.gf-item', 'keydown', (e) => { if (e.key === 'Enter') openProject(e.currentTarget.dataset.chat); });
    on(sd.recents, '.gf-x', 'click', (e) => { e.stopPropagation(); removeChat(e.currentTarget.dataset.remove); });
  }

  // WHAT CODER CHANGED, file by file (from its branch against the main branch).
  function changesHTML() {
    const c = S.changes;
    const p = S.project || {};
    const base = p.base || 'main';
    const list = [...new Set([base, ...(S.compareBranches || [])])];
    const pick = S.compareAgainst || base;
    // COMPARE AGAINST (like Claude Code's diff view): the base branch, or any other of the repo's.
    const bar = '<div class="cd-compare"><label for="cdCompare">Compare against</label><select id="cdCompare">' +
      list.map((b) => '<option value="' + esc(b) + '"' + (b === pick ? ' selected' : '') + '>' + esc(b) + (b === base ? ' (base)' : '') + '</option>').join('') + '</select></div>';
    if (!c) return '<div class="cd-changes">' + bar + '<span class="cd-spin"></span></div>';
    if (!c.files.length) return '<div class="cd-changes">' + bar + '<p class="cd-changes-none">' + (c.error ? esc(c.error) : pick === base ? 'No changes yet.' : 'No differences from ' + esc(pick) + '.') + '</p></div>';
    return '<div class="cd-changes">' + bar +
      '<div class="cd-changes-sum">' + c.files.length + ' file' + (c.files.length === 1 ? '' : 's') + ' changed <span class="cd-add">+' + c.add + '</span> <span class="cd-del">−' + c.del + '</span>' + (pick !== base ? ' <span class="cd-compare-vs">compared with ' + esc(pick) + '</span>' : '') +
        (p.readOnly ? ' <button type="button" class="cd-hbtn cd-patch" id="cdPatch" title="This chat\'s work, from Coder\'s machine, as one patch file (git am applies it)">Download patch</button>' : '') + '</div>' +
      c.files.map((f) => '<details class="cd-file" data-path="' + esc(f.path) + '"' + (S.openFiles[f.path] ? ' open' : '') + '><summary><code>' + esc(f.path) + '</code><span class="cd-add">+' + f.add + '</span><span class="cd-del">−' + f.del + '</span></summary>' +
        '<pre class="cd-diff">' + diffLines(f) + '</pre></details>').join('') +
    '</div>';
  }

  // A DIFF'S LINES, each one tappable to comment on it (owner, 2026-11-05).
  function diffLines(f) {
    let n = 0;
    return String(f.patch || '').split('\n').map((l, i) => {
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
      if (h) { n = Number(h[1]); return '<span class="cd-dl-hunk">' + esc(l) + '</span>'; }
      const line = l[0] === '-' ? 0 : n++;
      const cls = l[0] === '+' ? 'cd-dl-add' : l[0] === '-' ? 'cd-dl-del' : '';
      const c = S.commenting;
      const open = c && c.file === f.path && c.idx === i;
      return '<span class="cd-dl ' + cls + '" data-file="' + esc(f.path) + '" data-line="' + line + '" data-idx="' + i + '" title="Comment on this line">' + esc(l) + '</span>' +
        (open ? '<span class="cd-cbox"><input id="cdCommentIn" placeholder="Your comment for Coder…" maxlength="500"><button type="button" id="cdCommentAdd">Add</button><button type="button" id="cdCommentX">Cancel</button></span>' : '');
    }).join('');
  }

  function note(text) { S.events.push({ type: 'note', text, at: Date.now(), local: true }); draw(true); }
  function commentsHTML() {
    if (!S.comments.length) return '';
    return '<div class="cd-chips">' + S.comments.map((c, i) => '<span class="cd-chip" title="' + esc(c.quote) + '">💬 ' + esc(c.file.split('/').pop()) + (c.line ? ':' + c.line : '') + ' — ' + esc(c.text.slice(0, 40)) + '<button type="button" data-uncomment="' + i + '" aria-label="Remove comment">×</button></span>').join('') + '</div>';
  }

  // PICTURES (owner, 2026-11-05, "16"): attached or pasted, made smaller first, sent with the message.
  function picsHTML() {
    if (!S.pics || !S.pics.length) return '';
    return '<div class="cd-pics">' + S.pics.map((x, i) => '<span class="cd-pic"><img src="' + x.url + '" alt=""><button type="button" data-unpic="' + i + '" aria-label="Remove picture">×</button></span>').join('') + '</div>';
  }
  function shrink(file) {
    return new Promise((done) => {
      // Read as a data: address (the page's safety rules allow those; blob: ones are not).
      const img = new Image();
      const fr = new FileReader();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let url = c.toDataURL(type, 0.85);
        if (url.length > 1_900_000) { type = 'image/jpeg'; url = c.toDataURL(type, 0.7); }
        done(url.length > 1_990_000 ? null : { type, url, data: url.split(',')[1] });
      };
      img.onerror = () => done(null);
      fr.onload = () => { img.src = String(fr.result || ''); };
      fr.onerror = () => done(null);
      fr.readAsDataURL(file);
    });
  }
  // FILES FOR GLOOPY (2026-11-09: "4"): anything but a picture is sent to the Worker at once (at most 25 MB) and goes with
  // the next message; a chip shows it until then.
  const sizeWords = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  async function addFiles(files) {
    for (const f of files) {
      if ((S.attach || []).length >= 20) { note('At most 20 files with one message.'); break; }
      if (f.size > 25 * 1048576) { note(f.name + ' is over 25 MB.'); continue; }
      const chip = { name: f.name, size: f.size, up: true };
      S.attach = [...(S.attach || []), chip]; draw();
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/files', { method: 'PUT', raw: f });
      S.attach = (S.attach || []).filter((x) => x !== chip);
      if (r.status !== 200 || !r.data || !r.data.file) note((r.data && r.data.error) || f.name + ' could not be attached.');
      else S.attach = [...S.attach, { id: r.data.file.id, name: r.data.file.name, size: r.data.file.size }];
      draw();
    }
  }
  function attachHTML() {
    if (!S.attach || !S.attach.length) return '';
    return '<div class="cd-attach-list">' + S.attach.map((f, i) => '<span class="cd-file-chip' + (f.up ? ' is-up' : '') + '">' + ICON.doc + '<span class="cd-file-n">' + esc(f.name) + '</span><small>' + (f.up ? 'attaching…' : sizeWords(f.size)) + '</small>' + (f.up ? '' : '<button type="button" data-unattach="' + i + '" aria-label="Remove ' + esc(f.name) + '">×</button>') + '</span>').join('') + '</div>';
  }
  async function addPics(files) {
    S.pics = S.pics || [];
    if (GLOOPY && S.project) { const docs = [...files].filter((f) => !/^image\/(png|jpeg|webp|gif)$/.test(f.type)); if (docs.length) addFiles(docs); }
    for (const f of [...files].filter((f) => /^image\//.test(f.type))) {
      if (S.pics.length >= 4) { note('At most 4 pictures a message.'); break; }
      const p = await shrink(f);
      if (p) S.pics.push(p); else note('That picture is too big.');
    }
    draw();
  }
  // @ A FILE: the repo's file names, suggested as you type.
  async function loadFiles() {
    if (!S.project || (S.files && S.files.id === S.project.id)) return;
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/files');
    S.files = { id: S.project.id, list: r.status === 200 && r.data && Array.isArray(r.data.files) ? r.data.files : [] };
  }
  function mentionMatches() {
    if (!S.mention || !S.files) return [];
    return rankMentions(S.files.list, S.mention.q);
  }
  /**
   * THE @ LIST'S ORDER (the owner, 2026-11-08: "Fix those 3"; Claude Code 2.1.280: "a file whose name contains the
   * query now ranks above one that only matches across its folder names"): a file whose name starts with what was
   * typed, then one whose name has it, then one that matches only through its folders; shorter paths first.
   */
  function rankMentions(list, q) {
    q = String(q || '').toLowerCase();
    const rank = (p) => { const l = p.toLowerCase(), name = l.slice(l.lastIndexOf('/') + 1); return name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2; };
    return list.filter((p) => p.toLowerCase().includes(q)).sort((a, b) => rank(a) - rank(b) || a.length - b.length || (a < b ? -1 : 1)).slice(0, 8);
  }
  function mentionHTML() {
    const list = mentionMatches();
    if (!list.length) return '';
    const sel = Math.min(S.mentionSel || 0, list.length - 1);
    return '<div class="cd-mention" role="listbox">' + list.map((p, i) => '<button type="button" class="cd-mention-i' + (i === sel ? ' on' : '') + '" data-file="' + esc(p) + '" role="option">' + esc(p) + '</button>').join('') + '</div>';
  }
  function pickMention(path) {
    const input = S.root && S.root.querySelector('#cdIn');
    const at = S.mention ? S.mention.at : -1;
    if (at < 0) return;
    const v = S.draft;
    const end = at + 1 + S.mention.q.length;
    S.draft = v.slice(0, at) + '@' + path + ' ' + v.slice(end);
    S.mention = null; draw();
    const i = S.root.querySelector('#cdIn'); if (i) { i.focus(); const pos = at + path.length + 2; i.setSelectionRange(pos, pos); }
    void input;
  }

  function composerHTML() {
    const busy = S.running || S.sending;
    const m = MODELS.find((x) => x.id === S.pick.model) || MODELS[0];
    return '<div class="cd-composewrap">' + mentionHTML() + commentsHTML() + picsHTML() + attachHTML() +
      '<form class="cd-compose" id="cdForm">' +
        '<textarea id="cdIn" rows="1" placeholder="' + (busy ? (GLOOPY ? 'Gloopy is working… you can close this tab' : 'Coder is working… you can close this tab') : GLOOPY ? 'Ask Gloopy anything' : 'Ask Coder to build, fix or explain something · @ for a file') + '">' + esc(S.draft) + '</textarea>' +
        '<button type="button" class="cd-attach" id="cdAttach" aria-label="' + (GLOOPY ? 'Attach a file' : 'Attach a picture') + '" title="' + (GLOOPY ? 'Attach a file or a picture' : 'Attach a picture (or paste one)') + '">' + ICON.clip + '</button><input type="file" id="cdFile" accept="' + (GLOOPY ? 'image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.html,.htm,.ics,.vcf,.eml,.ipynb,.log,.zip,.mp3,.m4a,.wav,.mp4,.mov,.webm,.heic,.svg' : 'image/png,image/jpeg,image/webp,image/gif') + '" multiple hidden>' +
        (S.running
          ? '<button type="button" class="cd-send cd-stop" id="cdStop" aria-label="Stop">' + ICON.stop + '</button>'
          : '<button type="submit" class="cd-send" aria-label="Send"' + (S.sending ? ' disabled' : '') + '>' + ICON.send + '</button>') +
      '</form>' +
      '<div class="cd-picks">' +
        (S.project && !S.project.turn && S.branches && S.branches.length && !S.running
          ? '<label class="cd-pick cd-pick-branch" title="Starting branch (picked before the first message)">' + ICON.branch + '<select id="cdBaseSel" aria-label="Starting branch">' + S.branches.map((b) => '<option value="' + esc(b) + '"' + (b === S.project.base ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></label>'
          : '') +
        (S.project && !S.project.turn && !S.running && S.allRepos && S.allRepos.length > 1 && (S.project.repos || []).length < 3
          ? '<label class="cd-pick cd-pick-repo" title="Add another repository to this chat (before the first message)">' + ICON.gh + '<select id="cdAddRepo" aria-label="Add a repository"><option value="">+ Repository</option>' + S.allRepos.filter((r) => r !== S.project.repo && !(S.project.repos || []).some((x) => x.repo === r)).map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('') + '</select></label>'
          : '') +
        (S.project && (S.project.repos || []).length
          ? S.project.repos.map((x) => '<span class="cd-repo-chip" title="Also in this chat, on its branch">' + esc(x.repo) + (!S.project.turn && !S.running ? '<button type="button" data-unrepo="' + esc(x.repo) + '" aria-label="Take ' + esc(x.repo) + ' out of this chat">×</button>' : '') + '</span>').join('')
          : '') +
        (S.project && !S.project.turn && S.envInfo && !S.running
          ? '<label class="cd-pick cd-pick-env" title="Environment (picked before the first message)">' + ICON.cloud + '<select id="cdEnvSel" aria-label="Environment">' + S.envInfo.environments.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === S.envInfo.envId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '<option value="__add">+ Add environment…</option></select></label>'
          : '') +
        '<label class="cd-pick" title="Model"><select id="cdModel" aria-label="Model">' + MODELS.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === m.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
        '<label class="cd-pick" title="Effort"><select id="cdEffort" aria-label="Effort">' + m.efforts.map((e) => '<option value="' + e + '"' + (e === S.pick.effort ? ' selected' : '') + '>' + (EFFORT_NAME[e] || e) + '</option>').join('') + '</select></label>' +
      '</div>' +
    '</div>';
  }

  function centerHTML(inner) { return '<div class="cd-center">' + inner + '</div>'; }

  function bodyHTML() {
    if (S.phase === 'loading') return centerHTML('<span class="cd-spin cd-spin-lg"></span>');
    if (S.phase === 'off') return centerHTML('<b class="cd-title">' + (GLOOPY ? 'Gloopy is not switched on yet.' : 'Coder is not switched on yet.') + '</b>');
    if (S.phase === 'error') return centerHTML('<b class="cd-title">' + esc(S.error) + '</b><button type="button" class="cd-btn-2" id="cdRetry">Try again</button>');
    if (S.phase === 'connect') return centerHTML(
      '<div class="cd-mark">' + ICON.gh.replace('width="16" height="16"', 'width="40" height="40"') + '</div>' +
      '<b class="cd-title">Connect your GitHub</b>' +
      '<p class="cd-sub">Coder works on your code in your own GitHub. You choose which repositories it can use, and it saves its work to its own branch. Ask it for a pull request when you are ready.</p>' +
      '<button type="button" class="cd-btn" id="cdConnect">' + ICON.gh + ' Connect GitHub</button>' +
      (S.error ? '<p class="cd-errline">' + esc(S.error) + '</p>' : ''));
    if (S.phase === 'pick') {
      const install = S.github && S.github.install;
      const repoBtn = (r) => '<button type="button" class="cd-repo" data-repo="' + esc(r.repo) + '">' + ICON.gh + '<span>' + esc(r.repo) + '</span>' + (r.readOnly ? '<em title="You can read it but not push to it">read-only</em>' : '') + (r.private ? '<em>private</em>' : '') + '</button>';
      // ON THE REPOSITORIES SCREEN: each repository you can push to has its Code review setting (owner item 11).
      const RUNS = [['off', 'Off'], ['push', 'After every push'], ['open', 'Once after PR creation'], ['manual', 'Manual (@coder review)']];
      const LEVELS = [['quick', 'Quick'], ['standard', 'Standard'], ['deep', 'Deep']];
      const opts = (list, cur) => list.map(([v, l]) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + l + '</option>').join('');
      const reviewRow = (r) => {
        const cur = (S.reviews || {})[r.repo] || null;
        return '<div class="cd-repo-row">' + repoBtn(r) + (r.readOnly ? '' : '<div class="cd-review"><label>Code review <select data-review-runs="' + esc(r.repo) + '">' + opts(RUNS, cur ? cur.runs : 'off') + '</select></label>' +
          (cur ? '<select data-review-level="' + esc(r.repo) + '" aria-label="Review level for ' + esc(r.repo) + '">' + opts(LEVELS, cur.level || 'standard') + '</select>' : '') + '</div>') + '</div>';
      };
      const list = S.repos === null ? '<span class="cd-spin cd-spin-lg"></span>'
        : S.repos.length ? '<div class="cd-repos">' + S.repos.map((r) => (S.pickMode === 'repos' ? reviewRow(r) : repoBtn(r))).join('') + '</div>'
        : '<p class="cd-sub">Coder can’t see any repositories yet.</p>';
      // ANY PUBLIC REPOSITORY (owner item 5, like Claude Code: "a session can clone any public repository").
      const open = '<form class="cd-open" id="cdOpenForm"><label for="cdOpenRepo">Or open any public repository</label>' +
        '<div class="cd-open-row"><input id="cdOpenRepo" placeholder="owner/name or its GitHub address" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200"><button type="submit" class="cd-btn-2">Open</button></div>' +
        '<p class="cd-open-note">One you can’t push to is read-only: Coder keeps its work on its machine, and you download it as a patch.</p></form>';
      return centerHTML('<b class="cd-title">' + (S.pickMode === 'repos' ? 'Your repositories' : 'New chat: pick a repository') + '</b>' +
        '<p class="cd-sub">Signed in as <b>' + esc(S.github && S.github.login) + '</b>. Coder will work on its own branch and never touch your main branch.</p>' +
        (S.pickMode === 'repos' ? '<p class="cd-sub cd-review-note">Turn on <b>Code review</b> for a repository and Coder reviews its pull requests, posting what it finds on them. It never approves or blocks one. Anyone with write access can also comment <code>@coder review</code>.</p>' : '') +
        list + open +
        (install ? '<a class="cd-btn-2" href="' + esc(install) + '" target="_blank" rel="noopener">Add repositories on GitHub</a>' : '') +
        (S.error ? '<p class="cd-errline">' + esc(S.error) + '</p>' : ''));
    }
    // chat
    const empty = !S.events.length && !S.running;
    return headHTML() +
      '<div class="cd-log" id="cdLog">' +
        (empty && GLOOPY ? gloopyEmptyHTML() : '') +
        (empty && !GLOOPY ? '<div class="cd-empty"><b>What should we work on in ' + esc(S.project ? S.project.repo : '') + '?</b><p>Coder reads the code, runs commands in its own Linux machine, and saves its work to its own branch. Ask it for a pull request when you’re ready.</p>' +
          '<div class="cd-starts">' + ['Explain how this project is laid out', 'Run the tests and fix what fails', 'Add a README with setup steps'].map((s) => '<button type="button" class="cd-start" data-answer="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div></div>' : '') +
        '<div class="cd-thread">' + stepsHTML() + '</div>' +
      '</div>' +
      (S.error ? '<div class="cd-errbar">' + esc(S.error) + '</div>' : '') +
      composerHTML();
  }

  function draw(scroll) {
    const root = S.root;
    if (!root || !root.isConnected) return;
    const log = root.querySelector('#cdLog');
    const atBottom = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    const focus = document.activeElement && document.activeElement.id === 'cdIn';
    const webFocus = document.activeElement && ['cdWebScreen', 'cdWebType', 'cdWebCmd'].includes(document.activeElement.id) ? document.activeElement.id : '';
    root.innerHTML = '<div class="cd">' + (S.phase === 'chat' ? '' : '<div class="cd-head cd-head-min"><button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button></div>') + bodyHTML() + '</div>';
    drawSide();
    wire(root);
    if (GLOOPY && S.project) markGloopy(!S.running && gloopyWaits(S.project));
    const nlog = root.querySelector('#cdLog');
    if (nlog && (scroll || atBottom)) nlog.scrollTop = nlog.scrollHeight;
    if (focus) { const i = root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    if (webFocus) { const f = root.querySelector('#' + webFocus); if (f) f.focus(); }
    const term = root.querySelector('#cdWebTerm');
    if (term) term.scrollTop = term.scrollHeight;
    if (GLOOPY) setTimeout(hoSync, 0);
  }
  // THE HAND-OFF CARD'S LIVE SCREEN (2026-11-12): while a hand-off waits for you, the live view's pictures come for the
  // card alone (no panel); once it is answered (or you open the view), that stops.
  function hoSync() {
    const p = S.project && !S.running && S.project.pending && S.project.pending.kind === 'handoff' ? S.project.pending : null;
    const w = S.web;
    if (p && S.webOK && !w) webOpen(false, true);
    // THE BIG VIEW MAKES WAY FOR THE CARD (owner, 2026-11-12: "yes do both"; found live: open when Gloopy handed a step
    // over, on a short window it covered the card's Skip and I'm done, and on a phone it hides the chat): it closes once
    // for each hand-off, and the card goes on showing the browser live, scrolled into view. Opened again, it stays; never
    // while you have control or are marking a part. Once the step is answered, the view you had open comes back.
    else if (p && w && !w.card && !w.control && !w.marking && !w.sel && S.hoMadeWay !== String(p.id || p.task || '')) { S.hoMadeWay = String(p.id || p.task || ''); w.card = true; w.madeWay = true; w.touched = Date.now(); draw(true); webWake(); }
    else if (!p && w && w.card) { if (w.madeWay) { w.card = false; w.madeWay = false; w.touched = Date.now(); draw(); } else webClose(); }
  }

  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }

  function wire(root) {
    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
    on('#cdRetry', 'click', load);
    on('#cdConnect', 'click', connect);
    on('.cd-repo', 'click', (e) => addProject(e.currentTarget.dataset.repo));
    on('#cdOpenForm', 'submit', (e) => {
      e.preventDefault();
      const repo = repoName(root.querySelector('#cdOpenRepo').value);
      if (!repo) { S.error = 'Write it as owner/name, or paste its GitHub address.'; return draw(); }
      S.error = ''; addProject(repo);
    });
    on('#cdPatch', 'click', downloadPatch);
    on('[data-review-runs]', 'change', (e) => saveReview(e.currentTarget.dataset.reviewRuns, { runs: e.currentTarget.value }));
    on('[data-review-level]', 'change', (e) => saveReview(e.currentTarget.dataset.reviewLevel, { level: e.currentTarget.value }));
    on('#cdMenu', 'click', () => window.dispatchEvent(new CustomEvent('gf:side', { detail: true })));
    on('.cd-cmd-row', 'click', (e) => { const k = e.currentTarget.dataset.step; S.open[k] = !S.open[k]; draw(); });
    // THE QUESTION CARD: the choices live in S.ask; Submit sends them as your answer (askReply).
    const askSend = () => { const t = askReply(S.ask); if (!t) return; S.ask = null; send(t); };
    const askOf = (el) => { const one = el.closest('.cd-ask-one'); return S.ask && one ? S.ask.answers[Number(one.dataset.q)] : null; };
    on('.cd-ask.is-live input[type="radio"], .cd-ask.is-live input[type="checkbox"]', 'change', (e) => {
      const a = askOf(e.currentTarget);
      if (!a) return;
      const one = e.currentTarget.closest('.cd-ask-one');
      a.picked = [...one.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked')].map((x) => x.value);
      if (e.currentTarget.value === '__other' && e.currentTarget.checked) { const t = one.querySelector('.cd-ask-in'); if (t) t.focus(); }
    });
    on('.cd-ask-in', 'input', (e) => { const a = askOf(e.currentTarget); if (a) a.other = e.currentTarget.value; });
    on('.cd-ask-in', 'focus', (e) => {
      // Typing your own answer chooses Other.
      const r = e.currentTarget.closest('.cd-ask-row').querySelector('input[value="__other"]');
      if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change')); }
    });
    on('.cd-ask-in', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); askSend(); } });
    on('.cd-ask.is-live', 'keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); askSend(); } });
    on('[data-ask-go]', 'click', () => askSend());
    on('[data-ask-skip]', 'click', () => { const many = S.ask && S.ask.qs && S.ask.qs.length > 1; S.ask = null; send(many ? 'I skipped your questions. Decide for yourself and go on.' : 'I skipped your question. Decide for yourself and go on.'); });
    on('[data-envchange-no]', 'click', (e) => { const x = S.events[Number(e.currentTarget.dataset.envchangeNo)]; S.envChangeMsg = ''; send(x && x.kind === 'allow_host' ? 'I declined allowing ' + x.host + '.' : x && x.kind === 'new_environment' ? 'I declined the new environment.' : 'I declined the new setup script.'); });
    on('[data-envchange-ok]', 'click', async (e) => {
      const x = S.events[Number(e.currentTarget.dataset.envchangeOk)];
      if (!x || !S.project) return;
      e.currentTarget.disabled = true;
      if (x.kind === 'new_environment') {
        const r = await call('/environments', { method: 'POST', body: JSON.stringify({ name: x.name, script: x.script, network: { mode: x.network || 'trusted' }, repos: [S.project.repo] }) });
        if (r.status !== 200 || !r.data || !r.data.environment) { S.envChangeMsg = (r.data && r.data.error) || 'It could not be made.'; return draw(); }
        S.envChangeMsg = '';
        return send('I created the environment "' + r.data.environment.name + '".');
      }
      const body = x.kind === 'allow_host' ? { network: { add: [x.host] } } : { script: x.script };
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/env', { method: 'POST', body: JSON.stringify(body) });
      if (r.status !== 200) { S.envChangeMsg = (r.data && r.data.error) || 'It could not be saved.'; return draw(); }
      S.envChangeMsg = ''; if (S.env) S.env = r.data;
      send(x.kind === 'allow_host' ? 'I allowed ' + x.host + '.' : 'I approved the new setup script.');
    });
    // GLOOPY'S CARDS (2026-11-09): the answer goes to the Worker, then a short message starts Gloopy's next turn.
    const cardPath = (a) => '/projects/' + encodeURIComponent(S.project.id) + '/' + a;
    const cardAnswer = async (id, a, body, failed) => {
      const r = await call(cardPath(a), { method: 'POST', body: JSON.stringify({ id, ...body }) });
      // A card whose time was up (the audit, 2026-11-10): the chat is shown again, with the card marked expired.
      if (r.status === 409 && r.data && r.data.expired) { if (r.data.project) S.project = r.data.project; return reloadChat(S.project.id); }
      if (r.status !== 200) { S.cardMsg = { id, text: (r.data && r.data.error) || failed }; draw(); return; }
      S.cardMsg = null; if (r.data && r.data.project) S.project = r.data.project;
      if (r.data && Array.isArray(r.data.cards)) S.cards = r.data.cards;
      send((r.data && r.data.said) || 'Answered.', { card: true });
    };
    on('[data-approve]', 'click', (e) => {
      const d = e.currentTarget.dataset;
      if (!S.project) return;
      root.querySelectorAll('[data-approve]').forEach((b) => { b.disabled = true; });
      cardAnswer(d.card, 'approve', { decision: d.approve }, 'Your answer could not be sent.');
    });
    on('#cdSignPass', 'input', (e) => { const b = root.querySelector('[data-signin]'); if (b) b.disabled = !e.currentTarget.value; });
    // ALWAYS ALLOW NEXT TIME, on a card that expired (the docs, 2026-11-10): an allow rule for steps like it.
    on('[data-allow-next]', 'click', async (e) => {
      const b = e.currentTarget, id = b.dataset.allowNext;
      if (!S.project) return;
      b.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/rules', { method: 'POST', body: JSON.stringify({ add: { text: b.dataset.step, mode: 'allow' } }) });
      if (r.status !== 200) { b.disabled = false; S.cardMsg = { id, text: (r.data && r.data.error) || 'The rule could not be saved.' }; return draw(); }
      S.ruleSaved = id;
      // Another card that was open closes with a change to the rules (Grok Bot's); the chat shows it.
      if (r.data && r.data.closed) return reloadChat(S.project.id);
      draw();
    });
    // THE SIGN-IN CARD'S OTHER WAYS (the audit, 2026-11-10): the login you saved, a code (emptied from its box as it is
    // sent, never kept here), or doing it yourself in Gloopy's browser (handing it back answers the card).
    // YOUR SECURITY KEY ON ITS CARD (2026-11-11): signed in the Go Farther app (the card's own request, for its own site),
    // then sent; or "not now".
    on('[data-key-use]', 'click', async (e) => {
      const id = e.currentTarget.dataset.keyUse;
      const ev = S.events.find((x) => x.type === 'key' && x.id === id);
      if (!ev || !S.project || !DESKTOP_KEY) return;
      e.currentTarget.disabled = true;
      S.cardMsg = { id, text: 'Touch your security key…' }; draw();
      let r;
      try { r = await DESKTOP_KEY.get({ origin: ev.origin, request: ev.request }); } catch (err) { r = { message: String((err && err.message) || err) }; }
      if (!r || !r.credential) { S.cardMsg = { id, text: keyWords(r, ev.request) }; return draw(); }
      S.cardMsg = null;
      cardAnswer(id, 'key', { credential: r.credential }, 'Your key’s answer could not be sent.');
    });
    on('[data-key-skip]', 'click', (e) => { const id = e.currentTarget.dataset.keySkip; if (!S.project) return; e.currentTarget.disabled = true; cardAnswer(id, 'key', { skip: true }, 'Your answer could not be sent.'); });
    on('[data-signin-saved]', 'click', (e) => { const id = e.currentTarget.dataset.signinSaved, login = e.currentTarget.dataset.login || ''; if (!S.project) return; e.currentTarget.disabled = true; cardAnswer(id, 'signin', { useSaved: true, ...(login ? { login } : {}) }, 'Your saved login could not be used.'); });
    // THE EYE (Grok Bot's Secure Form): shows what you typed, and hides it again.
    on('[data-eye]', 'click', (e) => {
      const b = e.currentTarget, f = root.querySelector('#' + b.dataset.eye);
      if (!f) return;
      const show = b.getAttribute('aria-pressed') !== 'true';
      if (MASKS) f.classList.toggle('is-masked', !show); else f.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', show ? 'true' : 'false'); b.setAttribute('aria-label', show ? 'Hide what you typed' : 'Show what you typed');
      f.focus();
    });
    on('#cdSignCode', 'input', (e) => { const b = root.querySelector('[data-signin-code]'); if (b) b.disabled = !e.currentTarget.value.trim(); });
    on('#cdSignCode', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = root.querySelector('[data-signin-code]'); if (b && !b.disabled) b.click(); } });
    on('[data-signin-code]', 'click', (e) => {
      const id = e.currentTarget.dataset.signinCode, box = root.querySelector('#cdSignCode');
      const code = box ? box.value.trim() : '';
      if (!code || !S.project) return;
      e.currentTarget.disabled = true;
      if (box) box.value = '';
      cardAnswer(id, 'signin', { code }, 'The code could not be sent.');
    });
    on('[data-signin-take]', 'click', (e) => { S.signTake = e.currentTarget.dataset.signinTake; if (S.web) webTake(); else webOpen(true); });
    // THE SCHEDULES CARD'S BUTTONS (the audit, 2026-11-10): each answer brings the schedules as they are now; Run now starts
    // a test run, which the chat then shows as it goes.
    const schedCall = async (body, btn) => {
      if (!S.project) return;
      if (btn) btn.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/schedules', { method: 'POST', body: JSON.stringify(body) });
      if (r.status !== 200 || !r.data) { S.schedMsg = (r.data && r.data.error) || 'That could not be done.'; return draw(); }
      S.schedMsg = ''; S.sched = { items: r.data.schedules || [], paused: !!r.data.paused, log: r.data.log || [] };
      if (r.data.started && r.data.project) { S.project = r.data.project; S.running = true; syncEntry(); S.next = 0; startPoll(); return draw(true); }
      draw();
    };
    on('[data-sched-run]', 'click', (e) => schedCall({ run: e.currentTarget.dataset.schedRun }, e.currentTarget));
    // THE SIGN-INS CARD'S BUTTONS (the audit, 2026-11-10): each answer brings the list as it is now.
    const signinsCall = async (path, body, btn) => {
      if (!S.project) return;
      if (btn) btn.disabled = true;
      const base = '/projects/' + encodeURIComponent(S.project.id);
      const r = await call(base + path, { method: 'POST', body: JSON.stringify(body) });
      if (r.status !== 200) { S.signinsMsg = (r.data && r.data.error) || 'That could not be done.'; return draw(); }
      if (r.data && r.data.project) S.project = r.data.project;
      if (r.data && Array.isArray(r.data.logins)) S.logins = r.data.logins;
      const l = await call(base + '/signins');
      S.signinsMsg = ''; S.signins = l.status === 200 && l.data ? { sites: l.data.sites || [], saved: l.data.saved || [] } : S.signins;
      draw();
    };
    on('[data-signout]', 'click', (e) => signinsCall('/signout', { site: e.currentTarget.dataset.signout }, e.currentTarget));
    on('[data-login-forget]', 'click', (e) => signinsCall('/logins', { remove: e.currentTarget.dataset.loginForget }, e.currentTarget));
    // A PREVIEW (the audit, 2026-11-10): its signed address, asked for with the owner's sign-in.
    on('[data-file-view]', 'click', async (e) => {
      const b = e.currentTarget, id = b.dataset.fileView, name = b.dataset.fileName || 'file';
      if (!S.project) return;
      b.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/files/' + encodeURIComponent(id) + '/view');
      b.disabled = false;
      if (r.status !== 200 || !r.data || !r.data.url) { note((r.data && r.data.error) || 'That file could not be shown.'); return; }
      S.view = { id, name, url: r.data.url, type: r.data.type || '' };
      draw();
    });
    on('#cdViewClose', 'click', () => { S.view = null; draw(); });
    on('#cdGset', 'click', () => { showGloopySettings(); });
    on('[data-web-lane]', 'click', (e) => { const w = S.web; if (!w || w.control) return; const k = Number(e.currentTarget.dataset.webLane) || 0; if ((w.lane || 0) === k) return; w.lane = k; w.hash = ''; w.shot = ''; w.marking = false; w.touched = Date.now(); w.paused = false; if (S.webAbort) S.webAbort.abort(); draw(); webTick(); });
    on('#cdView', 'click', (e) => { if (e.target === e.currentTarget) { S.view = null; draw(); } });
    on('[data-sched-pause]', 'click', (e) => schedCall({ pause: e.currentTarget.dataset.schedPause }, e.currentTarget));
    on('[data-resume]', 'click', (e) => { e.currentTarget.disabled = true; send('Carry on with what you were doing when I stopped you.'); });
    // EDIT, in the owner's own words (Grok Bot's Edit starts "Edit your routine:" in the box); DELETE, once they say so.
    on('[data-sched-edit]', 'click', (e) => {
      S.draft = 'Edit your schedule “' + e.currentTarget.dataset.schedEdit + '”: '; draw();
      const i = S.root && S.root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(S.draft.length, S.draft.length); }
    });
    on('[data-sched-remove]', 'click', async (e) => {
      const b = e.currentTarget;
      if (!(await askSure('Delete this schedule?', '“' + b.dataset.name + '” won’t run again.', 'Delete'))) return;
      schedCall({ remove: b.dataset.schedRemove }, b);
    });
    on('[data-sched-resume]', 'click', (e) => schedCall({ resume: e.currentTarget.dataset.schedResume }, e.currentTarget));
    on('[data-sched-all]', 'click', (e) => schedCall({ paused: e.currentTarget.dataset.schedAll === 'pause' }, e.currentTarget));
    on('#cdSignPass', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = root.querySelector('[data-signin]'); if (b && !b.disabled) b.click(); } });
    on('[data-signin]', 'click', (e) => {
      const id = e.currentTarget.dataset.signin, user = root.querySelector('#cdSignUser'), pass = root.querySelector('#cdSignPass');
      const password = pass ? pass.value : '';
      if (!password || !S.project) return;
      e.currentTarget.disabled = true;
      // The password leaves the box as it is sent: it is never kept in this page's state.
      if (pass) pass.value = '';
      const keep = root.querySelector('#cdSignSave');
      cardAnswer(id, 'signin', { username: user ? user.value : '', password, save: !!(keep && keep.checked) }, 'The sign-in could not be sent.');
    });
    on('[data-signin-skip]', 'click', (e) => {
      if (!S.project) return;
      e.currentTarget.disabled = true;
      cardAnswer(e.currentTarget.dataset.signinSkip, 'signin', { skip: true }, 'Your answer could not be sent.');
    });
    // THE CARD FORM (2026-11-09): a saved card (only its security code typed) or another card; every box is emptied as it
    // is sent, so nothing of it stays in this page.
    on('[name="cdPayUse"]', 'change', (e) => { S.payUse = { id: e.currentTarget.dataset.payFor, use: e.currentTarget.value }; draw(); });
    on('[data-pay]', 'click', (e) => {
      const id = e.currentTarget.dataset.pay;
      if (!S.project) return;
      const take = (sel) => { const b = root.querySelector(sel); const v = b ? b.value : ''; if (b) b.value = ''; return v; };
      const pick = root.querySelector('[name="cdPayUse"]:checked');
      const use = pick ? pick.value : '';
      const keep = root.querySelector('#cdPaySave');
      const body = use ? { use, cvc: take('#cdPayCvc') } : { number: take('#cdPayNumber'), expiry: take('#cdPayExp'), cvc: take('#cdPayCvc'), name: take('#cdPayName'), postal: take('#cdPayPostal'), save: !!(keep && keep.checked) };
      e.currentTarget.disabled = true;
      cardAnswer(id, 'card', body, 'Your card could not be sent.');
    });
    on('[data-pay-skip]', 'click', (e) => {
      if (!S.project) return;
      e.currentTarget.disabled = true;
      cardAnswer(e.currentTarget.dataset.paySkip, 'card', { skip: true }, 'Your answer could not be sent.');
    });
    // A WEBHOOK'S KEY, shown on its card when the owner asks (2026-11-09).
    on('[data-hook-key]', 'click', async (e) => {
      const id = e.currentTarget.dataset.hookKey;
      if (!S.project) return;
      e.currentTarget.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/webhooks', { method: 'POST', body: JSON.stringify({ reveal: id }) });
      if (r.status !== 200 || !r.data || !r.data.key) { S.cardMsg = { id, text: (r.data && r.data.error) || 'The key could not be shown.' }; return draw(); }
      S.cardMsg = null; S.hookKey = { id, key: r.data.key }; draw();
    });
    on('[data-handoff-open]', 'click', () => { if (S.web) { S.web.card = false; webTake(); } else webOpen(true); });
    on('[data-handoff-done]', 'click', (e) => {
      if (!S.project) return;
      e.currentTarget.disabled = true;
      cardAnswer(e.currentTarget.dataset.handoffDone, 'handoff', { done: true }, 'Your answer could not be sent.');
    });
    on('[data-ho-resume]', 'click', () => { if (S.web) { S.web.paused = false; S.web.touched = Date.now(); webTick(); draw(); } });
    on('[data-page-open]', 'click', (e) => openPage(e.currentTarget.dataset.pageOpen));
    on('[data-handoff-skip]', 'click', (e) => {
      if (!S.project) return;
      e.currentTarget.disabled = true;
      cardAnswer(e.currentTarget.dataset.handoffSkip, 'handoff', { skip: true }, 'Your answer could not be sent.');
    });
    // GLOOPY'S BROWSER, LIVE: open or close the view; take over and hand back; your clicks, typing, keys and scrolling.
    on('#cdWeb', 'click', () => (S.web && S.web.card ? (S.web.card = false, S.web.touched = Date.now(), draw()) : S.web ? webClose() : webOpen(false)));
    on('#cdWebClose', 'click', webClose);
    // GLOOPY'S TABS AND TERMINAL (2026-11-12). A tab: while you have control, the browser goes to it; otherwise only the
    // page is shown again (Gloopy's tab is Gloopy's to choose while it works).
    on('[data-web-tab]', 'click', (e) => {
      const w = S.web; if (!w) return;
      const id = Number(e.currentTarget.dataset.webTab);
      const was = S.webTerm; S.webTerm = false;
      const t = (w.tabs || []).find((x) => x.id === id);
      if (w.control && id && t && !t.on) { webInput({ kind: 'tab', id }); return draw(); }
      if (!w.control && id && t && !t.on && !was) { const b = webShape(); w.msg = 'Take over to switch Gloopy’s tabs.'; return webPaint(b); }
      draw();
    });
    on('[data-web-tabx]', 'click', (e) => { const w = S.web; if (w && w.control) { S.webTerm = false; webInput({ kind: 'closetab', id: Number(e.currentTarget.dataset.webTabx) }); } });
    on('#cdWebNewTab', 'click', () => { const w = S.web; if (w && w.control) { S.webTerm = false; webInput({ kind: 'newtab' }); draw(); } });
    on('#cdWebTermTab', 'click', () => { S.webTerm = !S.webTerm; if (S.web) S.web.marking = false; draw(); });
    const runCmd = async () => {
      const box = S.root.querySelector('#cdWebCmd');
      const command = box ? box.value.trim() : '';
      if (!command || S.webRunning || !S.web || !S.web.control) return;
      const ran = { command, done: false };
      S.webRan = [...(S.webRan || []), ran].slice(-30); S.webCmd = ''; S.webRunning = true; draw();
      const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ command }) });
      S.webRunning = false;
      Object.assign(ran, r.status === 200 && r.data ? { done: true, code: r.data.code, output: String(r.data.output || ''), timedOut: r.data.timedOut === true } : { done: true, code: 1, output: (r.data && r.data.error) || 'Gloopy’s computer could not be reached.' });
      if (r.status === 409 && S.web) S.web.control = false;
      draw();
    };
    on('#cdWebRun', 'click', runCmd);
    on('#cdWebCmd', 'input', (e) => { S.webCmd = e.currentTarget.value; });
    on('#cdWebCmd', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runCmd(); } });
    on('#cdWebResume', 'click', () => { if (S.web) { S.web.paused = false; S.web.touched = Date.now(); webTick(); draw(); } });
    on('#cdWebTake', 'click', webTake);
    on('#cdWebGive', 'click', webGive);
    on('#cdWebImg', 'click', (e) => {
      const w = S.web, img = e.currentTarget;
      if (!w || !w.control || w.marking || !img.naturalWidth) return;
      const r = img.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * img.naturalWidth), y = Math.floor(((e.clientY - r.top) / r.height) * img.naturalHeight);
      const sc = root.querySelector('#cdWebScreen'); if (sc) sc.focus();
      webInput({ kind: 'click', x, y });
    });
    on('#cdWebScreen', 'keydown', webKey);
    on('#cdWebScreen', 'wheel', (e) => {
      if (!S.web || !S.web.control) return;
      e.preventDefault();
      S.webWheel = (S.webWheel || 0) + e.deltaY;
      if (S.webWheelTimer) return;
      S.webWheelTimer = setTimeout(() => { const dy = Math.round(S.webWheel); S.webWheel = 0; S.webWheelTimer = 0; if (dy) webInput({ kind: 'scroll', dy }); }, 200);
    });
    const webTypeBox = () => { const box = root.querySelector('#cdWebType'); const t = box ? box.value : ''; if (!t) return; box.value = ''; S.webBox = ''; webInput({ kind: 'type', text: t.slice(0, 1000) }); };
    on('#cdWebType', 'input', (e) => { S.webBox = e.currentTarget.value; });
    on('#cdWebSend', 'click', webTypeBox);
    on('#cdWebType', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); webTypeBox(); } });
    on('[data-web-key]', 'click', (e) => webInput({ kind: 'key', key: e.currentTarget.dataset.webKey }));
    on('[data-web-scroll]', 'click', (e) => webInput({ kind: 'scroll', dy: Number(e.currentTarget.dataset.webScroll) }));
    on('#cdWebBack', 'click', () => webInput({ kind: 'back' }));
    // MARKING: drag over the picture (mouse or finger), then your note.
    on('#cdWebMarkOn', 'click', () => { if (S.web) { S.web.marking = true; S.web.sel = null; S.web.touched = Date.now(); draw(); } });
    on('#cdWebMarkOff', 'click', () => { if (S.web) { S.web.marking = false; S.web.sel = null; S.webNote = ''; draw(); } });
    const imgPoint = (e, img) => { const r = img.getBoundingClientRect(), W = (S.web && S.web.w) || 1280, H = (S.web && S.web.h) || 800; return { x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)), y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)) }; };
    on('#cdWebImg', 'pointerdown', (e) => {
      const w = S.web;
      if (!w || !w.marking) return;
      e.preventDefault();
      const img = e.currentTarget, a = imgPoint(e, img);
      try { img.setPointerCapture(e.pointerId); } catch (x) { /* an old browser */ }
      w.sel = { x: Math.round(a.x), y: Math.round(a.y), w: 0, h: 0 };
      const sel = root.querySelector('#cdWebSel');
      const move = (ev) => { const b = imgPoint(ev, img); w.sel = { x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)), w: Math.round(Math.abs(b.x - a.x)), h: Math.round(Math.abs(b.y - a.y)) }; if (sel) { const st = webSelStyle(w); sel.hidden = st === ' hidden'; if (st !== ' hidden') sel.setAttribute('style', st.replace(/^ style="|"$/g, '')); } };
      const up = (ev) => { img.removeEventListener('pointermove', move); img.removeEventListener('pointerup', up); move(ev); if (!w.sel || w.sel.w < 6 || w.sel.h < 6) w.sel = null; draw(); const box = root.querySelector('#cdWebNote'); if (box) box.focus(); };
      img.addEventListener('pointermove', move); img.addEventListener('pointerup', up);
    });
    on('#cdWebNote', 'input', (e) => { S.webNote = e.currentTarget.value; });
    const webNoteSend = async () => {
      const w = S.web, box = root.querySelector('#cdWebNote'), note = box ? box.value.trim() : '';
      if (!w || !w.sel) return;
      if (!note) { w.msg = 'Say what about this part.'; return draw(); }
      w.msg = '';
      const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ area: w.sel }) });
      if (S.web !== w) return;
      if (r.status !== 200 || !r.data || r.data.error) { w.msg = (r.data && r.data.error) || 'That part could not be read.'; return draw(); }
      w.marking = false; w.sel = null; S.webNote = '';
      draw();
      send(note, { marked: { title: r.data.title, url: r.data.url, text: r.data.text, items: r.data.items, box: r.data.box } });
    };
    on('#cdWebNoteSend', 'click', webNoteSend);
    on('#cdWebNote', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); webNoteSend(); } });
    // TEACHING: on, off (the steps come back), then a name and Send.
    const webTeach = async (on) => {
      const w = S.web;
      if (!w || !w.control) return;
      const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ teach: on }) });
      if (S.web !== w) return;
      if (r.status !== 200 || !r.data || r.data.error) { w.msg = (r.data && r.data.error) || 'Teaching could not ' + (on ? 'start.' : 'stop.'); return draw(); }
      w.msg = '';
      if (on) w.teaching = { steps: 0, full: false };
      else { w.teaching = null; w.taught = Array.isArray(r.data.steps) && r.data.steps.some((x) => !/^On https?:/.test(x)) ? { steps: r.data.steps, start: r.data.start || null, full: r.data.full === true } : null; if (!w.taught) w.msg = 'Nothing was written down: do the task while teaching.'; }
      draw();
    };
    on('#cdWebTeachOn', 'click', () => webTeach(true));
    on('#cdWebTeachOff', 'click', () => webTeach(false));
    on('#cdWebTaskName', 'input', (e) => { S.webTask = e.currentTarget.value; });
    const webTaskSend = () => {
      const w = S.web, box = root.querySelector('#cdWebTaskName'), name = box ? box.value.trim() : '';
      if (!w || !w.taught) return;
      if (!name) { w.msg = 'Give the task a name.'; return draw(); }
      const t = w.taught;
      w.taught = null; S.webTask = '';
      send('Learn this task: ' + name, { taught: { name, steps: t.steps, start: t.start, full: t.full } });
    };
    on('#cdWebTaskSend', 'click', webTaskSend);
    on('#cdWebTaskName', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); webTaskSend(); } });
    on('#cdWebTaskDrop', 'click', () => { if (S.web) { S.web.taught = null; S.webTask = ''; draw(); } });
    on('#cdWebFwd', 'click', () => webInput({ kind: 'forward' }));
    on('#cdWebReload', 'click', () => webInput({ kind: 'reload' }));
    const webGo = () => { const box = root.querySelector('#cdWebUrl'); const u = box ? box.value.trim() : ''; if (!u) return; box.value = ''; S.webUrl = ''; webInput({ kind: 'open', url: u.slice(0, 4000) }); };
    on('#cdWebUrl', 'input', (e) => { S.webUrl = e.currentTarget.value; });
    on('#cdWebUrl', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); webGo(); } });
    on('#cdWebGo', 'click', webGo);
    // YOUR SECURITY KEY, while you have control (2026-11-11): the Go Farther app has your key sign the page's request.
    on('#cdWebKeyUse', 'click', async (e) => {
      const w = S.web;
      if (!w || !w.key || !DESKTOP_KEY) return;
      e.currentTarget.disabled = true;
      w.msg = 'Touch your security key…'; draw();
      let r;
      try { r = await DESKTOP_KEY.get({ origin: w.key.origin, request: w.key.request }); } catch (err) { r = { message: String((err && err.message) || err) }; }
      if (S.web !== w) return;
      if (!r || !r.credential) { w.msg = keyWords(r, w.key.request); return draw(); }
      w.msg = ''; webKeySend({ credential: r.credential });
    });
    on('#cdWebKeyNo', 'click', () => webKeySend({ skip: true }));
    // A file from your device, into the page that asked for it (at most 5 MB, as Gloopy's own uploads).
    on('#cdWebFile', 'change', (e) => {
      const f = e.currentTarget.files && e.currentTarget.files[0];
      if (!f || !S.web) return;
      if (f.size > 5 * 1024 * 1024) { S.web.msg = 'That file is over 5 MB.'; return draw(); }
      const rd = new FileReader();
      rd.onload = () => { const data = String(rd.result || '').replace(/^data:[^,]*,/, ''); webInput({ kind: 'file', name: f.name.slice(0, 120), data }); };
      rd.readAsDataURL(f);
    });
    on('#cdSecretIn', 'input', (e) => { const b = document.querySelector('.cd-secret-save'); if (b) b.disabled = !e.currentTarget.value.trim(); });
    on('.cd-secret-no', 'click', (e) => { S.secretMsg = ''; send('I declined the secret for ' + e.currentTarget.dataset.secretNo + '.'); });
    on('.cd-secret-save', 'click', async (e) => {
      const d = e.currentTarget.dataset; const box = (S.root || document).querySelector('#cdSecretIn'); const value = box ? box.value.trim() : '';
      if (!value || !S.project) return;
      e.currentTarget.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/secret', { method: 'POST', body: JSON.stringify({ host: d.secretHost, value, header: d.secretHeader, prefix: d.secretPrefix, name: d.secretName }) });
      if (box) box.value = '';
      if (r.status !== 200) { S.secretMsg = (r.data && r.data.error) || 'It could not be saved.'; return draw(); }
      S.secretMsg = ''; if (S.env) S.env.secrets = r.data.secrets;
      send((GLOOPY ? 'I saved the key for ' : 'I saved the secret for ') + d.secretHost + '.');
    });
    on('.cd-group-head', 'click', (e) => { const k = e.currentTarget.dataset.group; S.open[k] = !S.open[k]; draw(); });
    on('.cd-start', 'click', (e) => send(e.currentTarget.dataset.answer));
    on('#cdStop', 'click', stop);
    on('.cd-file', 'toggle', (e) => { S.openFiles[e.currentTarget.dataset.path] = e.currentTarget.open; });
    on('.cd-dl', 'click', (e) => { const d = e.currentTarget.dataset; S.commenting = { file: d.file, line: Number(d.line) || 0, idx: Number(d.idx), quote: e.currentTarget.textContent.replace(/^[+ -]/, '').trim() }; draw(); const i = root.querySelector('#cdCommentIn'); if (i) i.focus(); });
    const addComment = () => { const i = root.querySelector('#cdCommentIn'); const v = i && i.value.trim(); if (v && S.commenting) S.comments.push({ ...S.commenting, text: v }); S.commenting = null; draw(); };
    on('#cdCommentAdd', 'click', addComment);
    on('#cdCommentIn', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(); } if (e.key === 'Escape') { S.commenting = null; draw(); } });
    on('#cdCommentX', 'click', () => { S.commenting = null; draw(); });
    on('[data-uncomment]', 'click', (e) => { S.comments.splice(Number(e.currentTarget.dataset.uncomment), 1); draw(); });
    on('[data-rewind]', 'click', (e) => rewind(Number(e.currentTarget.dataset.rewind)));
    on('#cdMakePr', 'click', () => send(PR_ASK));
    on('#cdMakeDraft', 'click', () => send(PR_ASK_DRAFT));
    on('#cdAutofix', 'click', async () => { const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/autofix', { method: 'POST', body: JSON.stringify({ on: S.project.autofix !== true }) }); if (r.status === 200 && r.data) { S.project = r.data.project; draw(); } });
    on('#cdBaseSel', 'change', (e) => pickBase(e.currentTarget.value));
    on('#cdAddRepo', 'change', (e) => { const v = e.currentTarget.value; if (v) changeRepos(v, true); });
    on('[data-unrepo]', 'click', (e) => changeRepos(e.currentTarget.dataset.unrepo, false));
    on('#cdEnvSel', 'change', async (e) => {
      const v = e.currentTarget.value;
      if (v !== '__add') return pickEnv(v);
      const name = await askText('Add environment', 'Name it after what it is for, like a project. It starts on Trusted network access, with no keys and no setup script.', 'Create', S.project ? S.project.repo.split('/').pop() : '');
      if (!name) return draw();
      const r = await call('/environments', { method: 'POST', body: JSON.stringify({ name, repos: [S.project.repo] }) });
      if (r.status !== 200 || !r.data || !r.data.environment) { S.error = (r.data && r.data.error) || 'The environment could not be made.'; return draw(); }
      await pickEnv(r.data.environment.id);
      S.showEnv = true; S.showChanges = false; loadEnv(); draw();
    });
    on('#envArchive', 'click', async () => {
      const e = S.env; if (!e || !e.envId || e.isDefault) return;
      if (!(await askSure('Archive “' + e.name + '”?', 'It leaves the list for new chats. Chats that already use it keep working.', 'Archive'))) return;
      const r = await call('/environments/' + encodeURIComponent(e.envId), { method: 'POST', body: JSON.stringify({ archive: true }) });
      if (r.status !== 200) { S.envMsg = (r.data && r.data.error) || 'It could not be archived.'; return draw(); }
      S.showEnv = false; await loadEnvInfo(); draw();
    });
    on('#envNameIn', 'input', (e) => { if (S.envForm) S.envForm.text = e.currentTarget.value; });
    on('#cdEnv', 'click', () => { S.showEnv = true; S.showChanges = false; loadEnv(); draw(); });
    // THE ENVIRONMENT WINDOW: typing only updates the form (no redraw), buttons move between pages.
    on('#envClose', 'click', () => { S.showEnv = false; draw(); });
    on('#envWrap', 'click', (e) => { if (e.target.id === 'envWrap') { S.showEnv = false; draw(); } });
    on('[data-envgo]', 'click', (e) => envGo(e.currentTarget.dataset.envgo));
    on('#envYes', 'click', () => envYes());
    on('[data-netmode]', 'click', (e) => { S.envForm.mode = e.currentTarget.dataset.netmode; draw(); });
    on('#envHostAdd', 'click', () => { const i = root.querySelector('#envHostIn'); const v = (i.value || '').trim().toLowerCase(); if (v && !S.envForm.hosts.includes(v)) S.envForm.hosts.push(v); draw(); });
    on('#envHostIn', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); root.querySelector('#envHostAdd').click(); } });
    on('[data-nethostdel]', 'click', (e) => { S.envForm.hosts = S.envForm.hosts.filter((h) => h !== e.currentTarget.dataset.nethostdel); draw(); });
    on('[data-secid]', 'click', async (e) => {
      const { secid, secname } = e.currentTarget.dataset;
      if (!(await askSure('Remove “' + secname + '”?', 'Coder\'s commands will no longer get this key.', 'Remove'))) return;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/secret?id=' + encodeURIComponent(secid), { method: 'DELETE' });
      if (r.status === 200) S.env.secrets = r.data.secrets; else S.envMsg = (r.data && r.data.error) || 'It could not be removed.';
      draw();
    });
    on('#secName', 'input', (e) => { S.envForm.name = e.currentTarget.value; });
    on('#secHosts', 'input', (e) => { S.envForm.hosts = e.currentTarget.value; });
    on('#secPaths', 'input', (e) => { S.envForm.paths = e.currentTarget.value; });
    on('#secType', 'change', (e) => { S.envForm.type = e.currentTarget.value; const keep = S.envForm.headers.map((h) => h.value); S.envForm.headers = (SECRET_TYPES[S.envForm.type][2] || [{ name: 'Authorization', prefix: 'Bearer', value: '' }]).map((h, i) => ({ ...h, value: keep[i] || '' })); draw(); });
    on('[data-cfg]', 'input', (e) => { S.envForm.config[e.currentTarget.dataset.cfg] = e.currentTarget.value; });
    on('#envDefaults', 'change', (e) => { S.envForm.defaults = e.currentTarget.checked; });
    on('[data-hdr]', 'input', (e) => { const d = e.currentTarget.dataset; S.envForm.headers[Number(d.hdr)][d.k] = e.currentTarget.value; });
    on('[data-hdr]', 'change', (e) => { const d = e.currentTarget.dataset; S.envForm.headers[Number(d.hdr)][d.k] = e.currentTarget.value; if (d.k !== 'value') draw(); });
    on('[data-hdrdel]', 'click', (e) => { S.envForm.headers.splice(Number(e.currentTarget.dataset.hdrdel), 1); draw(); });
    on('#secHdrAdd', 'click', () => { if (S.envForm.headers.length < 5) S.envForm.headers.push({ name: '', prefix: '', value: '' }); draw(); });
    on('#envScriptIn', 'input', (e) => { S.envForm.text = e.currentTarget.value; });
    on('#envVarsIn', 'input', (e) => { S.envForm.text = e.currentTarget.value; });
    on('#envCopy', 'click', () => { try { navigator.clipboard.writeText(S.envForm.text || ''); } catch { /* not allowed */ } });
    on('#envFile', 'change', (e) => {
      const file = e.currentTarget.files && e.currentTarget.files[0]; if (!file) return;
      if (file.size > 65536) { S.envMsg = 'That file is over 64 KB.'; return draw(); }
      const rd = new FileReader(); rd.onload = () => { S.envForm.text = String(rd.result || ''); draw(); }; rd.readAsText(file);
    });
    on('#cdAttach', 'click', () => { const f = root.querySelector('#cdFile'); if (f) f.click(); });
    on('#cdFile', 'change', (e) => { addPics(e.target.files); e.target.value = ''; });
    on('[data-unpic]', 'click', (e) => { S.pics.splice(Number(e.currentTarget.dataset.unpic), 1); draw(); });
    on('[data-unattach]', 'click', (e) => { S.attach.splice(Number(e.currentTarget.dataset.unattach), 1); draw(); });
    // A FILE TO SAVE (Gloopy's, or one the owner attached): fetched signed in, saved as a data: address (the page's rules block blob: ones).
    on('[data-file-get]', 'click', async (e) => {
      const b = e.currentTarget, id = b.dataset.fileGet, name = b.dataset.fileName || 'file';
      if (!S.project) return;
      b.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/files/' + encodeURIComponent(id), { file: name });
      b.disabled = false;
      if (!r.blob) { note((r.data && r.data.error) || 'That file could not be downloaded.'); return; }
      const href = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result || '')); fr.onerror = () => ok(''); fr.readAsDataURL(r.blob); });
      if (!href) { note('That file could not be saved.'); return; }
      const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    });
    on('.cd-mention-i', 'mousedown', (e) => { e.preventDefault(); pickMention(e.currentTarget.dataset.file); });
    on('#cdChanges', 'click', () => { S.showChanges = !S.showChanges; if (S.showChanges) loadChanges(); draw(); });
    on('#cdCompare', 'change', (e) => { const v = e.currentTarget.value; S.compareAgainst = v === ((S.project && S.project.base) || 'main') ? '' : v; loadChanges(); });
    on('#cdModel', 'change', (e) => { const m = MODELS.find((x) => x.id === e.target.value) || MODELS[0]; S.pick = { model: m.id, effort: m.efforts.includes(S.pick.effort) ? S.pick.effort : m.effort }; savePick(); draw(); });
    on('#cdEffort', 'change', (e) => { S.pick.effort = e.target.value; savePick(); });
    const form = root.querySelector('#cdForm');
    const input = root.querySelector('#cdIn');
    if (input) {
      grow(input);
      input.addEventListener('input', async () => {
        S.draft = input.value; grow(input);
        const before = input.value.slice(0, input.selectionStart);
        const m = GLOOPY ? null : /(^|\s)@([\w./-]*)$/.exec(before);
        const had = mentionMatches().length;
        S.mention = m ? { at: before.length - m[2].length - 1, q: m[2] } : null; S.mentionSel = 0;
        if (S.mention) await loadFiles();
        if (had || mentionMatches().length) { const pos = input.selectionStart; draw(); const i = S.root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
      });
      input.addEventListener('paste', (e) => { const files = [...(e.clipboardData && e.clipboardData.files || [])]; if (files.some((f) => /^image\//.test(f.type)) || (GLOOPY && files.length)) { e.preventDefault(); addPics(files); } });
      input.addEventListener('keydown', (e) => {
        const list = mentionMatches();
        if (list.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); S.mentionSel = ((S.mentionSel || 0) + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length; return draw(); }
        if (list.length && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) { e.preventDefault(); return pickMention(list[Math.min(S.mentionSel || 0, list.length - 1)]); }
        if (list.length && e.key === 'Escape') { S.mention = null; return draw(); }
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
      });
    }
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); send(input && input.value); });
  }

  // ── THE HOOK chat.js CALLS ────────────────────────────────────────────────
  const view = {
    mount(el, side) {
      const first = !S.root;
      S.root = el;
      if (side) S.side = side;
      if (!S.pick) S.pick = { model: MODELS[0].id, effort: MODELS[0].effort };
      if (!S.menuCloser) { S.menuCloser = true; document.addEventListener('click', () => { if (S.reviewMenu) { S.reviewMenu = false; draw(); } }); }
      // Escape closes a file's preview (the audit, 2026-11-10).
      if (GLOOPY && !S.viewCloser) { S.viewCloser = true; document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.view) { S.view = null; draw(); } }); }
      // The notifications panel and GitHub's return are Coder's (one of each on the page).
      if (!S.notifyHook && !GLOOPY) { S.notifyHook = true; window.addEventListener('gf:notify', () => { showNotifications(); }); }
      const q = new URLSearchParams(location.search);
      if (q.has('github') && !GLOOPY) {
        const g = q.get('github');
        try { history.replaceState(history.state, '', location.pathname); } catch (e) {}
        if (g !== 'connected') S.error = g === 'failed' ? 'GitHub did not connect. Try again.' : 'GitHub is not set up for Coder yet.';
        return load();
      }
      if (first) return load();
      draw();
    },
    drawSide,
    // Whether Gloopy waits for you, for its tab's mark (the page asks when it opens, and on coming back to it).
    attention: async () => {
      if (!GLOOPY) return false;
      const r = await call('/gloopy?brief=1');
      const on = r.status === 200 && r.data ? gloopyWaits(r.data.gloopy) : false;
      markGloopy(on);
      return on;
    },
    // For tests and screenshots only.
    _state: S,
  };
  return view;
  }
  window.CoderView = makeView('coder');
  window.GloopyView = makeView('gloopy');
})();
