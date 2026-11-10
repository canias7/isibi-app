// CODER'S SCREEN (2026-11-05, the owner: "just make it like Claude Code … more
// like a chat, more like a cursor"). Its own file, apart from the website
// the page (index.html), which hands it the space to draw in
// (`window.CoderView.mount`). Served by Coder's own Worker, same address.
(function () {
  'use strict';
  const API = '/api/coder';
  const POLL_MS = 1500;
  // How often an open chat waiting for the owner asks about its background commands (tool 4, part 2).
  const BG_POLL_MS = 20000;
  // How often a background command's output, opened from its row, is looked at again.
  const BG_OUT_POLL_MS = 3000;
  const SHELL_TAKEBACK = 'A ! command comes back only when the message box is empty and nothing else is waiting. Otherwise it runs when Coder is done.';
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
      if (c.waiting) { if (o.actions) out.push({ id: c.id, title: 'Coder needs your answer · ' + name, body: c.waiting === 'secret' ? 'Coder needs a key to go on.' : c.waiting === 'envchange' ? 'Coder asks to change the environment.' : c.waiting === 'writeask' ? 'Coder asks to change a protected file.' : c.waiting === 'runask' ? 'Coder asks to run a command.' : 'Coder asked you something.' }); }
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
    stopBgWatch(); stopBgOut(); S.bgOut = null; S.bgUntold = 0;
    S.phase = 'chat'; S.project = null; S.events = []; S.next = 0; S.error = ''; S.showChanges = false; S.changes = null; S.compareAgainst = ''; S.compareBranches = null; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); draw();
    const r = await call('/projects/' + encodeURIComponent(id));
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'The project could not be opened.'; return draw(); }
    S.project = r.data.project; S.events = r.data.events || []; S.queue = r.data.queue || []; S.shellHist = Array.isArray(r.data.shellHistory) ? r.data.shellHistory : [];
    S.running = S.project.status === 'running';
    S.background = undefined; startBgWatch();
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
    if (/^!\s*\S/.test(text)) rememberShell(text);
    // COMMENTS ON THE CHANGES go with the message; the server writes them in.
    const comments = S.comments.map((c) => ({ file: c.file, line: c.line, quote: c.quote, text: c.text }));
    const pics = (S.pics || []).slice();
    if ((!text && !comments.length && !pics.length) || !S.project || S.sending) return;
    // WHILE CODER WORKS, A MESSAGE WAITS FOR IT (Claude Code's queue): shown in grey at the end of the chat, with ✕ to take it
    // back, until Coder reads it, which it does once its running tool calls finish; what is left goes out when it is done.
    if (S.running) {
      if (pics.length || comments.length || !text) { S.error = 'Coder is still working: send pictures or line comments once it is done.'; return draw(); }
      S.sending = true; S.error = '';
      const id = S.project.id;
      const q = await call('/projects/' + encodeURIComponent(id) + '/message', { method: 'POST', body: JSON.stringify({ text }) });
      S.sending = false;
      if (!S.project || S.project.id !== id) return;
      if (q.status === 200 && q.data && q.data.queued) { S.queue = q.data.queue || []; S.draft = ''; return draw(true); }
      S.error = (q.data && q.data.error) || 'The message was not sent.';
      return draw();
    }
    S.comments = []; S.pics = []; S.mention = null;
    S.sending = true; S.error = ''; S.draft = ''; S.unsent = text;
    const base = S.events.length;
    // The owner's own command (shell mode) is shown as the machine will show it: "! " and the command.
    const shellText = /^!/.test(text) && !pics.length && !comments.length && text.replace(/^!\s*/, '') ? '! ' + text.replace(/^!\s*/, '') : '';
    S.events.push({ type: 'user', text: shellText || text || (pics.length ? '(see the picture)' : '(comments on the changes)'), ...(shellText ? { shell: true } : {}), at: Date.now(), local: true, ...(pics.length ? { images: pics.length, thumbs: pics.map((x) => x.url) } : {}) });
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
    S.next = 0; stopBgWatch();
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
      if (S.fails === 5) { S.events = S.events.concat([{ at: Date.now(), type: 'error', text: "Coder's machine is not answering. Still trying…" }]); draw(true); }
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
          if (e.type === 'notify' && info.decides !== false) showLocal({ id, title: 'Coder · ' + name, body: e.text });
          else if (e.type === 'permission' && info.actions !== false) showLocal({ id, title: (e.tool === 'plan' ? 'Coder\'s plan is ready · ' : 'Coder needs your approval · ') + name, body: e.tool === 'plan' ? 'Approve it, or say what to change.' : e.tool === 'bash' ? 'Run: ' + String(e.desc || (e.lines || [])[0] || '').slice(0, 160) : e.path ? 'Change ' + e.path : e.url ? 'Fetch ' + e.url : String(e.what || 'Allow it?') });
          else if (['question', 'secret', 'envchange', 'writeask', 'runask'].includes(e.type) && info.actions !== false) showLocal({ id, title: 'Coder needs your answer · ' + name, body: (e.text ? e.text + (Array.isArray(e.questions) && e.questions.length > 1 ? ' (and ' + (e.questions.length - 1) + ' more)' : '') : '') || e.reason || (e.type === 'writeask' ? 'Allow it to change ' + e.path + '?' : '') });
        }
      }
      S.next = r.data.next || S.next;
      if (r.data.project) S.project = r.data.project;
      if (Array.isArray(r.data.background)) S.background = r.data.background;
      if (Array.isArray(r.data.queue)) S.queue = r.data.queue;
      S.progress = r.data.progress || null;
      S.running = !!r.data.running;
      syncEntry();
      draw(fresh.length > 0);
    }
    if (S.running) S.poll = setTimeout(tick, POLL_MS);
    else { S.background = undefined; startBgWatch(); }
  }

  // SAVED ELSEWHERE (another tab, or Coder's every-minute run while no tab was
  // open): the saved chat is loaded, with the save's own lines.
  async function reloadChat(id) {
    const r = await call('/projects/' + encodeURIComponent(id));
    if (r.status !== 200 || !r.data || !r.data.project || !S.project || S.project.id !== id) return;
    S.project = r.data.project; S.events = r.data.events || []; S.queue = r.data.queue || []; if (Array.isArray(r.data.shellHistory)) S.shellHist = r.data.shellHistory;
    S.running = S.project.status === 'running';
    S.background = undefined;
    syncEntry(); draw(true);
    if (S.running) { S.next = 0; stopBgWatch(); startPoll(); } else startBgWatch();
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
    cloud: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/></svg>',
    clip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
    gh: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    term: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l6-5-6-5M12 19h8"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    // THE PERMISSION MODES (the owner, 2026-11-09, the Claude app's menu): Auto, Accept edits, Plan; and a plan's card.
    auto: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    edits: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    plan: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17.5" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="M9 11h6M9 15h4"/></svg>',
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
    // A NUMBERED LIST KEEPS ITS OWN NUMBERS, AND ITEMS WITH A BLANK LINE BETWEEN THEM ARE ONE LIST (live test, 2026-11-09:
    // Grok wrote "2) …", "3) …", "4) …" for the owner's steps 2 to 4, a blank line between each, and the page showed
    // "1." "1." "1."; the owner: "Yes fix that"). As Markdown has it (CommonMark): a list starts at its first item's
    // number, and an item after a blank line carries the list on; a paragraph or a code block between them ends it.
    // A LINE WITH NO MARK OF ITS OWN CARRIES ON THE ITEM ABOVE IT (the live retest after deploy 71: Grok's "5) `…`" with
    // two more lines under it showed "5)" as plain text, as a block was a list only when every line had a mark).
    const list = (kind, items, start) => {
      const last = out[out.length - 1];
      if (kind === 'ol' && last && typeof last === 'object') last.items.push(...items);
      else if (kind === 'ol') out.push({ start, items });
      else out.push('<ul>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ul>');
    };
    const bullet = /^\s*[-*•]\s+/, num = /^\s*(\d{1,3})[.)]\s+/;
    for (const block of String(text).trim().split(/\n{2,}/)) {
      const lines = block.split('\n');
      if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) { out.push('<h4>' + inline(lines[0].replace(/^#{1,4}\s+/, '')) + '</h4>'); continue; }
      // A paragraph, or one followed by its own list (no blank line between them).
      const first = lines.findIndex((l) => bullet.test(l) || num.test(l));
      if (first !== 0) out.push('<p>' + lines.slice(0, first < 0 ? lines.length : first).map(inline).join('<br>') + '</p>');
      if (first < 0) continue;
      let kind = '', items = [], from = 1;
      for (const l of lines.slice(first)) {
        const k = num.test(l) ? 'ol' : bullet.test(l) ? 'ul' : '';
        if (!k) { items[items.length - 1] += '<br>' + inline(l.trim()); continue; }
        if (k !== kind) { if (items.length) list(kind, items, from); kind = k; items = []; from = k === 'ol' ? parseInt(num.exec(l)[1], 10) : 1; }
        items.push(inline(l.replace(k === 'ol' ? num : bullet, '')));
      }
      list(kind, items, from);
    }
    return out.map((x) => (typeof x === 'object' ? '<ol' + (x.start === 1 ? '' : ' start="' + x.start + '"') + '>' + x.items.map((i) => '<li>' + i + '</li>').join('') + '</ol>' : x)).join('');
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
    web_fetch: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20', web_search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    setup: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  };
  function stepIcon(e) {
    const k = e.tool === 'monitor' ? 'monitor_job' : e.tool && STEP_ICON[e.tool] ? e.tool : 'bash';
    return '<span class="cd-sic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + STEP_ICON[k] + '"/></svg></span>';
  }
  /** How long a running command has run, and its timeout ("12s · timeout 2m"). */
  const secsWords = (n) => { n = Math.max(0, Math.round(n)); return n < 60 ? n + 's' : n % 60 ? Math.floor(n / 60) + 'm ' + (n % 60) + 's' : n / 60 + 'm'; };
  const runWords = (e) => 'Running for ' + secsWords((Date.now() - Number(e.at || Date.now())) / 1000) + (Number(e.timeoutS) > 0 ? ' · timeout ' + secsWords(Number(e.timeoutS)) : '');
  function cmdHTML(e, r, state, key) {
    const open = !!S.open[key];
    // File and web tools say what they did: Read, Edited, Wrote, Searched… (2026-11-05).
    const verb = e.verb ? (state === 'run' ? e.verb.replace(/^Read$/, 'Reading').replace(/^Wrote$/, 'Writing').replace(/^Edited$/, 'Editing').replace(/^Searched/, 'Searching').replace(/^Found$/, 'Finding').replace(/^Fetched$/, 'Fetching') : e.verb) : state === 'run' ? 'Running' : 'Ran';
    const tail = state === 'run' ? '<span class="cd-st"><span class="cd-spin" aria-label="working"></span></span>'
      : state === 'bad' ? '<span class="cd-st cd-st-bad">✕ ' + (r.timedOut ? 'timed out' : e.tool ? 'error' : 'exit ' + esc(r.code)) + '</span>'
      : state === 'bg' ? '<span class="cd-st cd-st-bg"><i></i>running</span>'
      : state === 'bgend' ? (/^(exit|ended)/.test(String((S.bgEnded[r.job] || {}).label || '')) ? '<span class="cd-st cd-st-bad">✕ ' + esc(S.bgEnded[r.job].label) + '</span>' : '<span class="cd-st cd-st-stopped">' + esc((S.bgEnded[r.job] || {}).label || 'stopped') + '</span>')
      : state === 'ok' ? '<span class="cd-st cd-st-ok" aria-label="done">✓</span>'
      : state === 'wait' ? '<span class="cd-st cd-st-wait">waiting for you</span>' : '';
    // A COMMAND'S DESCRIPTION (tool 4, like Claude Code's app: "Run the test suite" in place of the command); the command
    // itself when the step is opened. A step with none (from before, or Grok gave none) shows its command as before.
    const desc = !e.tool && typeof e.desc === 'string' && e.desc.trim() ? e.desc.trim() : '';
    return '<div class="cd-cmd is-' + state + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="cd-cmd-row" data-step="' + esc(key) + '"' + (r ? '' : ' disabled') + '>' +
        stepIcon(e) + (desc ? '<span class="cd-cmd-desc">' + esc(desc) + '</span>' : '<span class="cd-cmd-verb">' + verb + '</span> <code class="cd-cmd-text">' + esc(e.command.split('\n')[0]) + '</code>') +
        changeCounts(r) + tail +
      '</button>' +
      // A COMMAND STILL RUNNING: how long it has run and its timeout (Claude Code 2.1.23), its last lines (1.0.48), and a way to
      // move it to the background (Claude Code's Ctrl+B): Coder goes on, and is told when it ends.
      (state === 'run' && !e.tool && S.running ? '<div class="cd-run-info">' + esc(runWords(e)) + '</div>' + (S.progress && Array.isArray(S.progress.lines) && S.progress.lines.length ? '<pre class="cd-progress">' + esc(S.progress.lines.join('\n')) + '</pre>' : '') + (e.noBg ? '' : '<button type="button" class="cd-bgmove" data-bg-move="1" title="Let it run in the background; Coder goes on and is told when it ends">Run in background</button>') : '') +
      // THE PICTURE A READ OPENED, small, under its step (the owner, 2026-11-08: "Fix those 3"; like Claude Code's).
      stepPics(r) +
      // WHAT A WRITE CHANGED, under its step (the owner, 2026-11-09: "Go ahead and do those"; like Claude Code's).
      stepChange(r, key) +
      // THE FILES A COMMAND CHANGED, under its step (Claude Code's bashEditDiff, with CODER_BASH_EDIT_DIFF on).
      stepFiles(r, key) +
      // THE NEW PROBLEMS IT MADE, by the language server (Claude Code: "Found N new diagnostic issues in M files").
      stepProblems(r, key) +
      (open && r ? (desc ? '<pre class="cd-cmd-in">$ ' + esc(e.command) + '</pre>' : '') + '<pre class="cd-out">' + esc(r.output || '(no output)') + '</pre>' : '') +
    '</div>';
  }
  /**
   * WHAT A WRITE CHANGED, AS CLAUDE CODE SHOWS IT (the owner, 2026-11-09: "Go ahead and do those"; Claude Code: "Wrote N
   * lines to …" with the new file's lines, "N additions and M removals" with the diff of a replaced one, folded with "+N
   * lines" to open): the counts on the step's line, and under it the first CHANGE_FIRST lines, numbered, the rest a tap
   * away. A new file's lines as they are; a change's with what it added and took out. Only text, never markup.
   */
  const CHANGE_FIRST = 8;
  function changeOf(r) { const c = r && r.change; return c && typeof c === 'object' && (c.kind === 'create' || c.kind === 'update') ? c : null; }
  function changeCounts(r) {
    const c = changeOf(r);
    if (!c || c.big) return '';
    const add = Number.isInteger(c.add) ? c.add : 0, del = Number.isInteger(c.del) ? c.del : 0;
    return '<span class="cd-wcount"><span class="cd-add">+' + add + '</span>' + (c.kind === 'update' ? '<span class="cd-del">−' + del + '</span>' : '') + '</span>';
  }
  function stepChange(r, key) {
    const c = changeOf(r);
    if (!c) return '';
    if (c.big) return '<div class="cd-wchg"><p class="cd-wchg-note">Too big to show here: See changes has this file.</p></div>';
    const all = (Array.isArray(c.lines) ? c.lines : []).filter((l) => typeof l === 'string').slice(0, 120);
    if (!all.length) return '';
    const k = key + ':change', open = !!S.open[k];
    const shown = open ? all : all.slice(0, CHANGE_FIRST);
    let o = 0, n = c.kind === 'create' ? 1 : 0;
    const rows = shown.map((l) => {
      const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(l);
      if (h) { o = Number(h[1]); n = Number(h[2]); return '<span class="cd-dl-hunk">' + esc(l) + '</span>'; }
      if (c.kind === 'create') return '<span class="cd-wl"><i>' + (n++) + '</i>' + esc(l.slice(1)) + '</span>';
      const kind = l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : l[0] === '\\' ? 'note' : 'same';
      const num = kind === 'add' ? n++ : kind === 'del' ? o++ : kind === 'note' ? '' : (o++, n++);
      return '<span class="cd-wl' + (kind === 'add' ? ' cd-dl-add' : kind === 'del' ? ' cd-dl-del' : '') + '"><i>' + num + '</i>' + esc(l) + '</span>';
    }).join('');
    const folded = all.length - shown.length, more = Number.isInteger(c.more) && c.more > 0 ? c.more : 0;
    return '<div class="cd-wchg"><pre>' + rows + '</pre>' +
      (folded ? '<button type="button" class="cd-wchg-more" data-change="' + esc(k) + '">Show ' + folded + ' more line' + (folded === 1 ? '' : 's') + '</button>'
        : open && all.length > CHANGE_FIRST ? '<button type="button" class="cd-wchg-more" data-change="' + esc(k) + '">Show less</button>' : '') +
      (open && more ? '<p class="cd-wchg-note">' + more + ' more line' + (more === 1 ? '' : 's') + ' not shown here: See changes has the whole file.</p>' : '') +
    '</div>';
  }
  /**
   * THE FILES A COMMAND CHANGED, AS CLAUDE CODE SHOWS THEM AFTER THE COMMAND (tool 4, the owner, 2026-11-09: "Yes do that i
   * thought we did that"; its settings: "you see their diff in the terminal after the command"): "Updated src/app.js +3 −1",
   * "Created …", "Deleted …", each with its lines folded as a write's are (stepChange), then the other files it changed, by
   * name, and a note when the list is incomplete. Only text, never markup.
   */
  function stepFiles(r, key) {
    const d = r && r.files && typeof r.files === 'object' ? r.files : null;
    if (!d) return '';
    const n = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
    const list = (Array.isArray(d.files) ? d.files : []).filter((f) => f && typeof f.path === 'string').slice(0, 5);
    const others = (Array.isArray(d.others) ? d.others : []).filter((x) => typeof x === 'string').slice(0, 50);
    const moreFiles = Math.max(n(d.moreFiles), others.length);
    if (!list.length && !moreFiles) return '';
    const rows = list.map((f, i) => {
      const verb = f.kind === 'create' ? 'Created' : f.kind === 'delete' ? 'Deleted' : 'Updated';
      const counts = f.binary ? '<span class="cd-fchg-bin">binary</span>' : '<span class="cd-wcount">' + (f.kind !== 'delete' ? '<span class="cd-add">+' + n(f.add) + '</span>' : '') + (f.kind !== 'create' ? '<span class="cd-del">−' + n(f.del) + '</span>' : '') + '</span>';
      // (A new file's lines as a write shows them: without git's "@@ -0,0 +1,N @@" line.)
      const lines = (Array.isArray(f.lines) ? f.lines : []).filter((l) => typeof l === 'string' && !(f.kind === 'create' && /^@@ /.test(l)));
      const body = f.binary || !lines.length ? '' : stepChange({ change: { kind: f.kind === 'create' ? 'create' : 'update', lines, ...(n(f.more) ? { more: n(f.more) } : {}) } }, key + ':f' + i);
      return '<div class="cd-fchg"><p class="cd-fchg-head"><b>' + verb + '</b> <code>' + esc(f.path) + '</code>' + counts + '</p>' + body + '</div>';
    }).join('');
    const named = others.slice(0, 10);
    const rest = moreFiles ? '<p class="cd-fchg-note">' + (named.length ? 'Also changed: ' + named.map((x) => '<code>' + esc(x) + '</code>').join(', ') + (moreFiles > named.length ? ' and ' + (moreFiles - named.length) + ' more' : '') : moreFiles + ' more file' + (moreFiles === 1 ? '' : 's') + ' changed') + '</p>' : '';
    const note = d.unavailable ? '<p class="cd-fchg-note">Some of what it changed could not be shown here: See changes has it all.</p>' : '';
    return '<div class="cd-files">' + rows + rest + note + '</div>';
  }
  /** "Found N new diagnostic issues in 1 file", and the issues themselves a tap away (as Claude Code's Ctrl+O shows them). */
  function stepProblems(r, key) {
    const list = r && Array.isArray(r.problems) ? r.problems.filter((p) => p && typeof p.message === 'string').slice(0, 20) : [];
    if (!list.length) return '';
    const all = Math.max(list.length, Number.isInteger(r.problemsAll) ? r.problemsAll : 0);
    const k = key + ':problems', open = !!S.open[k];
    return '<div class="cd-probs"><button type="button" class="cd-probs-row" data-problems="' + esc(k) + '">Found ' + all + ' new diagnostic issue' + (all === 1 ? '' : 's') + ' in 1 file<span>' + (open ? 'Hide' : 'Show') + '</span></button>' +
      (open ? '<pre class="cd-probs-list">' + list.map((p) => (p.severity === 'warning' ? '⚠' : '✘') + ' [Line ' + esc(String(p.line)) + ':' + esc(String(p.column)) + '] ' + esc(p.message) + (p.code ? ' [' + esc(p.code) + ']' : '')).join('\n') + (all > list.length ? '\n… and ' + (all - list.length) + ' more' : '') + '</pre>' : '') +
    '</div>';
  }
  /** The small copies of the pictures a step opened: only JPEG data URLs, as Coder's machine makes them. */
  function stepPics(r) {
    const list = r && Array.isArray(r.thumbs) ? r.thumbs.filter((u) => typeof u === 'string' && u.length <= 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(u)).slice(0, 4) : [];
    return list.length ? '<div class="cd-cmd-pics">' + list.map((u) => '<img src="' + u + '" alt="The picture Coder opened" loading="lazy">').join('') + '</div>' : '';
  }

  // THE FILE A READ, WRITE OR EDIT STEP IS ABOUT, for the group line's count: its line without what a read adds after the
  // name (" from line 1112", " pages 1-5", " (@-mentioned)", " (again, after the summary)").
  function stepFile(e) {
    if (!/^(read|write|edit)$/.test(e.tool || '')) return '';
    return String(e.command || '').replace(/ \((?:@-mentioned|again, after the summary)\)$/, '').replace(/ (?:pages \S+|from line \d+)$/, '');
  }
  /**
   * THE LINE OVER A GROUP OF STEPS, AS CLAUDE CODE WRITES IT (the owner, 2026-11-08: "do it like this … 'Ran 1 command,
   * read 4 files'"; Claude Code names each kind in a collapsed group, in its docs and changelog: "Ran 3 shell commands",
   * "Read N files", "Searched for", "Listed N directories"): each kind with how many, in the order they first came, and
   * what failed by its kind ("a read failed": the line said "a command failed" for a failed read). `steps`: [{ tool,
   * failed, file }], a step with no tool being a command. A FILE IS COUNTED ONCE (live test, 2026-11-09: "Wrote 6 files"
   * for five, calc.py written twice; the owner: "Yes fix that"): Claude Code's group line counts the different files
   * (its `readFilePaths`, a set), not the steps; a step with no `file` counts as one.
   */
  function groupWords(steps) {
    const W = { bash: ['ran', 'command', 'commands', 'command'], read: ['read', 'file', 'files', 'read'], write: ['wrote', 'file', 'files', 'write'], edit: ['edited', 'file', 'files', 'edit'], grep: ['searched for', 'pattern', 'patterns', 'search'], glob: ['searched for', 'pattern', 'patterns', 'search'], lsp: ['made', 'code lookup', 'code lookups', 'lookup'], web_fetch: ['fetched', 'page', 'pages', 'fetch'], web_search: ['searched the web', '', '', 'web search'], monitor: ['checked', 'background job', 'background jobs', 'check'], stop_job: ['stopped', 'background job', 'background jobs', 'stop'], review: ['reviewed the changes', '', '', 'review'], undo: ['undid the last job', '', '', 'undo'], setup: ['ran the setup script', '', '', 'setup'] };
    const said = new Map(), bad = new Map();
    for (const s of steps) {
      const w = Object.prototype.hasOwnProperty.call(W, s.tool || 'bash') ? W[s.tool || 'bash'] : ['did', 'step', 'steps', 'step'];
      const key = w[0] + '|' + w[1];
      const had = said.get(key) || { w, n: 0, files: new Set() };
      if (!s.file || !had.files.has(s.file)) had.n++;
      if (s.file) had.files.add(s.file);
      said.set(key, had);
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
    // `ok`: an exit code Claude Code counts as no failure (grep's 1, "No matches found"), so neither a red mark nor a failure.
    // A BACKGROUND COMMAND THAT ENDED (Coder was told: its line names its id) shows how: ✓, a failure, or stopped.
    S.bgEnded = {};
    for (const e of S.events) if (e.type === 'note') { if (e.job && e.end) S.bgEnded[e.job] = e.end; if (Array.isArray(e.jobs)) for (const j of e.jobs) S.bgEnded[j] = { ok: false, label: 'stopped' }; }
    // A STEP WAITING ON THE OWNER'S YES (a permission card): "waiting for you", not running.
    const answered = new Set(S.events.filter((x) => x.type === 'permanswer').map((x) => x.pid));
    const waitingIds = new Set(S.events.filter((x) => x.type === 'permission' && x.id && !answered.has(x.pid)).map((x) => x.id));
    const stateOf = (e, i) => { const r = results[e.id]; const end = r && r.background && r.job ? S.bgEnded[r.job] : null; return !r ? (S.running && i > lastUser ? (waitingIds.has(e.id) ? 'wait' : 'run') : 'gone') : end ? (end.ok ? 'ok' : 'bgend') : r.background ? 'bg' : r.code === 0 || r.ok === true ? 'ok' : 'bad'; };
    // Commands in a row (with nothing said between them) are one group.
    let group = [];
    const flush = () => {
      if (!group.length) return;
      if (group.length === 1) { const [e, i] = group[0]; out.push(cmdHTML(e, results[e.id], stateOf(e, i), String(e.id || i))); }
      else {
        const gk = 'g' + String(group[0][0].id || group[0][1]);
        const shut = !!S.open[gk];
        // The line names each kind of step and what failed, as Claude Code's does (groupWords).
        const words = groupWords(group.map(([e, i]) => ({ tool: e.tool || '', failed: stateOf(e, i) === 'bad', file: stepFile(e) })));
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
      if (e.type === 'user') out.push('<div class="cd-user">' + (mark ? '<button type="button" class="cd-rewind" data-rewind="' + Number(mark.turn) + '" title="Rewind to before this message">Rewind</button>' : '') + (e.thumbs && e.thumbs.length ? '<div class="cd-thumbs">' + e.thumbs.map((u) => '<img src="' + esc(u) + '" alt="">').join('') + '</div>' : e.images ? '<div class="cd-imgnote">' + esc(e.images) + ' picture' + (e.images > 1 ? 's' : '') + '</div>' : '') + '<div class="cd-bubble' + (e.shell ? ' cd-bubble-shell' : '') + '">' + esc(e.text) + '</div></div>');
      else if (e.type === 'text' || e.type === 'done') out.push('<div class="cd-ai">' + prose(e.text) + '</div>');
      else if (e.type === 'permission') out.push(permHTML(e));
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
      else if (e.type === 'writeask') {
        // A PROTECTED FILE CODER WANTS TO WRITE (the owner, 2026-11-09: "do that"; like Claude Code's prompt for them): the
        // lines it would write, then Allow or Don't allow, which become the owner's next message.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const lines = e.change && Array.isArray(e.change.lines) ? e.change.lines.filter((l) => typeof l === 'string').slice(0, 40) : [];
        const more = e.change && Number.isInteger(e.change.more) && e.change.more > 0 ? e.change.more : 0;
        const upd = !!(e.change && e.change.kind === 'update');
        out.push('<div class="cd-secret cd-envchange cd-writeask"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Allow Coder to change ' + esc(e.path) + '?</b>' +
          '<p class="cd-secret-p">This file can make code run on your computer when you pull the branch, or change how the project is built, so Coder asks you first (Claude Code does too). What it would ' + (upd ? 'change' : 'write') + ':</p>' +
          // AN EDIT'S CHANGE (edit, tool 3, 2026-11-09: edit asks for these files too): the lines it takes out in red, the
          // ones it puts in in green, as under each edit's step.
          '<pre class="cd-envchange-pre">' + (!lines.length ? (upd ? '(nothing)' : '(an empty file)') : upd ? lines.map((l) => '<span class="cd-wl' + (l[0] === '+' ? ' cd-dl-add' : l[0] === '-' ? ' cd-dl-del' : '') + '">' + esc(l) + '</span>').join('') : lines.map((l, k) => '<span class="cd-ne-n">' + (k + 1) + '</span>' + esc(l.slice(1))).join('\n')) + (more ? '\n… ' + more + ' more line' + (more === 1 ? '' : 's') : '') + '</pre>' +
          (live ? '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-writeask-no="' + i + '">Don\'t allow</button><button type="button" class="cd-secret-save" data-writeask-ok="' + i + '">Allow</button></div>' : '') +
        '</div>');
      }
      else if (e.type === 'runask') {
        // A COMMAND CODER ASKS TO RUN (tool 4, like Claude Code's prompt for it): one whose > or tee writes a protected file,
        // one that writes through a link out of the project (Bash docs pass 3), or one over 10,000 characters. The command,
        // then Allow or Don't allow, which become the owner's next message.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const lines = Array.isArray(e.lines) ? e.lines.filter((l) => typeof l === 'string').slice(0, 40) : [];
        const more = Number.isInteger(e.more) && e.more > 0 ? e.more : 0;
        const paths = Array.isArray(e.paths) ? e.paths.filter((p) => typeof p === 'string').slice(0, 10) : [];
        const prot = e.kind === 'protected' && paths.length, link = e.kind === 'link' && paths.length, rblock = e.kind === 'readblock';
        out.push('<div class="cd-secret cd-envchange cd-writeask cd-runask"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">' + (prot || link ? 'Allow Coder to change ' + esc(paths.join(', ')) + '?' : 'Allow Coder to run this command?') + '</b>' +
          '<p class="cd-secret-p">' + (prot ? 'This command writes ' + (paths.length === 1 ? 'a file' : 'files') + ' that can make code run on your computer when you pull the branch, or change how the project is built' : link ? 'This command writes through a link that leads out of the project' : rblock ? 'This command reads outside the project (or can\'t be traced), which your read-block setting asks about first' : 'This command is over 10,000 characters, more than Coder\'s checks read through') + ', so Coder asks you first (Claude Code does too).' + (e.desc ? ' What it does: ' + esc(e.desc) + '.' : '') + ' The command:</p>' +
          '<pre class="cd-envchange-pre">' + esc(lines.join('\n')) + (more ? '\n… ' + more + ' more line' + (more === 1 ? '' : 's') : '') + '</pre>' +
          (live ? '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-runask-no="' + i + '">Don\'t allow</button><button type="button" class="cd-secret-save" data-runask-ok="' + i + '">Allow</button></div>' : '') +
        '</div>');
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
      else if (e.type === 'secret') {
        // A KEY FOR ONE HOST (owner, 2026-11-06, like Claude Code's card): typed here, sealed on the server, added by the proxy; Coder never sees it.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        out.push('<div class="cd-secret"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Coder needs a secret for ' + esc(e.host) + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-how">Sent as <code>' + esc(e.header || 'Authorization') + ': ' + esc(e.prefix == null ? 'Bearer ' : (e.prefix ? e.prefix + ' ' : '')) + '&lt;your key&gt;</code></p>' +
          '<p class="cd-secret-p">This secret is saved on the environment ' + esc(S.envInfo ? S.envInfo.name : 'of this chat') + ': every chat that uses it can reach ' + esc(e.host) + ' with it. It\'s kept secure: Coder never sees it, and it\'s only sent to ' + esc(e.host) + '.</p>' +
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
    out.push(queueHTML());
    return out.join('');
  }
  // MESSAGES WAITING FOR CODER (Claude Code: "Sent and queued messages show in gray until Claude starts responding to them";
  // on the web, "To take a queued message back, click the ✕ on it"): at the end of the chat until Coder reads them.
  // What still waits (one Coder read shows once, as the owner's message).
  function queuedNow() {
    const read = new Set(S.events.filter((e) => e.type === 'user' && e.qid).map((e) => e.qid));
    return (Array.isArray(S.queue) ? S.queue : []).filter((q) => q && q.qid && !read.has(q.qid));
  }
  function queueHTML() {
    const list = queuedNow();
    return list.map((q) => '<div class="cd-user cd-queued"><div class="cd-queued-label">' + (S.running ? (q.shell ? 'Runs when Coder is done' : 'Waiting for Coder') : 'Not sent yet') + ' <button type="button" class="cd-queued-x" data-unqueue="' + esc(q.qid) + '" aria-label="Take this message back" title="Take it back to the message box">✕</button></div><div class="cd-bubble' + (q.shell ? ' cd-bubble-shell' : '') + '">' + esc(q.text) + '</div></div>').join('');
  }

  // THE CHAT'S OWN BAR: its title, repository and branch, the pull request,
  // See changes. ☰ opens the chats on a phone.
  function headHTML() {
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
    return S.mention.shell ? shellPathMatches(S.files.list, S.mention.q) : rankMentions(S.files.list, S.mention.q);
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

  // THE ! BOX'S COMPLETION (Claude Code's shell mode: "history-based autocomplete: type a partial command and press Tab to
  // complete from previous ! commands in the current project"; "live file path autocomplete": a word with a / in it, such
  // as ./src/ or ~/, lists the files and folders that fit, and Tab takes the one picked).
  // The earlier commands, newest first: those waiting, this chat's, then the owner's others in the chat's repository (kept on
  // their account by Coder's Worker, given with the chat: S.shellHist).
  const bare = (t) => String(t || '').replace(/^!\s*/, '').trim();
  function rememberShell(text) {
    const cmd = bare(text);
    if (cmd) S.shellHist = [cmd, ...(Array.isArray(S.shellHist) ? S.shellHist : []).filter((x) => x !== cmd)].slice(0, 100);
  }
  function shellHistory() {
    const mine = S.events.filter((e) => e.type === 'user' && e.shell).map((e) => bare(e.text)).reverse();
    const waiting = queuedNow().filter((q) => q.shell).map((q) => bare(q.text)).reverse();
    const kept = (Array.isArray(S.shellHist) ? S.shellHist : []).filter((x) => typeof x === 'string');
    return [...new Set([...waiting, ...mine, ...kept].filter(Boolean))];
  }
  // Tab: the newest earlier command that starts with what was typed; Tab again, the one before it.
  function shellTab(input) {
    const v = input.value, lead = (/^!\s*/.exec(v) || [''])[0];
    const tab = S.shellTab && S.shellTab.shown === v ? S.shellTab : { typed: bare(v), lead, i: -1 };
    if (!tab.typed) return false;
    const found = shellHistory().filter((c) => c.startsWith(tab.typed) && c !== tab.typed);
    if (!found.length) return false;
    tab.i = (tab.i + 1) % found.length;
    tab.shown = tab.lead + found[tab.i];
    S.shellTab = tab; S.draft = tab.shown; input.value = tab.shown; grow(input);
    input.setSelectionRange(tab.shown.length, tab.shown.length);
    return true;
  }
  // A path in the ! box: the folders and files right under the folder typed so far (folders first), from the repository's
  // file list; a folder picked keeps the list open for the next level.
  function shellPathMatches(list, token) {
    const dot = token.startsWith('./') ? './' : '';
    const t = token.slice(dot.length);
    const cut = t.lastIndexOf('/') + 1, dir = t.slice(0, cut), part = t.slice(cut).toLowerCase();
    const seen = new Map();
    for (const p of list) {
      if (!p.startsWith(dir)) continue;
      const rest = p.slice(dir.length), k = rest.indexOf('/');
      const child = k >= 0 ? rest.slice(0, k + 1) : rest;
      if (child && child.toLowerCase().startsWith(part) && !seen.has(child)) seen.set(child, k >= 0);
    }
    return [...seen.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1)).slice(0, 8).map(([child]) => dot + dir + child);
  }
  function pickShellPath(path) {
    const at = S.mention ? S.mention.at : -1;
    if (at < 0) return;
    const v = S.draft, end = at + S.mention.q.length, folder = path.endsWith('/');
    S.draft = v.slice(0, at) + path + (folder ? '' : ' ') + v.slice(end);
    const pos = at + path.length + (folder ? 0 : 1);
    S.mention = folder ? { at, q: path, shell: true } : null; S.mentionSel = 0;
    draw();
    const i = S.root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
  }

  // ITS BACKGROUND COMMANDS STILL RUNNING (tool 4, part 2; like Claude Code's background tasks under the prompt, each with a
  // Stop): they go on after Coder's answer, until they end, are stopped, or reach their time limit; Coder is told when one ends.
  const bgList = () => (Array.isArray(S.background) ? S.background : S.project && Array.isArray(S.project.background) ? S.project.background : []);
  const bgAge = (b) => { const s = Math.max(0, Math.round((Date.now() - Number(b.at || Date.now())) / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.round(s / 60) + 'm' : (s / 3600).toFixed(1).replace(/\.0$/, '') + 'h'; };
  function bgHTML() {
    const list = bgList();
    if (!list.length) return '';
    return '<div class="cd-bg" role="status" aria-label="Background commands"><div class="cd-bg-head">' + list.length + ' background command' + (list.length === 1 ? '' : 's') + ' running</div>' +
      list.map((b) => '<div class="cd-bg-row"><span class="cd-bg-dot" aria-hidden="true"></span><span class="cd-bg-name" title="' + esc(b.command || '') + '">' + esc(b.desc || b.command || b.id) + '</span><span class="cd-bg-time" title="Running for">' + esc(bgAge(b)) + '</span><button type="button" class="cd-bg-stop cd-bg-outbtn" data-bg-out="' + esc(b.id) + '" aria-expanded="' + (S.bgOut && S.bgOut.id === b.id ? 'true' : 'false') + '">' + (S.bgOut && S.bgOut.id === b.id ? 'Hide output' : 'Output') + '</button><button type="button" class="cd-bg-stop" data-bg-stop="' + esc(b.id) + '">Stop</button></div>' + bgOutHTML(b.id)).join('') + '</div>';
  }
  // ONE'S OUTPUT, OPENED FROM ITS ROW (like Claude Code's tasks list, where a background task shows its output): its last
  // lines, newest at the bottom, looked at again every few seconds while open, and the path of its output file (Coder was
  // told it; ask Coder to read it for the rest).
  function bgOutHTML(job) {
    const o = S.bgOut;
    if (!o || o.id !== job) return '';
    const body = o.error ? '<div class="cd-bg-outnote">' + esc(o.error) + '</div>'
      : !o.loaded ? '<div class="cd-bg-outnote">Loading…</div>'
      : (o.lines.length ? '<pre class="cd-bg-outlines">' + esc(o.lines.join('\n')) + '</pre>' : '<div class="cd-bg-outnote">No output yet.</div>');
    return '<div class="cd-bg-out">' + body + (o.file ? '<div class="cd-bg-file">Full output: <code>' + esc(o.file) + '</code></div>' : '') + '</div>';
  }
  function stopBgOut() { if (S.bgOutTimer) clearTimeout(S.bgOutTimer); S.bgOutTimer = 0; }
  async function bgOutTick() {
    stopBgOut();
    const o = S.bgOut, id = S.project && S.project.id;
    if (!o || !id) return;
    const r = await call('/projects/' + encodeURIComponent(id) + '/background?output=' + encodeURIComponent(o.id));
    if (S.bgOut !== o || !S.project || S.project.id !== id) return;
    if (r.status === 200 && r.data && r.data.ok) { o.lines = Array.isArray(r.data.lines) ? r.data.lines : []; o.file = String(r.data.file || ''); o.error = ''; }
    else o.error = (r.data && r.data.error) || 'Its output could not be read.';
    o.loaded = true;
    draw();
    const pre = S.root.querySelector('.cd-bg-outlines'); if (pre) pre.scrollTop = pre.scrollHeight;
    if (!o.error && bgList().some((b) => b.id === o.id)) S.bgOutTimer = setTimeout(bgOutTick, BG_OUT_POLL_MS);
  }
  function toggleBgOut(job) {
    stopBgOut();
    if (S.bgOut && S.bgOut.id === job) { S.bgOut = null; return draw(); }
    S.bgOut = { id: job, lines: [], file: '', loaded: false, error: '' };
    draw(); bgOutTick();
  }
  // While the chat is open and waits for the owner, its list is asked for now and then; a turn started to tell Coder (one
  // ended) is then followed like any.
  function stopBgWatch() { if (S.bgWatch) clearTimeout(S.bgWatch); S.bgWatch = 0; }
  // (Also while one ended and Coder is not told yet: the turn that tells it starts by itself, within a minute, and the
  // page follows it. Found while preparing the live test after deploy 75: with the list empty, the page stopped looking.)
  function startBgWatch() { stopBgWatch(); if (S.project && !S.running && (bgList().length || S.bgUntold > 0)) S.bgWatch = setTimeout(bgTick, BG_POLL_MS); }
  async function bgTick() {
    S.bgWatch = 0;
    if (!S.project || S.running) return;
    const id = S.project.id;
    const r = await call('/projects/' + encodeURIComponent(id) + '/background');
    if (!S.project || S.project.id !== id || S.running) return;
    if (r.status === 200 && r.data && r.data.ok) {
      S.background = r.data.background || [];
      S.bgUntold = Number(r.data.untold) || 0;
      if (r.data.project) S.project = r.data.project;
      if (r.data.running || (r.data.project && r.data.project.status === 'running')) return reloadChat(id);
      draw();
    }
    startBgWatch();
  }
  async function stopBg(job, btn) {
    const id = S.project && S.project.id;
    if (!id) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Stopping…'; }
    const r = await call('/projects/' + encodeURIComponent(id) + '/background', { method: 'POST', body: JSON.stringify({ id: job }) });
    if (!S.project || S.project.id !== id) return;
    // (Coder is told it was stopped, in a turn of its own: the page goes on looking until then.)
    if (r.status === 200 && r.data && r.data.ok) { S.background = (r.data.background || []).filter((b) => b.id !== job); S.bgUntold = Math.max(1, Number(r.data.untold) || 0); if (r.data.project) S.project = r.data.project; }
    else S.error = (r.data && r.data.error) || 'It could not be stopped.';
    draw(); startBgWatch();
  }

  // ── THE PERMISSION MODE (the owner, 2026-11-09: "lets build the permission things", with the Claude app's mode menu) ──
  // Claude Code's cloud sessions offer Auto, Accept edits and Plan, picked in a menu under the message box, "both when you
  // create the task and while the session runs"; its desktop app opens that menu with Cmd+Shift+M and picks with 1–9.
  const IS_MAC = /Mac|iPhone|iPad/.test(String(navigator.platform || navigator.userAgent || ''));
  const MODE_LIST = [
    { id: 'auto', name: 'Auto', info: 'Coder handles permission decisions', icon: 'auto' },
    { id: 'acceptEdits', name: 'Accept edits', info: 'Automatically accept all file edits', icon: 'edits' },
    { id: 'plan', name: 'Plan', info: 'Create a plan before making changes', icon: 'plan' },
  ];
  /** The chat's mode as it is now: a card's switch in the running job (Auto, an approved plan) counts until the job saves it. */
  function chatMode() {
    const p = S.project || {};
    let m = MODE_LIST.some((x) => x.id === p.mode) ? p.mode : 'auto';
    const sw = S.running ? S.events.filter((e) => e.type === 'mode' && (e.by === 'card' || e.by === 'plan')).at(-1) : null;
    if (sw && MODE_LIST.some((x) => x.id === sw.mode) && Number(sw.at || 0) > Number(p.modeAt || 0)) m = sw.mode;
    return m;
  }
  function modeHTML() {
    const cur = MODE_LIST.find((x) => x.id === chatMode()) || MODE_LIST[0];
    return '<div class="cd-mode-wrap">' +
      '<button type="button" class="cd-mode-btn is-' + cur.id + '" id="cdMode" aria-haspopup="menu" aria-expanded="' + (S.modeMenu ? 'true' : 'false') + '" title="Mode (' + (IS_MAC ? '⌘' : 'Ctrl') + '+Shift+M)">' + ICON[cur.icon] + '<span>' + esc(cur.name) + '</span>' + ICON.chev + '</button>' +
      (S.modeMenu ? '<div class="cd-modes" role="menu" aria-label="Mode">' + MODE_LIST.map((x, k) =>
        '<button type="button" role="menuitemradio" aria-checked="' + (x.id === cur.id) + '" class="cd-mode-row' + (x.id === cur.id ? ' is-on' : '') + '" data-mode="' + x.id + '">' +
          '<span class="cd-mode-ic">' + ICON[x.icon] + '</span><span class="cd-mode-t"><b>' + esc(x.name) + '</b><small>' + esc(x.info) + '</small></span>' +
          '<span class="cd-mode-ck">' + (x.id === cur.id ? '✓' : '') + '</span><kbd>' + (k + 1) + '</kbd></button>').join('') +
        '<div class="cd-modes-sep"></div><button type="button" class="cd-mode-rules" data-rules-open>Permission rules…</button></div>' : '') +
    '</div>';
  }
  async function setChatMode(m) {
    S.modeMenu = false;
    if (!S.project || !MODE_LIST.some((x) => x.id === m) || m === chatMode()) return draw();
    const was = { mode: S.project.mode, modeAt: S.project.modeAt };
    S.project = { ...S.project, mode: m, modeAt: Date.now() }; // shown at once
    draw();
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/mode', { method: 'POST', body: JSON.stringify({ mode: m }) });
    if (r.status === 200 && r.data && r.data.project) { S.project = { ...S.project, mode: r.data.project.mode, modeAt: r.data.project.modeAt }; if (m !== 'plan' && S.pick) S.pick.mode = m; }
    else { S.project = { ...S.project, ...was }; S.error = (r.data && r.data.error) || 'The mode could not be changed.'; }
    draw();
  }

  // ── A STEP WAITING ON THE OWNER (Claude Code's permission prompt: "Yes", "Yes, and don't ask again for …", "Yes, and
  // switch to auto mode", "No"; and its plan approval: "Yes, and use auto mode", the other mode, "No, keep planning").
  // The step waits in Coder's job until the answer comes (this page sends it: /answer); a note can go with it.
  const ruleShown = (r) => String(r).replace(/^Bash\(([\s\S]*)\)$/, '$1').replace(/^WebFetch\(domain:(.*)\)$/, '$1');
  const PERM_TITLE = { bash: 'Bash command', write: 'Write file', edit: 'Edit file', web_fetch: 'Fetch', pull_request: 'Pull request', pr_comments: 'Review comments', auto_fix: 'Auto-fix', undo_last_job: 'Undo' };
  function permOptions(e) {
    if (e.tool === 'plan') return [['auto', 'Yes, and use auto mode'], ['acceptEdits', 'Yes, and accept edits'], ['no', 'No, keep planning']];
    const o = [['yes', 'Yes']];
    if (Array.isArray(e.rules) && e.rules.length) o.push(['always', 'Yes, and don\'t ask again for ' + e.rules.map((r) => '<code>' + esc(ruleShown(r)) + '</code>').join(' and ')]);
    if (e.toAuto) o.push(['auto', 'Yes, and switch to auto mode']);
    o.push(['no', e.tool === 'web_fetch' ? 'No, and tell Coder what to do differently' : 'No']);
    return o;
  }
  function permDone(e, ans) {
    const c = ans.choice;
    const note = ans.comment ? ': “' + esc(ans.comment) + '”' : '';
    if (e.tool === 'plan') return c === 'auto' || c === 'acceptEdits' ? '<span class="cd-perm-ok">✓ Approved · ' + (c === 'auto' ? 'Auto' : 'Accept edits') + '</span>' + note : c === 'no' ? '<span class="cd-perm-no">Kept planning</span>' + note : '<span class="cd-perm-no">' + (c === 'stop' ? 'Stopped' : 'No answer') + '</span>';
    if (c === 'yes') return '<span class="cd-perm-ok">✓ Allowed</span>' + note;
    if (c === 'always') return '<span class="cd-perm-ok">✓ Allowed</span> · won\'t ask again for ' + (e.rules || []).map((r) => '<code>' + esc(ruleShown(r)) + '</code>').join(' and ');
    if (c === 'auto') return '<span class="cd-perm-ok">✓ Allowed</span> · switched to Auto';
    if (c === 'no') return '<span class="cd-perm-no">✕ Not allowed</span>' + note;
    return '<span class="cd-perm-no">' + (c === 'stop' ? 'Stopped' : 'No answer') + '</span>';
  }
  function permHTML(e) {
    const ans = S.events.find((x) => x.type === 'permanswer' && x.pid === e.pid);
    const live = S.running && !ans;
    const sent = S.permSent && S.permSent[e.pid];
    const plan = e.tool === 'plan';
    let body = '';
    // (A heading line with text right under it is a heading too: a plan is often written "## Context" then its lines.)
    if (plan) body = '<div class="cd-plan-body">' + prose(String(e.plan || '').replace(/^(#{1,4}[ \t]+.*)$/gm, '\n$1\n')) + '</div>';
    else if (e.tool === 'bash') {
      const lines = Array.isArray(e.lines) ? e.lines.filter((l) => typeof l === 'string').slice(0, 40) : [];
      body = (e.desc ? '<p class="cd-perm-desc">' + esc(e.desc) + '</p>' : '') + '<pre class="cd-perm-pre">' + esc(lines.join('\n')) + (Number(e.more) > 0 ? '\n… ' + Number(e.more) + ' more line' + (Number(e.more) === 1 ? '' : 's') : '') + '</pre>';
    } else if (e.tool === 'write' || e.tool === 'edit') {
      // What the write or edit would do, as under each write's and edit's step.
      const lines = e.change && Array.isArray(e.change.lines) ? e.change.lines.filter((l) => typeof l === 'string').slice(0, 40) : [];
      const more = e.change && Number(e.change.more) > 0 ? Number(e.change.more) : 0;
      const upd = !!(e.change && e.change.kind === 'update');
      body = '<p class="cd-perm-desc">' + esc(e.path || '') + '</p><pre class="cd-perm-pre">' + (!lines.length ? (upd ? '(nothing)' : '(an empty file)') : upd ? lines.map((l) => '<span class="cd-wl' + (l[0] === '+' ? ' cd-dl-add' : l[0] === '-' ? ' cd-dl-del' : '') + '">' + esc(l) + '</span>').join('') : lines.map((l, k) => '<span class="cd-ne-n">' + (k + 1) + '</span>' + esc(l.slice(1))).join('\n')) + (more ? '\n… ' + more + ' more line' + (more === 1 ? '' : 's') : '') + '</pre>';
    } else if (e.tool === 'web_fetch') body = '<pre class="cd-perm-pre">' + esc(e.url || '') + '</pre>';
    else body = '<p class="cd-perm-desc">' + esc(e.what || '') + '</p>';
    const opts = permOptions(e);
    const note = (S.permNotes && S.permNotes[e.pid]) || '';
    return '<div class="cd-perm' + (plan ? ' cd-plan' : '') + (live ? ' is-live' : '') + '" data-perm="' + esc(e.pid) + '" tabindex="-1">' +
      '<div class="cd-perm-head"><span class="cd-perm-ic">' + (plan ? ICON.plan : ICON.term) + '</span><b>' + (plan ? 'Coder\'s plan' : esc(PERM_TITLE[e.tool] || 'Coder asks')) + '</b></div>' +
      body +
      (!plan && e.why ? '<p class="cd-perm-why">' + esc(e.why) + '</p>' : '') +
      (live
        ? '<p class="cd-perm-q">' + (plan ? 'Would you like to proceed?' : 'Do you want to proceed?') + '</p>' +
          '<div class="cd-perm-opts">' + opts.map(([c, label], k) => '<button type="button" class="cd-perm-opt' + (c === 'no' ? ' is-no' : '') + (sent === c ? ' is-sent' : '') + '" data-perm-pid="' + esc(e.pid) + '" data-perm-choice="' + c + '"' + (sent ? ' disabled' : '') + '><kbd>' + (k + 1) + '</kbd><span>' + label + '</span></button>').join('') + '</div>' +
          '<input type="text" class="cd-perm-note" data-perm-note="' + esc(e.pid) + '" value="' + esc(note) + '" maxlength="2000" autocomplete="off" placeholder="' + (plan ? 'Tell Coder what to change (with No, keep planning)' : 'Add a note for Coder (optional)') + '"' + (sent ? ' disabled' : '') + '>' +
          (S.permErr && S.permErr.pid === e.pid ? '<p class="cd-secret-err">' + esc(S.permErr.text) + '</p>' : '')
        : ans ? '<div class="cd-perm-done">' + permDone(e, ans) + '</div>' : '') +
    '</div>' + (live ? '<div class="cd-ask-wait">' + (plan ? 'Waiting for your approval of the plan' : 'Waiting for your approval') + '</div>' : '');
  }
  async function answerPerm(pid, choice) {
    if (!S.project || (S.permSent && S.permSent[pid])) return;
    const comment = String((S.permNotes && S.permNotes[pid]) || '').trim().slice(0, 2000);
    S.permSent = { ...(S.permSent || {}), [pid]: choice };
    S.permErr = null;
    draw();
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/answer', { method: 'POST', body: JSON.stringify({ pid, choice, comment }) });
    if (r.status !== 200) { delete S.permSent[pid]; S.permErr = { pid, text: (r.data && r.data.error) || 'Your answer could not be sent. Try again.' }; }
    draw();
  }
  // THE OWNER'S RULES FOR THIS REPOSITORY (Claude Code's /permissions: its allow, ask and deny rules, added and removed there).
  async function showRules() {
    S.modeMenu = false; draw();
    if (!S.project) return;
    const repo = S.project.repo;
    let rules = { allow: [], ask: [], deny: [] }, err = '';
    const r = await call('/permissions?repo=' + encodeURIComponent(repo));
    if (r.status === 200 && r.data && r.data.rules) rules = r.data.rules; else err = (r.data && r.data.error) || 'The rules could not be loaded.';
    const wrap = document.createElement('div'); wrap.className = 'cd-sure';
    const box = document.createElement('div'); box.className = 'cd-sure-box cd-rules'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Permission rules');
    wrap.append(box); document.body.append(wrap);
    const close = () => { document.removeEventListener('keydown', key); wrap.remove(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    const KINDS = [['allow', 'Allow', 'runs without asking'], ['ask', 'Ask', 'always asks first, even in Auto'], ['deny', 'Deny', 'never runs']];
    const change = async (body) => {
      const x = await call('/permissions', { method: 'POST', body: JSON.stringify({ repo, ...body }) });
      if (x.status === 200 && x.data && x.data.rules) { rules = x.data.rules; err = ''; return true; }
      err = (x.data && x.data.error) || 'That rule could not be saved.';
      return false;
    };
    const paint = () => {
      box.innerHTML = '<div class="cd-sure-title">Permission rules</div>' +
        '<div class="cd-sure-text">For ' + esc(repo) + ', in all its chats. Deny rules come first, then ask, then allow, as in Claude Code. A rule looks like <code>Bash(npm test *)</code> (a <code>*</code> is any text), <code>Bash(git push *)</code>, or <code>WebFetch(domain:example.com)</code>.</div>' +
        KINDS.map(([k, name, info]) => '<div class="cd-rules-k"><div class="cd-rules-h"><b>' + name + '</b> <span>' + info + '</span></div>' + (rules[k].length ? '<ul>' + rules[k].map((x) => '<li><code>' + esc(x) + '</code><button type="button" data-rule-del="' + k + '" data-rule="' + esc(x) + '" aria-label="Remove ' + esc(x) + '">×</button></li>').join('') + '</ul>' : '<p class="cd-rules-none">None yet</p>') + '</div>').join('') +
        '<form class="cd-rules-add"><select aria-label="Kind">' + KINDS.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select><input type="text" placeholder="Bash(npm test *)" aria-label="Rule" maxlength="300" autocomplete="off" spellcheck="false"><button type="submit">Add</button></form>' +
        (err ? '<p class="cd-secret-err">' + esc(err) + '</p>' : '') +
        '<div class="cd-sure-row"><button type="button" class="cd-sure-yes" data-close>Done</button></div>';
      box.querySelector('[data-close]').onclick = close;
      box.querySelectorAll('[data-rule-del]').forEach((b) => { b.onclick = async () => { await change({ kind: b.dataset.ruleDel, remove: b.dataset.rule }); paint(); }; });
      const form = box.querySelector('.cd-rules-add');
      form.onsubmit = async (e) => { e.preventDefault(); const v = form.querySelector('input').value.trim(); if (!v) return; const ok = await change({ kind: form.querySelector('select').value, add: v }); paint(); if (!ok) { const i = box.querySelector('.cd-rules-add input'); i.value = v; i.focus(); } };
    };
    paint();
    const first = box.querySelector('.cd-rules-add input'); if (first) first.focus();
  }

  function composerHTML() {
    const busy = S.running || S.sending;
    const m = MODELS.find((x) => x.id === S.pick.model) || MODELS[0];
    return '<div class="cd-composewrap">' + bgHTML() + mentionHTML() + commentsHTML() + picsHTML() +
      '<form class="cd-compose' + (/^!/.test(S.draft || '') ? ' is-shell' : '') + '" id="cdForm">' +
        '<textarea id="cdIn" rows="1" placeholder="' + (busy ? 'Coder is working… you can close this tab' : 'Ask Coder to build, fix or explain something · @ for a file') + '">' + esc(S.draft) + '</textarea>' +
        '<button type="button" class="cd-attach" id="cdAttach" aria-label="Attach a picture" title="Attach a picture (or paste one)">' + ICON.clip + '</button><input type="file" id="cdFile" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>' +
        (S.running
          ? '<button type="submit" class="cd-send cd-queue-send" aria-label="Send (it waits for Coder)" title="Send: Coder reads it once its running steps finish"' + (S.sending ? ' disabled' : '') + '>' + ICON.send + '</button><button type="button" class="cd-send cd-stop" id="cdStop" aria-label="Stop">' + ICON.stop + '</button>'
          : '<button type="submit" class="cd-send" aria-label="Send"' + (S.sending ? ' disabled' : '') + '>' + ICON.send + '</button>') +
      '</form>' +
      // SHELL MODE (tool 4, part 3, like Claude Code's "! npm test"): the box says so while the message starts with "!".
      '<div class="cd-shellhint" role="note">Shell mode: runs this command on Coder\'s machine, then Coder answers what it printed · Tab completes</div>' +
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
        // THE PERMISSION MODE (the Claude app's: the mode's chip beside the model and effort, its menu above it).
        (S.project ? modeHTML() : '') +
      '</div>' +
    '</div>';
  }

  function centerHTML(inner) { return '<div class="cd-center">' + inner + '</div>'; }

  function bodyHTML() {
    if (S.phase === 'loading') return centerHTML('<span class="cd-spin cd-spin-lg"></span>');
    if (S.phase === 'off') return centerHTML('<b class="cd-title">Coder is not switched on yet.</b>');
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
        (empty ? '<div class="cd-empty"><b>What should we work on in ' + esc(S.project ? S.project.repo : '') + '?</b><p>Coder reads the code, runs commands in its own Linux machine, and saves its work to its own branch. Ask it for a pull request when you’re ready.</p>' +
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
    // THE BOX KEEPS ITS CURSOR AND SELECTION through a redraw (while Coder works the page redraws every 1.5 seconds, and a
    // message can be typed then: the queue); only when its text was changed for it does the cursor go to the end.
    const was = focus ? { v: document.activeElement.value, a: document.activeElement.selectionStart, b: document.activeElement.selectionEnd, d: document.activeElement.selectionDirection, top: document.activeElement.scrollTop } : null;
    root.innerHTML = '<div class="cd">' + (S.phase === 'chat' ? '' : '<div class="cd-head cd-head-min"><button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button></div>') + bodyHTML() + '</div>';
    drawSide();
    wire(root);
    const nlog = root.querySelector('#cdLog');
    if (nlog && (scroll || atBottom)) nlog.scrollTop = nlog.scrollHeight;
    if (focus) { const i = root.querySelector('#cdIn'); if (i) { i.focus(); if (was && i.value === was.v) { i.setSelectionRange(was.a, was.b, was.d || 'none'); i.scrollTop = was.top; } else i.setSelectionRange(i.value.length, i.value.length); } }
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
    on('.cd-wchg-more', 'click', (e) => { const k = e.currentTarget.dataset.change; S.open[k] = !S.open[k]; draw(); });
    on('.cd-probs-row', 'click', (e) => { const k = e.currentTarget.dataset.problems; S.open[k] = !S.open[k]; draw(); });
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
    on('[data-writeask-ok]', 'click', (e) => { const x = S.events[Number(e.currentTarget.dataset.writeaskOk)]; if (x && x.path) { e.currentTarget.disabled = true; send('I allowed Coder to change ' + x.path + '.'); } });
    on('[data-writeask-no]', 'click', (e) => { const x = S.events[Number(e.currentTarget.dataset.writeaskNo)]; if (x && x.path) { e.currentTarget.disabled = true; send('Don\'t change ' + x.path + '.'); } });
    // A COMMAND'S CARD: Allow sends the words Coder's app gave it (one "I allowed Coder to change …" line a file, or the
    // command's own "I allowed Coder to run command …"), checked again on the machine.
    on('[data-runask-ok]', 'click', (e) => { const x = S.events[Number(e.currentTarget.dataset.runaskOk)]; if (x && typeof x.allow === 'string' && /^(I allowed Coder to (change .+|run command [0-9a-f]{8})\.\n?)+$/.test(x.allow + '\n')) { e.currentTarget.disabled = true; send(x.allow); } });
    on('[data-bg-stop]', 'click', (e) => { stopBg(e.currentTarget.dataset.bgStop, e.currentTarget); });
    on('[data-bg-out]', 'click', (e) => { toggleBgOut(e.currentTarget.dataset.bgOut); });
    on('[data-unqueue]', 'click', async (e) => {
      const qid = e.currentTarget.dataset.unqueue, id = S.project && S.project.id;
      if (!id) return;
      // A WAITING ! COMMAND COMES BACK ONLY INTO AN EMPTY BOX, WITH NOTHING ELSE WAITING (Claude Code's "Take back what you
      // queued": "Claude Code takes back queued shell commands only when the input box is empty and you have nothing else
      // queued … Otherwise it leaves them in the queue … and runs them after the turn ends"). Back in the box, its "!" puts
      // the box in shell mode again.
      const waiting = queuedNow(), it = waiting.find((q) => q.qid === qid);
      if (it && it.shell && (String(S.draft || '').trim() || waiting.length > 1)) { S.error = SHELL_TAKEBACK; return draw(); }
      e.currentTarget.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(id) + '/queue', { method: 'POST', body: JSON.stringify({ remove: qid }) });
      if (!S.project || S.project.id !== id) return;
      if (r.status === 200 && r.data && r.data.ok) { S.queue = r.data.queue || []; S.draft = String(r.data.text || '') + (S.draft ? '\n' + S.draft : ''); S.error = ''; }
      else { S.error = (r.data && r.data.error) || 'It could not be taken back.'; if (r.data && Array.isArray(r.data.queue)) S.queue = r.data.queue; }
      draw();
      const i = S.root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
    on('[data-bg-move]', 'click', async (e) => {
      const b = e.currentTarget, id = S.project && S.project.id;
      if (!id) return;
      b.disabled = true; b.textContent = 'Moving…';
      const r = await call('/projects/' + encodeURIComponent(id) + '/background', { method: 'POST', body: JSON.stringify({ move: true }) });
      if (!(r.status === 200 && r.data && r.data.ok) && S.project && S.project.id === id) { S.error = (r.data && r.data.error) || 'It could not be moved.'; draw(); }
    });
    on('[data-runask-no]', 'click', (e) => { const x = S.events[Number(e.currentTarget.dataset.runaskNo)]; if (x) { e.currentTarget.disabled = true; send(x.kind === 'protected' && Array.isArray(x.paths) && x.paths.length ? 'Don\'t change ' + x.paths.join(', ') + '.' : 'Don\'t run that command.'); } });
    on('#cdSecretIn', 'input', (e) => { const b = document.querySelector('.cd-secret-save'); if (b) b.disabled = !e.currentTarget.value.trim(); });
    on('.cd-secret-no', 'click', (e) => { S.secretMsg = ''; send('I declined the secret for ' + e.currentTarget.dataset.secretNo + '.'); });
    on('.cd-secret-save', 'click', async (e) => {
      const d = e.currentTarget.dataset; const box = document.getElementById('cdSecretIn'); const value = box ? box.value.trim() : '';
      if (!value || !S.project) return;
      e.currentTarget.disabled = true;
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/secret', { method: 'POST', body: JSON.stringify({ host: d.secretHost, value, header: d.secretHeader, prefix: d.secretPrefix, name: d.secretName }) });
      if (box) box.value = '';
      if (r.status !== 200) { S.secretMsg = (r.data && r.data.error) || 'It could not be saved.'; return draw(); }
      S.secretMsg = ''; if (S.env) S.env.secrets = r.data.secrets;
      send('I saved the secret for ' + d.secretHost + '.');
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
    on('.cd-mention-i', 'mousedown', (e) => { e.preventDefault(); const f = e.currentTarget.dataset.file; return S.mention && S.mention.shell ? pickShellPath(f) : pickMention(f); });
    on('#cdChanges', 'click', () => { S.showChanges = !S.showChanges; if (S.showChanges) loadChanges(); draw(); });
    on('#cdCompare', 'change', (e) => { const v = e.currentTarget.value; S.compareAgainst = v === ((S.project && S.project.base) || 'main') ? '' : v; loadChanges(); });
    on('#cdModel', 'change', (e) => { const m = MODELS.find((x) => x.id === e.target.value) || MODELS[0]; S.pick = { model: m.id, effort: m.efforts.includes(S.pick.effort) ? S.pick.effort : m.effort }; savePick(); draw(); });
    on('#cdEffort', 'change', (e) => { S.pick.effort = e.target.value; savePick(); });
    // THE MODE MENU, AND THE CARDS A STEP WAITS ON (the permission modes): a click, or the card's number keys.
    on('#cdMode', 'click', (e) => { e.stopPropagation(); S.modeMenu = !S.modeMenu; draw(); });
    on('.cd-modes', 'click', (e) => e.stopPropagation());
    on('[data-mode]', 'click', (e) => setChatMode(e.currentTarget.dataset.mode));
    on('[data-rules-open]', 'click', () => showRules());
    on('[data-perm-choice]', 'click', (e) => answerPerm(e.currentTarget.dataset.permPid, e.currentTarget.dataset.permChoice));
    on('[data-perm-note]', 'input', (e) => { S.permNotes = { ...(S.permNotes || {}), [e.currentTarget.dataset.permNote]: e.currentTarget.value }; });
    on('[data-perm-note]', 'keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    on('.cd-perm.is-live', 'keydown', (e) => {
      if (e.target.matches && e.target.matches('input')) return;
      const opts = e.currentTarget.querySelectorAll('[data-perm-choice]');
      const k = Number(e.key);
      if (k >= 1 && k <= opts.length && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); opts[k - 1].click(); }
    });
    // A card that just came: in front, unless the owner is typing a message.
    const liveCard = root.querySelector('.cd-perm.is-live');
    if (liveCard && S.permFocus !== liveCard.dataset.perm) {
      S.permFocus = liveCard.dataset.perm;
      const box = root.querySelector('#cdIn');
      if (!box || !box.value) { try { liveCard.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
    }
    const form = root.querySelector('#cdForm');
    const input = root.querySelector('#cdIn');
    if (input) {
      grow(input);
      input.addEventListener('input', async () => {
        S.draft = input.value; grow(input);
        if (form) form.classList.toggle('is-shell', /^!/.test(input.value));
        const before = input.value.slice(0, input.selectionStart);
        const m = /(^|\s)@([\w./-]*)$/.exec(before);
        // In the ! box, a word with a / in it lists the paths that fit (Claude Code's "live file path autocomplete").
        const sp = !m && /^!/.test(input.value) ? /(^!\s*|\s)([\w.~@+-]*\/[\w./~@+-]*)$/.exec(before) : null;
        const had = mentionMatches().length;
        S.mention = m ? { at: before.length - m[2].length - 1, q: m[2] } : sp ? { at: before.length - sp[2].length, q: sp[2], shell: true } : null; S.mentionSel = 0;
        if (S.mention) await loadFiles();
        if (had || mentionMatches().length) { const pos = input.selectionStart; draw(); const i = S.root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
      });
      input.addEventListener('paste', (e) => { const files = [...(e.clipboardData && e.clipboardData.files || [])]; if (files.some((f) => /^image\//.test(f.type))) { e.preventDefault(); addPics(files); } });
      input.addEventListener('keydown', (e) => {
        const list = mentionMatches();
        if (list.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); S.mentionSel = ((S.mentionSel || 0) + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length; return draw(); }
        if (list.length && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) { e.preventDefault(); const pick = list[Math.min(S.mentionSel || 0, list.length - 1)]; return S.mention && S.mention.shell ? pickShellPath(pick) : pickMention(pick); }
        if (!list.length && e.key === 'Tab' && !e.shiftKey && /^!/.test(input.value) && input.selectionStart === input.value.length && shellTab(input)) { e.preventDefault(); if (form) form.classList.add('is-shell'); return; }
        if (list.length && e.key === 'Escape') { S.mention = null; return draw(); }
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
      });
    }
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); send(input && input.value); });
  }

  // ── THE HOOK chat.js CALLS ────────────────────────────────────────────────
  window.CoderView = {
    mount(el, side) {
      const first = !S.root;
      S.root = el;
      if (side) S.side = side;
      if (!S.pick) S.pick = { model: MODELS[0].id, effort: MODELS[0].effort };
      if (!S.menuCloser) { S.menuCloser = true; document.addEventListener('click', () => { if (S.reviewMenu || S.modeMenu) { S.reviewMenu = false; S.modeMenu = false; draw(); } }); }
      // THE MODE MENU FROM THE KEYBOARD (Claude Code's desktop app: Cmd+Shift+M "Open permission mode menu", 1–9 "Select item in an open menu").
      if (!S.modeKeys) {
        S.modeKeys = true;
        document.addEventListener('keydown', (e) => {
          if (S.phase !== 'chat' || !S.project || !S.root || !S.root.isConnected) return;
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'M' || e.key === 'm')) { e.preventDefault(); S.modeMenu = !S.modeMenu; return draw(); }
          if (!S.modeMenu) return;
          if (e.key === 'Escape') { S.modeMenu = false; return draw(); }
          const k = Number(e.key);
          if (k >= 1 && k <= MODE_LIST.length && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setChatMode(MODE_LIST[k - 1].id); }
        });
      }
      if (!S.notifyHook) { S.notifyHook = true; window.addEventListener('gf:notify', () => { showNotifications(); }); }
      const q = new URLSearchParams(location.search);
      if (q.has('github')) {
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
})();
