// CODER'S SCREEN (2026-11-05, the owner: "just make it like Claude Code … more
// like a chat, more like a cursor"). Its own file, apart from the website
// the page (index.html), which hands it the space to draw in
// (`window.CoderView.mount`). Served by Coder's own Worker, same address.
(function () {
  'use strict';
  // ONE SCREEN, TWO AGENTS (owner, 2026-11-09): Coder's chat, and Gloopy's in its own tab, drawn by the same code (each
  // with its own state), so the two look and work alike. KIND is 'coder' or 'gloopy'; the code inside keeps its indent.
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
    cards: [],      // Gloopy: the owner's saved cards, as the Worker lists them (brand, last 4 digits, expiry; never a number)
    payUse: null,   // Gloopy: on the card form, { id, use } (a saved card's id, or '' for another card)
    web: null,      // Gloopy: the live view of its browser, while open (webOpen)
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
      r = await fetch(API + path, { ...(init || {}), headers: { Authorization: 'Bearer ' + token, 'x-coder-proof': window.Auth.proof(), ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    } catch (e) { return { status: 0, data: { error: 'Coder could not be reached. Check your connection.' } }; }
    // A FILE TO SAVE (a read-only chat's patch, owner item 5): handed back whole when it came.
    if (r.ok && typeof (init || {}).file === 'string') return { status: r.status, data: {}, blob: await r.blob(), name: (/filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '') || [])[1] || init.file };
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
    return openProject(g.data.gloopy.id);
  }

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
  async function send(text) {
    text = String(text || '').trim();
    // COMMENTS ON THE CHANGES go with the message; the server writes them in.
    const comments = S.comments.map((c) => ({ file: c.file, line: c.line, quote: c.quote, text: c.text }));
    const pics = (S.pics || []).slice();
    if ((!text && !comments.length && !pics.length) || !S.project || S.running || S.sending) return;
    S.comments = []; S.pics = []; S.mention = null;
    // Your message hands Gloopy's browser back to it (its machine does so as the turn starts).
    if (S.web && S.web.control) S.web.control = false;
    S.sending = true; S.error = ''; S.draft = ''; S.unsent = text;
    const base = S.events.length;
    S.events.push({ type: 'user', text: text || (pics.length ? '(see the picture)' : '(comments on the changes)'), at: Date.now(), local: true, ...(pics.length ? { images: pics.length, thumbs: pics.map((x) => x.url) } : {}) });
    draw(true);
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/message', { method: 'POST', body: JSON.stringify({ text, comments, images: pics.map((x) => ({ type: x.type, data: x.data })), model: S.pick.model, effort: S.pick.effort }) });
    S.sending = false; S.unsent = '';
    if (r.status !== 200) {
      S.events = S.events.slice(0, base);
      S.draft = text; S.pics = pics;
      S.error = (r.data && r.data.error) || 'The message was not sent.';
      if (r.data && r.data.connect) S.phase = 'connect';
      return draw();
    }
    // /compact (like Claude Code's): the summary is made; no job runs.
    if (r.data.compacted) { S.project = r.data.project; S.events = S.events.slice(0, base).concat(r.data.events || []); syncEntry(); return draw(true); }
    S.project = r.data.project; S.running = true; syncEntry();
    S.next = 0;
    startPoll(); draw(true);
  }

  function startPoll() { stopPoll(); S.poll = setTimeout(tick, 300); }
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
    page: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/></svg>',
    web: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M7 6h.01M10 6h.01"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/></svg>',
    clip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
    gh: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    term: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l6-5-6-5M12 19h8"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
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
  function blocks(text) {
    const out = [];
    for (const block of String(text).trim().split(/\n{2,}/)) {
      const lines = block.split('\n');
      const bullet = (l) => /^\s*[-*•]\s+/.test(l), num = (l) => /^\s*\d{1,3}[.)]\s+/.test(l);
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
    web_fetch: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20', browser: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M7 6h.01M10 6h.01', sign_in: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', pay: 'M2.5 7.5a2.5 2.5 0 0 1 2.5-2.5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5zM2.5 10h19M6.5 15h4', handoff: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M9 14l2 2 4-4', schedule: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', helpers: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.7', page: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', web_search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    setup: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  };
  function stepIcon(e) {
    const k = e.tool === 'monitor' ? 'monitor_job' : e.tool && STEP_ICON[e.tool] ? e.tool : 'bash';
    return '<span class="cd-sic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + STEP_ICON[k] + '"/></svg></span>';
  }
  function cmdHTML(e, r, state, key) {
    const open = !!S.open[key];
    // File and web tools say what they did: Read, Edited, Wrote, Searched… (2026-11-05).
    const verb = e.verb ? (state === 'run' ? e.verb.replace(/^Read$/, 'Reading').replace(/^Wrote$/, 'Writing').replace(/^Edited$/, 'Editing').replace(/^Searched/, 'Searching').replace(/^Found$/, 'Finding').replace(/^Fetched$/, 'Fetching').replace(/^Opened$/, 'Opening').replace(/^Looked at$/, 'Looking at').replace(/^Clicked$/, 'Clicking').replace(/^Typed into$/, 'Typing into').replace(/^Pressed$/, 'Pressing').replace(/^Chose in$/, 'Choosing in').replace(/^Scrolled$/, 'Scrolling').replace(/^Went back$/, 'Going back') : e.verb) : state === 'run' ? 'Running' : 'Ran';
    // WHAT A BROWSER STEP DID, said in words once it is done ("Clicked “Go”"), in place of its verb and the element's number.
    const said = r && typeof r.label === 'string' && r.label ? r.label : '';
    const tail = state === 'run' ? '<span class="cd-st"><span class="cd-spin" aria-label="working"></span></span>'
      : state === 'bad' ? '<span class="cd-st cd-st-bad">✕ ' + (r.timedOut ? 'timed out' : e.tool ? 'error' : 'exit ' + esc(r.code)) + '</span>'
      : state === 'bg' ? '<span class="cd-st cd-st-bg"><i></i>running</span>'
      : state === 'ok' ? '<span class="cd-st cd-st-ok" aria-label="done">✓</span>' : '';
    return '<div class="cd-cmd is-' + state + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="cd-cmd-row" data-step="' + esc(key) + '"' + (r ? '' : ' disabled') + '>' +
        stepIcon(e) + '<span class="cd-cmd-verb">' + (said ? '<span class="cd-cmd-said">' + esc(said) + '</span>' : verb) + '</span>' + (said ? '' : ' <code class="cd-cmd-text">' + esc(e.command.split('\n')[0]) + '</code>') +
        tail +
      '</button>' +
      // THE PICTURE A READ OPENED, small, under its step (the owner, 2026-11-08: "Fix those 3"; like Claude Code's).
      stepPics(r) +
      (open && r ? '<pre class="cd-out">' + esc(r.output || '(no output)') + '</pre>' : '') +
    '</div>';
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
    const W = { bash: ['ran', 'command', 'commands', 'command'], read: ['read', 'file', 'files', 'read'], write: ['wrote', 'file', 'files', 'write'], edit: ['edited', 'file', 'files', 'edit'], grep: ['searched for', 'pattern', 'patterns', 'search'], glob: ['searched for', 'pattern', 'patterns', 'search'], lsp: ['made', 'code lookup', 'code lookups', 'lookup'], web_fetch: ['fetched', 'page', 'pages', 'fetch'], browser: ['took', 'browser step', 'browser steps', 'browser step'], sign_in: ['asked you to sign in', '', '', 'sign-in'], sign_in_saved: ['signed in with a saved login', '', '', 'sign-in'], pay: ['asked you for a card', '', '', 'card request'], handoff: ['asked you to take over', '', '', 'handoff'], schedule: ['worked with', 'schedule', 'schedules', 'schedule step'], helpers: ['started', 'helper team', 'helper teams', 'helper team'], page: ['published', 'page', 'pages', 'page'], web_search: ['searched the web', '', '', 'web search'], monitor: ['checked', 'background job', 'background jobs', 'check'], stop_job: ['stopped', 'background job', 'background jobs', 'stop'], review: ['reviewed the changes', '', '', 'review'], undo: ['undid the last job', '', '', 'undo'], setup: ['ran the setup script', '', '', 'setup'] };
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

  function stepsHTML() {
    const out = [];
    const results = {};
    for (const e of S.events) if (e.type === 'result' && e.id) results[e.id] = e;
    let lastUser = -1;
    S.events.forEach((e, i) => { if (e.type === 'user') lastUser = i; });
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
      flush();
      const mark = e.type === 'user' && !S.running && S.project && Array.isArray(S.project.marks) ? S.project.marks.find((m) => m.ev === i) : null;
      if (e.type === 'user') out.push('<div class="cd-user">' + (mark && !GLOOPY ? '<button type="button" class="cd-rewind" data-rewind="' + Number(mark.turn) + '" title="Rewind to before this message">Rewind</button>' : '') + (e.thumbs && e.thumbs.length ? '<div class="cd-thumbs">' + e.thumbs.map((u) => '<img src="' + esc(u) + '" alt="">').join('') + '</div>' : e.images ? '<div class="cd-imgnote">' + esc(e.images) + ' picture' + (e.images > 1 ? 's' : '') + '</div>' : '') + '<div class="cd-bubble">' + esc(e.text) + '</div></div>');
      else if (e.type === 'text' || e.type === 'done') out.push('<div class="cd-ai">' + prose(e.text) + '</div>');
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
      else if (e.type === 'approval') {
        // A BROWSER STEP WAITING FOR YOUR OK (Gloopy, 2026-11-09; like Grok Bot's approval cards and dots' Auto-review):
        // the step, the site and why it asks; Allow once, Always allow (a rule for steps like it) or Deny. Live on the last card.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const step = String(e.step || '');
        out.push('<div class="cd-secret cd-approve"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Gloopy wants to ' + esc(step.charAt(0).toLowerCase() + step.slice(1)) + '</b>' +
          (e.site ? '<p class="cd-secret-how">On <code>' + esc(e.site) + '</code></p>' : '') +
          (e.why ? '<p class="cd-secret-why">' + esc(e.why) + '</p>' : '') +
          // A NEW SCHEDULE (2026-11-09): its task, and no "Always allow" (each schedule is its own OK).
          (e.detail ? '<p class="cd-secret-p">' + esc(e.detail) + '</p>' : '') +
          (live ? (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-approve="deny" data-card="' + esc(e.id) + '">Deny</button>' + (e.kind === 'schedule' ? '' : '<button type="button" class="cd-card-no" data-approve="always" data-card="' + esc(e.id) + '" title="Allow steps like this from now on (a rule Gloopy’s checks follow)">Always allow</button>') + '<button type="button" class="cd-card-yes" data-approve="once" data-card="' + esc(e.id) + '">' + (e.kind === 'schedule' ? 'Allow' : 'Allow once') + '</button></div>' : '') + '</div>');
      }
      else if (e.type === 'signin') {
        // THE PRIVATE SIGN-IN FORM (Gloopy, 2026-11-09; like Grok Bot's Secure Form and dots' private sign-in): what you type
        // goes straight into Gloopy's browser on that site. Never kept in this page's state; the box is emptied once sent.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        out.push('<div class="cd-secret cd-signin"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Sign in to ' + esc(e.site || 'the site') + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-p">What you type goes straight into Gloopy’s browser on ' + esc(e.site || 'the site') + '. Gloopy never sees it, and it’s saved only if you tick the box below.</p>' +
          (live ? (e.user ? '<label class="cd-secret-l" for="cdSignUser">' + esc(e.user) + '</label><input id="cdSignUser" class="cd-secret-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">' : '') +
            '<label class="cd-secret-l" for="cdSignPass">Password</label><input id="cdSignPass" class="cd-secret-in" type="password" autocomplete="off">' +
            // SAVE FOR NEXT TIME (2026-11-09; Grok Bot's Vault, dots' "Save to Passwords"): kept sealed only if signing in works.
            '<label class="cd-sign-save"><input type="checkbox" id="cdSignSave"> Save this login, so Gloopy can sign in to ' + esc(e.site || 'the site') + ' for you next time</label>' +
            (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') +
            '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-signin-skip="' + esc(e.id) + '">Not now</button><button type="button" class="cd-card-yes" data-signin="' + esc(e.id) + '" disabled>Sign in</button></div>' : '') + '</div>');
      }
      else if (e.type === 'pay') {
        // PAYING AT A CHECKOUT (Gloopy, 2026-11-09: "can we try both"; Grok Bot's card form and Vault, dots' asking before a
        // payment): the card goes straight into the payment form in Gloopy's browser. A card can be saved (never its
        // security code); a saved one needs only its security code. Nothing typed here is kept in this page's state.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const has = (f) => Array.isArray(e.fields) && e.fields.includes(f);
        const now = new Date(), thisMonth = now.getFullYear() * 12 + now.getMonth();
        const saved = (S.cards || []).filter((c) => Number(c.year) * 12 + Number(c.month) - 1 >= thisMonth);
        const use = S.payUse && S.payUse.id === e.id ? S.payUse.use : (saved[0] ? saved[0].id : '');
        const box = (id, label, attrs) => '<label class="cd-secret-l" for="' + id + '">' + label + '</label><input id="' + id + '" class="cd-secret-in" ' + attrs + ' spellcheck="false">';
        const two = (a, b) => '<div class="cd-pay-two"><div>' + a + '</div><div>' + b + '</div></div>';
        const cvcBox = has('cvc') ? box('cdPayCvc', 'Security code', 'type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="CVC"') : '';
        out.push('<div class="cd-secret cd-pay"><div class="cd-secret-icon">' + ICON.card + '</div><b class="cd-secret-t">Pay ' + esc(e.total || '') + ' on ' + esc(e.site || 'the site') + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-p">Your card goes straight into the payment form in Gloopy’s browser on ' + esc(e.site || 'the site') + (e.via ? ' (its card fields are from ' + esc(e.via) + ')' : '') + '. Gloopy never sees it. Nothing is paid until Gloopy places the order.</p>' +
          (live ? (saved.length ? '<div class="cd-pay-pick">' + saved.map((c) => '<label class="cd-pay-opt"><input type="radio" name="cdPayUse" value="' + esc(c.id) + '" data-pay-for="' + esc(e.id) + '"' + (use === c.id ? ' checked' : '') + '> ' + esc(c.brand) + ' ending ' + esc(c.last4) + ' <small>' + esc(String(c.month).padStart(2, '0') + '/' + String(c.year).slice(-2)) + '</small></label>').join('') + '<label class="cd-pay-opt"><input type="radio" name="cdPayUse" value="" data-pay-for="' + esc(e.id) + '"' + (use ? '' : ' checked') + '> Another card</label></div>' : '') +
            (use ? cvcBox
              : box('cdPayNumber', 'Card number', 'type="text" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234"') +
                two(box('cdPayExp', 'Expiry date', 'type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY"'), cvcBox) +
                (has('name') ? box('cdPayName', 'Name on card', 'type="text" autocomplete="cc-name"') : '') +
                (has('postal') ? box('cdPayPostal', 'Billing postal code', 'type="text" autocomplete="postal-code"') : '') +
                // SAVE FOR NEXT TIME (Grok Bot's "Securely save to Bot's vault"): kept sealed once it went in, never its security code.
                '<label class="cd-sign-save"><input type="checkbox" id="cdPaySave"> Save this card, so next time you only type its security code (the code itself is never saved)</label>') +
            (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') +
            '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-pay-skip="' + esc(e.id) + '">Not now</button><button type="button" class="cd-card-yes" data-pay="' + esc(e.id) + '">Fill in card</button></div>' : '') + '</div>');
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
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        out.push('<div class="cd-secret cd-handoff"><div class="cd-secret-icon">' + ICON.web.replace('width="16" height="16"', 'width="26" height="26"') + '</div><b class="cd-secret-t">Gloopy needs you in its browser</b>' +
          '<p class="cd-secret-how">' + esc(e.task || '') + (e.site ? ' · <code>' + esc(e.site) + '</code>' : '') + '</p>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-p">Open Gloopy’s browser, do only this step, then hand it back. Gloopy sees the page again after.</p>' +
          (live ? (S.cardMsg && S.cardMsg.id === e.id ? '<p class="cd-secret-err">' + esc(S.cardMsg.text) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-card-no" data-handoff-skip="' + esc(e.id) + '">Not now</button><button type="button" class="cd-card-yes" data-handoff-open="' + esc(e.id) + '"' + (S.webOK ? '' : ' disabled') + '>Open browser</button></div>' : '') + '</div>');
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
      else if (e.type === 'stopped') out.push('<div class="cd-note">Stopped.</div>');
      else if (e.type === 'note') out.push('<div class="cd-localnote">' + esc(e.text) + '</div>');
      else if (e.type === 'notify') out.push('<div class="cd-localnote">Notified you: ' + esc(e.text) + '</div>');
    });
    flush();
    if (S.running && !S.events.slice(lastUser + 1).some((e) => e.type === 'bash' && !results[e.id])) out.push('<div class="cd-thinking"><span></span><span></span><span></span></div>');
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
      (S.webOK && S.project ? '<button type="button" class="cd-hbtn cd-web-btn" id="cdWeb"' + (S.web ? ' aria-pressed="true"' : '') + '>' + ICON.web + 'Browser' + (S.web && S.web.control ? ' · You' : S.running ? ' · Live' : '') + '</button>' : '') +
    '</div>' + (S.web ? webHTML() : '');
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
  const WEB_EVERY_MS = 800, WEB_WATCH_MS = 2 * 60 * 1000, WEB_HOLD_MS = 15 * 60 * 1000;
  const webPath = () => '/projects/' + encodeURIComponent(S.project.id) + '/screen';
  const webHandoff = () => (S.project && S.project.pending && S.project.pending.kind === 'handoff' ? S.project.pending : null);
  function webHTML() {
    const w = S.web;
    const st = w.control ? ['is-you', 'You have control'] : w.working || S.running ? ['is-work', 'Gloopy is using it'] : w.asleep ? ['', 'Asleep'] : w.off ? ['', 'Closed'] : ['', 'Gloopy isn’t using it'];
    const host = (() => { try { return w.url && /^https?:/.test(w.url) ? new URL(w.url).host : ''; } catch (e) { return ''; } })();
    const empty = w.none ? 'Gloopy’s browser isn’t on this computer.'
      : w.asleep ? 'Gloopy’s computer is asleep. Its browser opens when Gloopy uses it, or when you take over.'
      : w.off ? 'Gloopy’s browser is closed. It opens when Gloopy uses it, or when you take over.'
      : !w.shot ? (w.error ? 'The browser could not be shown: ' + w.error : 'Opening…') : '';
    const ho = webHandoff();
    return '<div class="cd-web" id="cdWebPanel">' +
      '<div class="cd-web-bar"><span class="cd-web-st ' + st[0] + '"><i></i>' + st[1] + '</span>' +
        '<span class="cd-web-addr" id="cdWebAddr" title="' + esc(w.url || '') + '">' + esc(w.title || '') + (host ? ' · ' + esc(host) : '') + '</span>' +
        (w.paused ? '<button type="button" class="cd-web-mini" id="cdWebResume">Refresh</button>' : '') +
        '<button type="button" class="cd-web-x" id="cdWebClose" aria-label="Close the browser view">×</button></div>' +
      '<div class="cd-web-screen' + (w.control ? ' is-you' : '') + '" id="cdWebScreen"' + (w.control ? ' tabindex="0" aria-label="Gloopy’s browser: click to use it, type to type into it"' : '') + '>' +
        (empty ? '<p class="cd-web-empty">' + esc(empty) + '</p>' : '<img id="cdWebImg" src="' + esc(w.shot) + '" alt="Gloopy’s browser" draggable="false">') + '</div>' +
      (w.control ? '<div class="cd-web-tools"><input id="cdWebType" class="cd-web-in" type="text" placeholder="Type into the page" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(S.webBox || '') + '">' +
        '<button type="button" id="cdWebSend">Type</button><button type="button" data-web-key="Enter">Enter</button><button type="button" data-web-key="Tab">Tab</button><button type="button" data-web-key="Backspace" aria-label="Backspace">⌫</button>' +
        '<button type="button" data-web-scroll="-600" aria-label="Scroll up">↑</button><button type="button" data-web-scroll="600" aria-label="Scroll down">↓</button><button type="button" id="cdWebBack">Back</button></div>' : '') +
      '<div class="cd-web-foot">' + (w.msg ? '<p class="cd-web-err">' + esc(w.msg) + '</p>' : w.control ? '<p>Click on the page to use it. ' + (ho ? 'Do only this: ' + esc(ho.task) + '.' : 'Gloopy sees the page again when you hand it back.') + '</p>' : w.working || S.running ? '<p>You’re watching. To take over, stop Gloopy first.</p>' : '<p>Take over to use Gloopy’s browser yourself, then hand it back.</p>') +
        (w.control ? '<button type="button" class="cd-card-yes" id="cdWebGive">' + (ho ? 'Done, hand it back' : 'Hand it back') + '</button>'
          : '<button type="button" class="cd-card-yes" id="cdWebTake"' + (w.working || S.running || w.none ? ' disabled' : '') + '>Take over</button>') +
      '</div></div>';
  }
  function webOpen(take) {
    if (!S.project) return;
    S.web = { url: '', title: '', shot: '', hash: '', control: false, working: false, touched: Date.now(), msg: '' };
    draw();
    if (take) webTake(); else webTick();
  }
  function webClose() {
    if (S.webTimer) clearTimeout(S.webTimer);
    S.webTimer = 0;
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
    if (w.asleep || w.off || w.none) { w.shot = ''; w.hash = ''; }
  }
  // Paints the new picture in place when only it changed (no redraw while you type or click); redraws otherwise.
  function webPaint(before) {
    const w = S.web;
    if (!w) return;
    const shape = [w.control, w.working, w.asleep, w.off, w.none, !!w.shot, w.paused, w.msg, w.error, S.running].join('|');
    const img = S.root && S.root.querySelector('#cdWebImg');
    if (before === shape && img) {
      if (img.getAttribute('src') !== w.shot) img.setAttribute('src', w.shot);
      const a = S.root.querySelector('#cdWebAddr');
      if (a) { let host = ''; try { host = /^https?:/.test(w.url) ? new URL(w.url).host : ''; } catch (e) { host = ''; } a.textContent = (w.title || '') + (host ? ' · ' + host : ''); a.title = w.url || ''; }
      return;
    }
    draw();
  }
  const webShape = () => { const w = S.web; return w ? [w.control, w.working, w.asleep, w.off, w.none, !!w.shot, w.paused, w.msg, w.error, S.running].join('|') : ''; };
  async function webTick() {
    if (S.webTimer) clearTimeout(S.webTimer);
    S.webTimer = 0;
    const w = S.web;
    if (!w || !S.project || !S.root || !S.root.isConnected) return;
    const quiet = Date.now() - w.touched;
    if (!S.running && !w.working && quiet > (w.control ? WEB_HOLD_MS : WEB_WATCH_MS)) { const b = webShape(); w.paused = true; return webPaint(b); }
    if (!S.root.hidden && document.visibilityState === 'visible') {
      const b = webShape();
      const r = await call(webPath() + (w.hash ? '?since=' + encodeURIComponent(w.hash) : ''));
      if (S.web !== w) return;
      if (r.status === 200) webTake_(r.data); else w.error = (r.data && r.data.error) || 'Gloopy’s computer could not be reached.';
      webPaint(b);
    }
    S.webTimer = setTimeout(webTick, WEB_EVERY_MS);
  }
  async function webTake() {
    const w = S.web;
    if (!w) return;
    w.msg = ''; w.touched = Date.now(); w.paused = false;
    const b = webShape();
    w.msg = 'Taking over…'; webPaint(b);
    const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ take: true }) });
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
    if (ho) {
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/handoff', { method: 'POST', body: JSON.stringify({ id: ho.id, done: true }) });
      if (r.status !== 200) { w.msg = (r.data && r.data.error) || 'Your answer could not be sent.'; return draw(); }
      if (r.data && r.data.project) S.project = r.data.project;
      w.control = false; w.touched = Date.now();
      draw();
      return send((r.data && r.data.said) || 'Done.');
    }
    const r = await call(webPath(), { method: 'POST', body: JSON.stringify({ take: false }) });
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
      '<b>Hi, I’m Gloopy</b><p>Your own assistant, with my own computer in the cloud. I look things up, keep track of what you hand me, and remember what matters to you. I always ask before I send, buy or delete anything.</p>' +
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
  async function addPics(files) {
    S.pics = S.pics || [];
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
    return '<div class="cd-composewrap">' + mentionHTML() + commentsHTML() + picsHTML() +
      '<form class="cd-compose" id="cdForm">' +
        '<textarea id="cdIn" rows="1" placeholder="' + (busy ? (GLOOPY ? 'Gloopy is working… you can close this tab' : 'Coder is working… you can close this tab') : GLOOPY ? 'Ask Gloopy anything' : 'Ask Coder to build, fix or explain something · @ for a file') + '">' + esc(S.draft) + '</textarea>' +
        '<button type="button" class="cd-attach" id="cdAttach" aria-label="Attach a picture" title="Attach a picture (or paste one)">' + ICON.clip + '</button><input type="file" id="cdFile" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>' +
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
    const webFocus = document.activeElement && ['cdWebScreen', 'cdWebType'].includes(document.activeElement.id) ? document.activeElement.id : '';
    root.innerHTML = '<div class="cd">' + (S.phase === 'chat' ? '' : '<div class="cd-head cd-head-min"><button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button></div>') + bodyHTML() + '</div>';
    drawSide();
    wire(root);
    const nlog = root.querySelector('#cdLog');
    if (nlog && (scroll || atBottom)) nlog.scrollTop = nlog.scrollHeight;
    if (focus) { const i = root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    if (webFocus) { const f = root.querySelector('#' + webFocus); if (f) f.focus(); }
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
      if (r.status !== 200) { S.cardMsg = { id, text: (r.data && r.data.error) || failed }; draw(); return; }
      S.cardMsg = null; if (r.data && r.data.project) S.project = r.data.project;
      if (r.data && Array.isArray(r.data.cards)) S.cards = r.data.cards;
      send((r.data && r.data.said) || 'Answered.');
    };
    on('[data-approve]', 'click', (e) => {
      const d = e.currentTarget.dataset;
      if (!S.project) return;
      root.querySelectorAll('[data-approve]').forEach((b) => { b.disabled = true; });
      cardAnswer(d.card, 'approve', { decision: d.approve }, 'Your answer could not be sent.');
    });
    on('#cdSignPass', 'input', (e) => { const b = root.querySelector('[data-signin]'); if (b) b.disabled = !e.currentTarget.value; });
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
    on('[data-handoff-open]', 'click', () => { if (S.web) webTake(); else webOpen(true); });
    on('[data-page-open]', 'click', (e) => openPage(e.currentTarget.dataset.pageOpen));
    on('[data-handoff-skip]', 'click', (e) => {
      if (!S.project) return;
      e.currentTarget.disabled = true;
      cardAnswer(e.currentTarget.dataset.handoffSkip, 'handoff', { skip: true }, 'Your answer could not be sent.');
    });
    // GLOOPY'S BROWSER, LIVE: open or close the view; take over and hand back; your clicks, typing, keys and scrolling.
    on('#cdWeb', 'click', () => (S.web ? webClose() : webOpen(false)));
    on('#cdWebClose', 'click', webClose);
    on('#cdWebResume', 'click', () => { if (S.web) { S.web.paused = false; S.web.touched = Date.now(); webTick(); draw(); } });
    on('#cdWebTake', 'click', webTake);
    on('#cdWebGive', 'click', webGive);
    on('#cdWebImg', 'click', (e) => {
      const w = S.web, img = e.currentTarget;
      if (!w || !w.control || !img.naturalWidth) return;
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
      input.addEventListener('paste', (e) => { const files = [...(e.clipboardData && e.clipboardData.files || [])]; if (files.some((f) => /^image\//.test(f.type))) { e.preventDefault(); addPics(files); } });
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
    // For tests and screenshots only.
    _state: S,
  };
  return view;
  }
  window.CoderView = makeView('coder');
  window.GloopyView = makeView('gloopy');
})();
