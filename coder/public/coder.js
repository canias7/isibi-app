// CODER'S SCREEN (2026-11-05, the owner: "just make it like Claude Code … more
// like a chat, more like a cursor"). Its own file, apart from the website
// the page (index.html), which hands it the space to draw in
// (`window.CoderView.mount`). Served by Coder's own Worker, same address.
(function () {
  'use strict';
  const API = '/api/coder';
  const POLL_MS = 1500;
  // THE MODEL PICKER (owner, 2026-11-05): each model with its effort levels.
  // The same list as container/coder-model.mjs; the Worker refuses others.
  const MODELS = [{ id: 'grok-4.7', name: 'Grok 4.7', efforts: ['low', 'medium', 'high'], effort: 'medium' }];
  const EFFORT_NAME = { low: 'Low effort', medium: 'Medium effort', high: 'High effort' };
  const PICK_KEY = 'gf_coder_model_v1';
  function savedPick() {
    let v = {}; try { v = JSON.parse(localStorage.getItem(PICK_KEY) || '{}') || {}; } catch (e) { v = {}; }
    const m = MODELS.find((x) => x.id === v.model) || MODELS[0];
    return { model: m.id, effort: m.efforts.includes(v.effort) ? v.effort : m.effort };
  }
  function savePick() { try { localStorage.setItem(PICK_KEY, JSON.stringify(S.pick)); } catch (e) {} }

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
    return showPicker();
  }

  async function showPicker() {
    S.phase = 'pick'; S.repos = null; draw();
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
    S.projects = [{ id: r.data.project.id, name: r.data.project.name, repo: r.data.project.repo, at: r.data.project.at }, ...S.projects];
    openProject(r.data.project.id);
  }

  async function openProject(id) {
    stopPoll();
    S.phase = 'chat'; S.project = null; S.events = []; S.next = 0; S.error = ''; draw();
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
    if (!text || !S.project || S.running || S.sending) return;
    S.sending = true; S.error = ''; S.draft = '';
    const base = S.events.length;
    S.events.push({ type: 'user', text, at: Date.now(), local: true });
    draw(true);
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/message', { method: 'POST', body: JSON.stringify({ text, model: S.pick.model, effort: S.pick.effort }) });
    S.sending = false;
    if (r.status !== 200) {
      S.events = S.events.slice(0, base);
      S.draft = text;
      S.error = (r.data && r.data.error) || 'The message was not sent.';
      if (r.data && r.data.connect) S.phase = 'connect';
      return draw();
    }
    S.project = r.data.project; S.running = true;
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
      draw(fresh.length > 0);
    }
    if (S.running) S.poll = setTimeout(tick, POLL_MS);
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
      : state === 'bad' ? '<span class="cd-bad">' + (r.timedOut ? 'timed out' : 'exit ' + esc(r.code)) + '</span>' : '';
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
    const stateOf = (e, i) => { const r = results[e.id]; return !r ? (S.running && i > lastUser ? 'run' : 'gone') : r.code === 0 ? 'ok' : 'bad'; };
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
    });
    flush();
    if (S.running && !S.events.slice(lastUser + 1).some((e) => e.type === 'bash' && !results[e.id])) out.push('<div class="cd-thinking"><span></span><span></span><span></span></div>');
    return out.join('');
  }

  function headHTML() {
    const p = S.project;
    const opts = S.projects.map((x) => '<option value="' + esc(x.id) + '"' + (p && p.id === x.id ? ' selected' : '') + '>' + esc(x.repo) + '</option>').join('');
    return '<div class="cd-head">' +
      '<label class="cd-proj">' + ICON.gh + '<select id="cdProject" aria-label="Project">' + opts + '<option value="+">+ Another repository…</option></select></label>' +
      (p ? '<span class="cd-branch">' + ICON.branch + esc(p.branch) + '</span>' : '') +
      (p && p.pr && p.pr.url ? '<a class="cd-pr" href="' + esc(p.pr.url) + '" target="_blank" rel="noopener">Pull request #' + esc(p.pr.number) + '</a>' : '') +
    '</div>';
  }

  function composerHTML() {
    const busy = S.running || S.sending;
    const m = MODELS.find((x) => x.id === S.pick.model) || MODELS[0];
    return '<div class="cd-composewrap">' +
      '<form class="cd-compose" id="cdForm">' +
        '<textarea id="cdIn" rows="1" placeholder="' + (busy ? 'Coder is working…' : 'Ask Coder to build, fix or explain something') + '">' + esc(S.draft) + '</textarea>' +
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
      return centerHTML('<b class="cd-title">Pick a repository</b>' +
        '<p class="cd-sub">Signed in as <b>' + esc(S.github && S.github.login) + '</b>. Coder will work on its own branch and never touch your main branch.</p>' +
        list +
        (install ? '<a class="cd-btn-2" href="' + esc(install) + '" target="_blank" rel="noopener">Add repositories on GitHub</a>' : '') +
        (S.projects.length ? '<button type="button" class="cd-link" id="cdBack">Back to my projects</button>' : '') +
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
    root.innerHTML = '<div class="cd">' + bodyHTML() + '</div>';
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
    on('#cdBack', 'click', () => S.projects[0] && openProject(S.projects[0].id));
    on('.cd-repo', 'click', (e) => addProject(e.currentTarget.dataset.repo));
    on('#cdProject', 'change', (e) => { const v = e.target.value; if (v === '+') showPicker(); else openProject(v); });
    on('.cd-cmd-row', 'click', (e) => { const k = e.currentTarget.dataset.step; S.open[k] = !S.open[k]; draw(); });
    on('.cd-group-head', 'click', (e) => { const k = e.currentTarget.dataset.group; S.open[k] = !S.open[k]; draw(); });
    on('.cd-start', 'click', (e) => send(e.currentTarget.dataset.answer));
    on('#cdStop', 'click', stop);
    on('#cdModel', 'change', (e) => { const m = MODELS.find((x) => x.id === e.target.value) || MODELS[0]; S.pick = { model: m.id, effort: m.efforts.includes(S.pick.effort) ? S.pick.effort : m.effort }; savePick(); draw(); });
    on('#cdEffort', 'change', (e) => { S.pick.effort = e.target.value; savePick(); });
    const form = root.querySelector('#cdForm');
    const input = root.querySelector('#cdIn');
    if (input) {
      grow(input);
      input.addEventListener('input', () => { S.draft = input.value; grow(input); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
    }
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); send(input && input.value); });
  }

  // ── THE HOOK chat.js CALLS ────────────────────────────────────────────────
  window.CoderView = {
    mount(el) {
      const first = !S.root;
      S.root = el;
      if (!S.pick) S.pick = savedPick();
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
    // For tests and screenshots only.
    _state: S,
  };
})();
