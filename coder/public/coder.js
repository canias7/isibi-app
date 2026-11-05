// CODER'S SCREEN (2026-11-05, the owner: "just make it like Claude Code … more
// like a chat, more like a cursor"). Its own file, apart from the website
// the page (index.html), which hands it the space to draw in
// (`window.CoderView.mount`). Served by Coder's own Worker, same address.
(function () {
  'use strict';
  const API = '/api/coder';
  const POLL_MS = 1500;
  // THE MODEL LIST, THE USER'S PICK AND THE SLASH COMMANDS come from the server
  // (2026-11-05: "put it server side"); the page only shows them.
  let MODELS = [{ id: 'grok-4.7', name: 'Grok 4.7', efforts: ['low', 'medium', 'high'], effort: 'medium' }];
  let COMMANDS = [];
  async function loadSettings() {
    const r = await call('/settings');
    if (r.status === 200 && r.data) {
      if (Array.isArray(r.data.models) && r.data.models.length) MODELS = r.data.models;
      if (r.data.pick) S.pick = r.data.pick;
      if (Array.isArray(r.data.commands)) COMMANDS = r.data.commands;
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
    draft: '',
    open: {},         // which command outputs are opened
    root: null,
    poll: 0,
    pick: null,
    openFiles: {},  // which files are open in See changes
    comments: [],   // [{ file, line, quote, text }] from See changes
    commenting: null, // { file, line, quote } while writing one
    slashSel: 0,
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function call(path, init) {
    const token = window.Auth && typeof window.Auth.accessToken === 'function' ? await window.Auth.accessToken() : null;
    if (!token) return { status: 401, data: { error: 'sign in first' } };
    let r;
    try {
      r = await fetch(API + path, { ...(init || {}), headers: { Authorization: 'Bearer ' + token, ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    } catch (e) { return { status: 0, data: { error: 'Coder could not be reached. Check your connection.' } }; }
    const data = await r.json().catch(() => ({}));
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
    if (S.projects.length) return openProject(S.projects[0].id);
    return showPicker('new');
  }

  async function showPicker(mode) {
    stopPoll(); S.pickMode = mode || 'new'; S.phase = 'pick'; S.repos = null; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); draw();
    const r = await call('/github/repos');
    if (r.data && r.data.connect) { S.phase = 'connect'; return draw(); }
    S.repos = (r.data && r.data.repos) || [];
    if (r.data && r.data.install && S.github) S.github.install = r.data.install;
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

  // THE CHAT LIST (each chat its own session): what the sidebar shows.
  const entryOf = (m) => ({ id: m.id, repo: m.repo, title: m.title || '', status: m.status || 'idle', pr: m.pr ? (m.pr.number || m.pr) : null, at: m.at });
  function syncEntry() {
    if (!S.project) return;
    const e = entryOf(S.project);
    const i = S.projects.findIndex((x) => x.id === e.id);
    if (i >= 0) S.projects[i] = { ...S.projects[i], ...e, title: e.title || S.projects[i].title };
  }
  async function removeChat(id) {
    const x = S.projects.find((p) => p.id === id);
    if (!x || !window.confirm('Remove "' + (x.title || 'New chat') + '" from your chats? Its branch and pull request stay on GitHub.')) return;
    const r = await call('/projects/' + encodeURIComponent(id), { method: 'DELETE' });
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'The chat could not be removed.'; return draw(); }
    S.projects = S.projects.filter((p) => p.id !== id);
    if (S.project && S.project.id === id) { stopPoll(); S.project = null; return S.projects.length ? openProject(S.projects[0].id) : showPicker('new'); }
    draw();
  }

  async function openProject(id) {
    stopPoll();
    S.phase = 'chat'; S.project = null; S.events = []; S.next = 0; S.error = ''; S.showChanges = false; S.changes = null; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); draw();
    const r = await call('/projects/' + encodeURIComponent(id));
    if (r.status !== 200) { S.error = (r.data && r.data.error) || 'The project could not be opened.'; return draw(); }
    S.project = r.data.project; S.events = r.data.events || [];
    S.running = S.project.status === 'running';
    draw(true);
    // A turn still running: its own steps come from the machine, after the saved ones.
    if (S.running) { S.next = 0; startPoll(); }
  }

  // ── A MESSAGE, THEN FOLLOWING THE WORK ────────────────────────────────────
  async function send(text) {
    text = String(text || '').trim();
    // A SLASH COMMAND runs here, in the page (no AI).
    if (text.startsWith('/')) { S.draft = ''; return runCommand(text); }
    // COMMENTS ON THE CHANGES go with the message; the server writes them in.
    const comments = S.comments.map((c) => ({ file: c.file, line: c.line, quote: c.quote, text: c.text }));
    if ((!text && !comments.length) || !S.project || S.running || S.sending) return;
    S.comments = [];
    S.sending = true; S.error = ''; S.draft = '';
    const base = S.events.length;
    S.events.push({ type: 'user', text: text || '(comments on the changes)', at: Date.now(), local: true });
    draw(true);
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/message', { method: 'POST', body: JSON.stringify({ text, comments, model: S.pick.model, effort: S.pick.effort }) });
    S.sending = false;
    if (r.status !== 200) {
      S.events = S.events.slice(0, base);
      S.draft = text;
      S.error = (r.data && r.data.error) || 'The message was not sent.';
      if (r.data && r.data.connect) S.phase = 'connect';
      return draw();
    }
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
    const r = await call('/projects/' + encodeURIComponent(id) + '/state?since=' + S.next);
    if (!S.project || S.project.id !== id) return;
    if (r.status === 200 && r.data) {
      // The message shown when it was sent is not drawn twice.
      const fresh = (r.data.events || []).filter((e) => {
        if (e.type !== 'user') return true;
        const mine = S.events.find((x) => x.local && x.text === e.text);
        if (mine) { mine.local = false; return false; }
        return true;
      });
      if (fresh.length) S.events = S.events.concat(fresh);
      S.next = r.data.next || S.next;
      if (r.data.project) S.project = r.data.project;
      S.running = !!r.data.running;
      syncEntry();
      draw(fresh.length > 0);
    }
    if (S.running) S.poll = setTimeout(tick, POLL_MS);
  }

  async function loadChanges() {
    if (!S.project) return;
    S.changes = null;
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/changes');
    S.changes = r.status === 200 && r.data && Array.isArray(r.data.files) ? r.data : { files: [], add: 0, del: 0 };
    draw();
  }
  async function stop() {
    if (!S.project) return;
    await call('/projects/' + encodeURIComponent(S.project.id) + '/stop', { method: 'POST' });
  }

  // ── DRAWING ───────────────────────────────────────────────────────────────
  const ICON = {
    gh: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    term: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l6-5-6-5M12 19h8"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    branch: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/></svg>',
  };

  // Light formatting for what the AI writes: `code`, ``` blocks, links.
  function prose(t) {
    const parts = String(t || '').split(/```[a-zA-Z0-9_-]*\n?/);
    return parts.map((p, i) => i % 2
      ? '<pre class="cd-pre">' + esc(p.replace(/\n$/, '')) + '</pre>'
      : '<p>' + esc(p.trim()).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
    ).join('').replace(/<p><\/p>/g, '');
  }

  // ONE COMMAND as a quiet line, "Ran <command> ▸", like the Claude app
  // (owner, 2026-11-05: "look at the frontend of this"). Tap it for the output.
  function cmdHTML(e, r, state, key) {
    const open = !!S.open[key];
    const verb = state === 'run' ? 'Running' : 'Ran';
    const tail = state === 'run' ? '<span class="cd-spin" aria-label="running"></span>'
      : state === 'bad' ? '<span class="cd-bad">' + (r.timedOut ? 'timed out' : 'exit ' + esc(r.code)) + '</span>'
      : state === 'bg' ? '<span class="cd-bgchip">running in the background</span>' : '';
    return '<div class="cd-cmd is-' + state + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="cd-cmd-row" data-step="' + esc(key) + '"' + (r ? '' : ' disabled') + '>' +
        '<span class="cd-cmd-verb">' + verb + '</span> <code class="cd-cmd-text">' + esc(e.command.split('\n')[0]) + '</code>' +
        (r ? '<span class="cd-caret">' + (open ? '▾' : '▸') + '</span>' : '') + tail +
      '</button>' +
      (open && r ? '<pre class="cd-out">' + esc(r.output || '(no output)') + '</pre>' : '') +
    '</div>';
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
        const bad = group.some(([e, i]) => stateOf(e, i) === 'bad');
        out.push('<div class="cd-group' + (shut ? ' is-shut' : '') + '">' +
          '<button type="button" class="cd-group-head" data-group="' + esc(gk) + '">Ran ' + group.length + ' commands <span class="cd-caret">' + (shut ? '▸' : '▾') + '</span>' + (bad ? '<span class="cd-bad">a command failed</span>' : '') + '</button>' +
          (shut ? '' : '<div class="cd-group-box">' + group.map(([e, i]) => cmdHTML(e, results[e.id], stateOf(e, i), String(e.id || i))).join('') + '</div>') +
        '</div>');
      }
      group = [];
    };
    S.events.forEach((e, i) => {
      if (e.type === 'bash') { group.push([e, i]); return; }
      if (e.type === 'result') return;
      flush();
      if (e.type === 'user') out.push('<div class="cd-user"><div class="cd-bubble">' + esc(e.text) + '</div></div>');
      else if (e.type === 'text' || e.type === 'done') out.push('<div class="cd-ai">' + prose(e.text) + '</div>');
      else if (e.type === 'github') out.push('<div class="cd-gh">' + ICON.gh + '<span>' + prose(e.text).replace(/^<p>|<\/p>$/g, '') + '</span></div>');
      else if (e.type === 'error') out.push('<div class="cd-err">' + esc(e.text) + '</div>');
      else if (e.type === 'stopped') out.push('<div class="cd-note">Stopped.</div>');
      else if (e.type === 'note') out.push('<div class="cd-localnote">' + esc(e.text) + '</div>');
    });
    flush();
    if (S.running && !S.events.slice(lastUser + 1).some((e) => e.type === 'bash' && !results[e.id])) out.push('<div class="cd-thinking"><span></span><span></span><span></span></div>');
    return out.join('');
  }

  // THE CHAT'S OWN BAR: its title, repository and branch, the pull request,
  // See changes. ☰ opens the chats on a phone.
  function headHTML() {
    const p = S.project;
    const title = p ? (p.title || 'New chat') : '';
    return '<div class="cd-head">' +
      '<button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button>' +
      (p ? '<b class="cd-title-bar">' + esc(title) + '</b><span class="cd-repo-bar">' + ICON.gh + esc(p.repo) + '</span>' : '') +
      (p ? '<span class="cd-branch">' + ICON.branch + esc(p.branch) + '</span>' : '') +
      (p && p.pr && p.pr.url ? '<a class="cd-pr" href="' + esc(p.pr.url) + '" target="_blank" rel="noopener">Pull request #' + esc(p.pr.number) + '</a>' : '') +
      (p ? '<button type="button" class="cd-hbtn" id="cdChanges"' + (S.showChanges ? ' aria-pressed="true"' : '') + '>See changes</button>' : '') +
    '</div>' +
    (S.showChanges ? changesHTML() : '');
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
    if (!c) return '<div class="cd-changes"><span class="cd-spin"></span></div>';
    if (!c.files.length) return '<div class="cd-changes"><p class="cd-changes-none">No changes yet.</p></div>';
    return '<div class="cd-changes">' +
      '<div class="cd-changes-sum">' + c.files.length + ' file' + (c.files.length === 1 ? '' : 's') + ' changed <span class="cd-add">+' + c.add + '</span> <span class="cd-del">−' + c.del + '</span></div>' +
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

  // SLASH COMMANDS: the list comes from the server (loadSettings), and so does the work.
  function slashMatches(draft) {
    const m = /^\/(\S*)$/.exec(draft || '');
    if (!m) return [];
    return COMMANDS.filter((c) => c.name.startsWith(m[1].toLowerCase()));
  }
  function note(text) { S.events.push({ type: 'note', text, at: Date.now(), local: true }); draw(true); }
  async function runCommand(text) {
    const r = await call('/command', { method: 'POST', body: JSON.stringify({ text, project: S.project ? S.project.id : '' }) });
    const d = r.data || {};
    if (r.status !== 200) return note(d.error || 'The command did not work.');
    if (d.pick) S.pick = d.pick;
    if (d.open === 'new') return showPicker('new');
    if (d.open === 'repos') return showPicker('repos');
    if (d.open === 'changes') { S.showChanges = !S.showChanges; if (S.showChanges) loadChanges(); return draw(); }
    if (d.open === 'remove' && S.project) return removeChat(S.project.id);
    if (d.url) window.open(d.url, '_blank', 'noopener');
    if (d.note) return note(d.note);
    draw();
  }
  function slashHTML() {
    const list = slashMatches(S.draft);
    if (!list.length) return '';
    const sel = Math.min(S.slashSel, list.length - 1);
    return '<div class="cd-slash" role="listbox">' + list.map((c, i) => '<button type="button" class="cd-slash-item' + (i === sel ? ' on' : '') + '" data-cmd="' + c.name + '" role="option"><b>/' + c.name + '</b>' + (c.arg ? ' <span class="cd-slash-arg">' + c.arg + '</span>' : '') + '<span class="cd-slash-hint">' + esc(c.hint) + '</span></button>').join('') + '</div>';
  }
  function commentsHTML() {
    if (!S.comments.length) return '';
    return '<div class="cd-chips">' + S.comments.map((c, i) => '<span class="cd-chip" title="' + esc(c.quote) + '">💬 ' + esc(c.file.split('/').pop()) + (c.line ? ':' + c.line : '') + ' — ' + esc(c.text.slice(0, 40)) + '<button type="button" data-uncomment="' + i + '" aria-label="Remove comment">×</button></span>').join('') + '</div>';
  }

  function composerHTML() {
    const busy = S.running || S.sending;
    const m = MODELS.find((x) => x.id === S.pick.model) || MODELS[0];
    return '<div class="cd-composewrap">' + slashHTML() + commentsHTML() +
      '<form class="cd-compose" id="cdForm">' +
        '<textarea id="cdIn" rows="1" placeholder="' + (busy ? 'Coder is working…' : 'Ask Coder to build, fix or explain something · / for commands') + '">' + esc(S.draft) + '</textarea>' +
        (S.running
          ? '<button type="button" class="cd-send cd-stop" id="cdStop" aria-label="Stop">' + ICON.stop + '</button>'
          : '<button type="submit" class="cd-send" aria-label="Send"' + (S.sending ? ' disabled' : '') + '>' + ICON.send + '</button>') +
      '</form>' +
      '<div class="cd-picks">' +
        '<label class="cd-pick" title="Model"><select id="cdModel" aria-label="Model">' + MODELS.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === m.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
        '<label class="cd-pick" title="Effort"><select id="cdEffort" aria-label="Effort">' + m.efforts.map((e) => '<option value="' + e + '"' + (e === S.pick.effort ? ' selected' : '') + '>' + e[0].toUpperCase() + e.slice(1) + '</option>').join('') + '</select></label>' +
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
      '<p class="cd-sub">Coder works on your code in your own GitHub. You choose which repositories it can use, and it sends its work as a pull request for you to review.</p>' +
      '<button type="button" class="cd-btn" id="cdConnect">' + ICON.gh + ' Connect GitHub</button>' +
      (S.error ? '<p class="cd-errline">' + esc(S.error) + '</p>' : ''));
    if (S.phase === 'pick') {
      const install = S.github && S.github.install;
      const list = S.repos === null ? '<span class="cd-spin cd-spin-lg"></span>'
        : S.repos.length ? '<div class="cd-repos">' + S.repos.map((r) => '<button type="button" class="cd-repo" data-repo="' + esc(r.repo) + '">' + ICON.gh + '<span>' + esc(r.repo) + '</span>' + (r.private ? '<em>private</em>' : '') + '</button>').join('') + '</div>'
        : '<p class="cd-sub">Coder can’t see any repositories yet.</p>';
      return centerHTML('<b class="cd-title">' + (S.pickMode === 'repos' ? 'Your repositories' : 'New chat: pick a repository') + '</b>' +
        '<p class="cd-sub">Signed in as <b>' + esc(S.github && S.github.login) + '</b>. Coder will work on its own branch and never touch your main branch.</p>' +
        list +
        (install ? '<a class="cd-btn-2" href="' + esc(install) + '" target="_blank" rel="noopener">Add repositories on GitHub</a>' : '') +
        (S.error ? '<p class="cd-errline">' + esc(S.error) + '</p>' : ''));
    }
    // chat
    const empty = !S.events.length && !S.running;
    return headHTML() +
      '<div class="cd-log" id="cdLog">' +
        (empty ? '<div class="cd-empty"><b>What should we work on in ' + esc(S.project ? S.project.repo : '') + '?</b><p>Coder reads the code, runs commands in its own Linux machine, and opens a pull request when it’s done.</p>' +
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
    root.innerHTML = '<div class="cd">' + (S.phase === 'chat' ? '' : '<div class="cd-head cd-head-min"><button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰</button></div>') + bodyHTML() + '</div>';
    drawSide();
    wire(root);
    const nlog = root.querySelector('#cdLog');
    if (nlog && (scroll || atBottom)) nlog.scrollTop = nlog.scrollHeight;
    if (focus) { const i = root.querySelector('#cdIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }

  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }

  function wire(root) {
    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
    on('#cdRetry', 'click', load);
    on('#cdConnect', 'click', connect);
    on('.cd-repo', 'click', (e) => addProject(e.currentTarget.dataset.repo));
    on('#cdMenu', 'click', () => window.dispatchEvent(new CustomEvent('gf:side', { detail: true })));
    on('.cd-cmd-row', 'click', (e) => { const k = e.currentTarget.dataset.step; S.open[k] = !S.open[k]; draw(); });
    on('.cd-group-head', 'click', (e) => { const k = e.currentTarget.dataset.group; S.open[k] = !S.open[k]; draw(); });
    on('.cd-start', 'click', (e) => send(e.currentTarget.dataset.answer));
    on('#cdStop', 'click', stop);
    on('.cd-slash-item', 'click', (e) => { const c = COMMANDS.find((x) => x.name === e.currentTarget.dataset.cmd); if (c && c.arg) { S.draft = '/' + c.name + ' '; draw(); } else send('/' + e.currentTarget.dataset.cmd); });
    on('.cd-file', 'toggle', (e) => { S.openFiles[e.currentTarget.dataset.path] = e.currentTarget.open; });
    on('.cd-dl', 'click', (e) => { const d = e.currentTarget.dataset; S.commenting = { file: d.file, line: Number(d.line) || 0, idx: Number(d.idx), quote: e.currentTarget.textContent.replace(/^[+ -]/, '').trim() }; draw(); const i = root.querySelector('#cdCommentIn'); if (i) i.focus(); });
    const addComment = () => { const i = root.querySelector('#cdCommentIn'); const v = i && i.value.trim(); if (v && S.commenting) S.comments.push({ ...S.commenting, text: v }); S.commenting = null; draw(); };
    on('#cdCommentAdd', 'click', addComment);
    on('#cdCommentIn', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(); } if (e.key === 'Escape') { S.commenting = null; draw(); } });
    on('#cdCommentX', 'click', () => { S.commenting = null; draw(); });
    on('[data-uncomment]', 'click', (e) => { S.comments.splice(Number(e.currentTarget.dataset.uncomment), 1); draw(); });
    on('#cdChanges', 'click', () => { S.showChanges = !S.showChanges; if (S.showChanges) loadChanges(); draw(); });
    on('#cdModel', 'change', (e) => { const m = MODELS.find((x) => x.id === e.target.value) || MODELS[0]; S.pick = { model: m.id, effort: m.efforts.includes(S.pick.effort) ? S.pick.effort : m.effort }; savePick(); draw(); });
    on('#cdEffort', 'change', (e) => { S.pick.effort = e.target.value; savePick(); });
    const form = root.querySelector('#cdForm');
    const input = root.querySelector('#cdIn');
    if (input) {
      grow(input);
      input.addEventListener('input', () => { const was = slashMatches(S.draft).length; S.draft = input.value; S.slashSel = 0; grow(input); if (was || slashMatches(S.draft).length) draw(); });
      input.addEventListener('keydown', (e) => {
        const list = slashMatches(S.draft);
        if (list.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); S.slashSel = (S.slashSel + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length; return draw(); }
        if (list.length && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
          const c = list[Math.min(S.slashSel, list.length - 1)];
          if (c.arg) { e.preventDefault(); S.draft = '/' + c.name + ' '; return draw(); }
          e.preventDefault(); return send('/' + c.name);
        }
        if (e.key === 'Escape' && list.length) { S.draft = ''; return draw(); }
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
