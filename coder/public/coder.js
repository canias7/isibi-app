// CODER'S SCREEN (2026-11-05, the owner: "just make it like Claude Code … more
// like a chat, more like a cursor"). Its own file, apart from the website
// the page (index.html), which hands it the space to draw in
// (`window.CoderView.mount`). Served by Coder's own Worker, same address.
(function () {
  'use strict';
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
    open: {},         // which command outputs are opened
    root: null,
    poll: 0,
    pick: null,
    openFiles: {},  // which files are open in See changes
    comments: [],   // [{ file, line, quote, text }] from See changes
    commenting: null, // { file, line, quote } while writing one
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
  // UNDO THE LAST JOB (owner, 2026-11-05): Coder's own "are you sure?", then the server reverts it.
  // REVIEW (owner, 2026-11-05): the server writes the review request; Coder only reads and reports.

  // THE REPO'S ENVIRONMENT (owner, 2026-11-05, "14"): setup script + variables, kept on the server.
  // THE REPO'S ENVIRONMENT (owner, 2026-11-06: "make similar" to Claude Code's
  // "Edit cloud environment"): four rows, each with its own page.
  async function loadEnv() {
    if (!S.project) return;
    S.env = null; S.envMsg = ''; S.envPage = 'main'; S.envForm = null;
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/env');
    S.env = r.status === 200 && r.data ? r.data : { script: '', vars: [], varsText: '', secrets: [], network: { mode: 'full', hosts: [] } };
    draw();
  }
  async function envPost(body, done) {
    S.envBusy = true; S.envMsg = ''; draw();
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/env', { method: 'POST', body: JSON.stringify(body) });
    S.envBusy = false;
    if (r.status === 200 && r.data) { S.env = r.data; S.envPage = done || 'main'; S.envForm = null; }
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
      body = head('Environment for ' + (e.repo || S.project.repo)) + '<div class="cd-em-rows">' + rows.map((r) => '<button type="button" class="cd-em-row" data-envgo="' + r[0] + '"><span><b>' + r[1] + '</b><small>' + esc(r[2]) + '</small></span><span aria-hidden="true">›</span></button>').join('') + '</div>';
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
      : page === 'script' ? { text: e.script || '' } : page === 'vars' ? { text: e.varsText || '' } : null;
    draw();
  }
  async function envYes() {
    const page = S.envPage, f = S.envForm;
    if (page === 'network') return envPost({ network: { mode: f.mode, hosts: f.hosts, defaults: f.defaults } });
    if (page === 'script') return envPost({ script: f.text });
    if (page === 'vars') return envPost({ varsText: f.text });
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
    // COMMENTS ON THE CHANGES go with the message; the server writes them in.
    const comments = S.comments.map((c) => ({ file: c.file, line: c.line, quote: c.quote, text: c.text }));
    const pics = (S.pics || []).slice();
    if ((!text && !comments.length && !pics.length) || !S.project || S.running || S.sending) return;
    S.comments = []; S.pics = []; S.mention = null;
    S.sending = true; S.error = ''; S.draft = '';
    const base = S.events.length;
    S.events.push({ type: 'user', text: text || (pics.length ? '(see the picture)' : '(comments on the changes)'), at: Date.now(), local: true, ...(pics.length ? { images: pics.length, thumbs: pics.map((x) => x.url) } : {}) });
    draw(true);
    const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/message', { method: 'POST', body: JSON.stringify({ text, comments, images: pics.map((x) => ({ type: x.type, data: x.data })), model: S.pick.model, effort: S.pick.effort }) });
    S.sending = false;
    if (r.status !== 200) {
      S.events = S.events.slice(0, base);
      S.draft = text; S.pics = pics;
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
    // AFTER ERRORS THE PAGE ASKS LESS OFTEN (the audit), and says so after a few.
    if (r.status !== 200) {
      S.fails = (S.fails || 0) + 1;
      if (S.fails === 5) { S.events = S.events.concat([{ at: Date.now(), type: 'error', text: "Coder's machine is not answering. Still trying…" }]); draw(true); }
      if (S.running) S.poll = setTimeout(tick, Math.min(POLL_MS * Math.pow(2, S.fails), 30000));
      return;
    }
    S.fails = 0;
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
    globe: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
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
    web_fetch: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20', web_search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    setup: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  };
  function stepIcon(e) {
    const k = e.tool === 'monitor' ? 'monitor_job' : e.tool && STEP_ICON[e.tool] ? e.tool : 'bash';
    return '<span class="cd-sic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + STEP_ICON[k] + '"/></svg></span>';
  }
  function cmdHTML(e, r, state, key) {
    const open = !!S.open[key];
    // File and web tools say what they did: Read, Edited, Wrote, Searched… (2026-11-05).
    const verb = e.verb ? (state === 'run' ? e.verb.replace(/^Read$/, 'Reading').replace(/^Wrote$/, 'Writing').replace(/^Edited$/, 'Editing').replace(/^Searched/, 'Searching').replace(/^Found$/, 'Finding').replace(/^Fetched$/, 'Fetching') : e.verb) : state === 'run' ? 'Running' : 'Ran';
    const tail = state === 'run' ? '<span class="cd-st"><span class="cd-spin" aria-label="working"></span></span>'
      : state === 'bad' ? '<span class="cd-st cd-st-bad">✕ ' + (r.timedOut ? 'timed out' : e.tool ? 'error' : 'exit ' + esc(r.code)) + '</span>'
      : state === 'bg' ? '<span class="cd-st cd-st-bg"><i></i>running</span>'
      : state === 'ok' ? '<span class="cd-st cd-st-ok" aria-label="done">✓</span>' : '';
    return '<div class="cd-cmd is-' + state + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="cd-cmd-row" data-step="' + esc(key) + '"' + (r ? '' : ' disabled') + '>' +
        stepIcon(e) + '<span class="cd-cmd-verb">' + verb + '</span> <code class="cd-cmd-text">' + esc(e.command.split('\n')[0]) + '</code>' +
        tail +
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
          '<button type="button" class="cd-group-head" data-group="' + esc(gk) + '">' + (group.every(([g]) => !g.tool) ? 'Ran ' + group.length + ' commands' : group.length + ' steps') + ' <span class="cd-caret">' + (shut ? '▸' : '▾') + '</span>' + (bad ? '<span class="cd-bad">a command failed</span>' : '') + '</button>' +
          (shut ? '' : '<div class="cd-group-box">' + group.map(([e, i]) => cmdHTML(e, results[e.id], stateOf(e, i), String(e.id || i))).join('') + '</div>') +
        '</div>');
      }
      group = [];
    };
    S.events.forEach((e, i) => {
      if (e.type === 'bash') { group.push([e, i]); return; }
      if (e.type === 'result') return;
      flush();
      if (e.type === 'user') out.push('<div class="cd-user">' + (e.thumbs && e.thumbs.length ? '<div class="cd-thumbs">' + e.thumbs.map((u) => '<img src="' + esc(u) + '" alt="">').join('') + '</div>' : e.images ? '<div class="cd-imgnote">' + esc(e.images) + ' picture' + (e.images > 1 ? 's' : '') + '</div>' : '') + '<div class="cd-bubble">' + esc(e.text) + '</div></div>');
      else if (e.type === 'text' || e.type === 'done') out.push('<div class="cd-ai">' + prose(e.text) + '</div>');
      else if (e.type === 'github') out.push('<div class="cd-gh">' + ICON.gh + '<span>' + prose(e.text).replace(/^<p>|<\/p>$/g, '') + '</span></div>');
      else if (e.type === 'error') out.push('<div class="cd-err">' + esc(e.text) + '</div>');
      else if (e.type === 'question') {
        // CODER'S QUESTION (the ask_user tool): the options are buttons, live only on the last one.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        out.push('<div class="cd-ask"><div class="cd-ask-q">' + esc(e.text) + '</div><div class="cd-ask-opts">' + (e.options || []).map((o) => '<button type="button" class="cd-ask-opt" data-answer="' + esc(o) + '"' + (live ? '' : ' disabled') + '>' + esc(o) + '</button>').join('') + '</div></div>');
      }
      else if (e.type === 'envchange') {
        // AN ENVIRONMENT CHANGE CODER PROPOSES (owner, 2026-11-06, like Claude Code): shown exactly, approved here.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        const host = e.kind === 'allow_host';
        out.push('<div class="cd-secret cd-envchange"><div class="cd-secret-icon">' + (host ? ICON.globe : ICON.term) + '</div><b class="cd-secret-t">' + (host ? 'Allow Coder to reach ' + esc(e.host) + '?' : 'Update this repo\'s setup script?') + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          (host ? '<p class="cd-secret-p">Adds ' + esc(e.host) + ' to the sites Coder may reach in ' + esc(S.project ? S.project.repo : 'this repo') + '. You can remove it in Environment.</p>'
            : '<p class="cd-secret-p">The whole new script, run once on Coder\'s machine before it starts (it cannot read your variables or keys):</p><pre class="cd-envchange-pre">' + esc(e.script) + '</pre>') +
          (live ? (S.envChangeMsg ? '<p class="cd-secret-err">' + esc(S.envChangeMsg) + '</p>' : '') + '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-envchange-no="' + i + '">Decline</button><button type="button" class="cd-secret-save" data-envchange-ok="' + i + '">Approve</button></div>' : '') + '</div>');
      }
      else if (e.type === 'secret') {
        // A KEY FOR ONE HOST (owner, 2026-11-06, like Claude Code's card): typed here, sealed on the server, added by the proxy; Coder never sees it.
        const live = !S.running && !S.events.slice(i + 1).some((x) => x.type === 'user');
        out.push('<div class="cd-secret"><div class="cd-secret-icon">' + ICON.lock + '</div><b class="cd-secret-t">Coder needs a secret for ' + esc(e.host) + '</b>' +
          (e.reason ? '<p class="cd-secret-why">' + esc(e.reason) + '</p>' : '') +
          '<p class="cd-secret-how">Sent as <code>' + esc(e.header || 'Authorization') + ': ' + esc(e.prefix == null ? 'Bearer ' : (e.prefix ? e.prefix + ' ' : '')) + '&lt;your key&gt;</code></p>' +
          '<p class="cd-secret-p">This secret is saved for ' + esc(S.project ? S.project.repo : 'this repo') + '. Coder\'s commands in that repo can use it and reach ' + esc(e.host) + '. It\'s kept secure: Coder never sees it, and it\'s only sent to ' + esc(e.host) + '.</p>' +
          (live ? '<label class="cd-secret-l" for="cdSecretIn">' + esc(e.name || 'Token') + '</label><input id="cdSecretIn" class="cd-secret-in" type="password" autocomplete="off" spellcheck="false">' +
            (S.secretMsg ? '<p class="cd-secret-err">' + esc(S.secretMsg) + '</p>' : '') +
            '<div class="cd-secret-btns"><button type="button" class="cd-secret-no" data-secret-no="' + esc(e.host) + '">Decline</button><button type="button" class="cd-secret-save" data-secret-host="' + esc(e.host) + '" data-secret-header="' + esc(e.header || 'Authorization') + '" data-secret-prefix="' + esc(e.prefix == null ? 'Bearer' : e.prefix) + '" data-secret-name="' + esc(e.name || '') + '" disabled>Save</button></div>'
          : '') + '</div>');
      }
      else if (e.type === 'todo') { if (S.events.slice(i + 1).some((x) => x.type === 'todo')) return; out.push('<div class="cd-todo"><b>Plan</b>' + (e.items || []).map((x) => '<div class="cd-todo-i is-' + esc(x.status) + '"><span class="cd-todo-box">' + (x.status === 'done' ? '✓' : x.status === 'in_progress' ? '•' : '') + '</span>' + esc(x.text) + '</div>').join('') + '</div>'); }
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
      (p ? '<b class="cd-title-bar" title="' + esc(title) + '">' + esc(title) + '</b><span class="cd-repo-bar" title="' + esc(p.repo) + '">' + ICON.gh + '<span class="cd-ell">' + esc(p.repo) + '</span></span>' : '') +
      (p ? '<span class="cd-branch" title="' + esc(p.branch) + '">' + ICON.branch + '<span class="cd-ell">' + esc(p.branch) + '</span></span>' : '') +
      (p && p.pr && p.pr.url ? '<a class="cd-pr" href="' + esc(p.pr.url) + '" target="_blank" rel="noopener">Pull request #' + esc(p.pr.number) + '</a><button type="button" class="cd-hbtn cd-autofix' + (p.autofix === false ? '' : ' on') + '" id="cdAutofix" title="When a check fails or you review the pull request, Coder fixes it (up to 3 tries in a row)">Auto-fix: ' + (p.autofix === false ? 'Off' : 'On') + '</button>' : '') +
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
    const q = S.mention.q.toLowerCase();
    return S.files.list.filter((p) => p.toLowerCase().includes(q)).sort((a, b) => (a.toLowerCase().startsWith(q) ? 0 : 1) - (b.toLowerCase().startsWith(q) ? 0 : 1) || a.length - b.length).slice(0, 8);
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
        '<textarea id="cdIn" rows="1" placeholder="' + (busy ? 'Coder is working…' : 'Ask Coder to build, fix or explain something · @ for a file') + '">' + esc(S.draft) + '</textarea>' +
        '<button type="button" class="cd-attach" id="cdAttach" aria-label="Attach a picture" title="Attach a picture (or paste one)">' + ICON.clip + '</button><input type="file" id="cdFile" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>' +
        (S.running
          ? '<button type="button" class="cd-send cd-stop" id="cdStop" aria-label="Stop">' + ICON.stop + '</button>'
          : '<button type="submit" class="cd-send" aria-label="Send"' + (S.sending ? ' disabled' : '') + '>' + ICON.send + '</button>') +
      '</form>' +
      '<div class="cd-picks">' +
        '<label class="cd-pick" title="Model"><select id="cdModel" aria-label="Model">' + MODELS.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === m.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
        '<label class="cd-pick" title="Effort"><select id="cdEffort" aria-label="Effort">' + m.efforts.map((e) => '<option value="' + e + '"' + (e === S.pick.effort ? ' selected' : '') + '>' + (EFFORT_NAME[e] || e) + '</option>').join('') + '</select></label>' +
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
    on('.cd-ask-opt', 'click', (e) => send(e.currentTarget.dataset.answer));
    on('[data-envchange-no]', 'click', (e) => { const x = S.events[Number(e.currentTarget.dataset.envchangeNo)]; S.envChangeMsg = ''; send(x && x.kind === 'allow_host' ? 'I declined allowing ' + x.host + '.' : 'I declined the new setup script.'); });
    on('[data-envchange-ok]', 'click', async (e) => {
      const x = S.events[Number(e.currentTarget.dataset.envchangeOk)];
      if (!x || !S.project) return;
      e.currentTarget.disabled = true;
      const body = x.kind === 'allow_host' ? { network: { add: [x.host] } } : { script: x.script };
      const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/env', { method: 'POST', body: JSON.stringify(body) });
      if (r.status !== 200) { S.envChangeMsg = (r.data && r.data.error) || 'It could not be saved.'; return draw(); }
      S.envChangeMsg = ''; if (S.env) S.env = r.data;
      send(x.kind === 'allow_host' ? 'I allowed ' + x.host + '.' : 'I approved the new setup script.');
    });
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
    on('#cdAutofix', 'click', async () => { const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/autofix', { method: 'POST', body: JSON.stringify({ on: S.project.autofix === false }) }); if (r.status === 200 && r.data) { S.project = r.data.project; draw(); } });
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
    on('#cdModel', 'change', (e) => { const m = MODELS.find((x) => x.id === e.target.value) || MODELS[0]; S.pick = { model: m.id, effort: m.efforts.includes(S.pick.effort) ? S.pick.effort : m.effort }; savePick(); draw(); });
    on('#cdEffort', 'change', (e) => { S.pick.effort = e.target.value; savePick(); });
    const form = root.querySelector('#cdForm');
    const input = root.querySelector('#cdIn');
    if (input) {
      grow(input);
      input.addEventListener('input', async () => {
        S.draft = input.value; grow(input);
        const before = input.value.slice(0, input.selectionStart);
        const m = /(^|\s)@([\w./-]*)$/.exec(before);
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
  window.CoderView = {
    mount(el, side) {
      const first = !S.root;
      S.root = el;
      if (side) S.side = side;
      if (!S.pick) S.pick = { model: MODELS[0].id, effort: MODELS[0].effort };
      if (!S.menuCloser) { S.menuCloser = true; document.addEventListener('click', () => { if (S.reviewMenu) { S.reviewMenu = false; draw(); } }); }
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
