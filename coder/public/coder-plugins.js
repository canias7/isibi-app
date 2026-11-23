/*
 * PLUGINS AND SKILLS ON CODER'S PAGE (the owner, 2026-11-23: Claude Code's plugin, skill and onboarding tools in Coder;
 * container/coder-plugins.mjs has the tools, src/coder-plugins.mjs the storage). What this file draws:
 *   - the cards in the chat: Suggested plugins (Install, Not now), Suggested skills (Add, Not now), Proposed skills (Save
 *     each, Not now), the shared guide's link, and the role picker (chips, Other, Skip; Coder waits for it);
 *   - the sidebar's Plugins panel (installed and catalog: Install, Remove) and its Skills list (the repository's, saved
 *     ones and plugins').
 * coder.js calls CoderPluginsUI.init once with what it needs, cardHTML/roleHTML while it draws a chat, and the panels from
 * the sidebar. Buttons are found by their data-cpx attribute, wherever they are.
 */
(function () {
  'use strict';
  let X = null; // { call, esc, project(), draw(), running(), events(), showConnectors() }
  const st = { installed: null, done: {}, said: {}, skills: {}, roleSent: {}, roleOther: {}, loading: false };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = {
    plug: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/></svg>',
    skill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/></svg>',
    link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  };
  const redraw = () => { if (X && X.draw) X.draw(); };
  async function loadInstalled(force) {
    if (!X || st.loading || (st.installed && !force)) return;
    st.loading = true;
    const r = await X.call('/plugins');
    st.loading = false;
    st.installed = r && r.status === 200 && r.data && Array.isArray(r.data.installed) ? new Set(r.data.installed.map((p) => p.name)) : new Set();
    redraw();
  }

  // ── THE CARDS ─────────────────────────────────────────────────────────────
  function rowHTML(icon, name, desc, extra, btn) {
    return '<div class="cpx-row">' + '<span class="cpx-ic">' + icon + '</span><div class="cpx-name"><b>' + esc(name) + '</b><span>' + esc(desc) + '</span>' + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</div>' + btn + '</div>';
  }
  function cardHTML(e) {
    const key = String(e.id || '');
    const closed = st.done[key] === 'closed';
    const said = st.said[key] ? '<div class="cpx-note" role="status">' + esc(st.said[key]) + '</div>' : '';
    const foot = closed ? '' : '<div class="cpx-foot"><button type="button" class="cpx-later" data-cpx="close" data-cpx-id="' + esc(key) + '">Not now</button></div>';
    if (e.type === 'plugins_suggest') {
      loadInstalled(false);
      const rows = (e.plugins || []).map((p) => {
        const on = p.installed || (st.installed && st.installed.has(p.name)) || st.done[key + ':' + p.name] === 'ok';
        return rowHTML(ICON.plug, p.name, p.description, 'Contains: ' + p.contents, on ? '<span class="cpx-on">Installed</span>' : closed ? '' : '<button type="button" class="cpx-btn" data-cpx="install" data-cpx-id="' + esc(key) + '" data-cpx-name="' + esc(p.name) + '">Install</button>');
      }).join('');
      return '<div class="cpx-card" data-cpx-card="' + esc(key) + '"><div class="cpx-head"><b>Suggested plugins</b></div>' + (e.reason ? '<p class="cpx-why">' + esc(e.reason) + '</p>' : '') + rows + said + foot + '</div>';
    }
    if (e.type === 'skills_suggest') {
      const rows = (e.skills || []).map((s) => {
        const on = s.saved || st.done[key + ':' + s.name] === 'ok';
        return rowHTML(ICON.skill, s.name, s.description, '', on ? '<span class="cpx-on">Added</span>' : closed ? '' : '<button type="button" class="cpx-btn" data-cpx="add-skill" data-cpx-id="' + esc(key) + '" data-cpx-name="' + esc(s.name) + '">Add</button>');
      }).join('');
      return '<div class="cpx-card" data-cpx-card="' + esc(key) + '"><div class="cpx-head"><b>Suggested skills</b></div>' + (e.reason ? '<p class="cpx-why">' + esc(e.reason) + '</p>' : '') + rows + said + foot + '</div>';
    }
    if (e.type === 'skills_propose') {
      const rows = (e.skills || []).map((s, k) => {
        const on = st.done[key + ':' + s.name] === 'ok';
        const open = !!st.skills[key + ':' + k];
        return '<div class="cpx-prop">' + rowHTML(ICON.skill, s.name, s.description, '', on ? '<span class="cpx-on">Saved</span>' : closed ? '' : '<button type="button" class="cpx-btn" data-cpx="save-skill" data-cpx-id="' + esc(key) + '" data-cpx-k="' + k + '">Save</button>') +
          '<button type="button" class="cpx-show" data-cpx="show" data-cpx-id="' + esc(key) + '" data-cpx-k="' + k + '" aria-expanded="' + open + '">' + (open ? 'Hide instructions' : 'Review instructions') + '</button>' +
          (open ? '<pre class="cpx-body">' + esc(s.body) + '</pre>' : '') + '</div>';
      }).join('');
      return '<div class="cpx-card" data-cpx-card="' + esc(key) + '"><div class="cpx-head"><b>Proposed skills</b><span class="cpx-sub">Review them, and save the ones you want in all your chats.</span></div>' + rows + said + foot + '</div>';
    }
    if (e.type === 'guide_shared') {
      return '<div class="cpx-card"><div class="cpx-head"><b>Onboarding guide shared</b></div>' + rowHTML(ICON.link, String(e.name || 'ONBOARDING.md'), 'Anyone signed in to Coder can open this link.', '', '<button type="button" class="cpx-btn" data-cpx="copy" data-cpx-url="' + esc(e.url) + '">Copy link</button>') +
        '<div class="cpx-url"><a href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">' + esc(e.url) + '</a></div>' + said + '</div>';
    }
    return '';
  }
  /** THE ROLE PICKER (Claude Code's ShowOnboardingRolePicker): chips, a box for another role, Skip. Coder waits for it. */
  function roleHTML(e, live, ans) {
    const q = (e.questions && e.questions[0]) || { question: 'What kind of work do you do?', options: [] };
    const pid = String(e.pid || '');
    const sent = st.roleSent[pid];
    let done = '';
    if (ans) {
      const p = Array.isArray(ans.picks) && ans.picks[0];
      const label = p && Array.isArray(p.options) && p.options.length ? (q.options[p.options[0]] || {}).label : p && p.other ? p.other : '';
      done = '<div class="cpx-note">' + (ans.choice === 'answers' && label ? 'You picked: <b>' + esc(label) + '</b>' : 'Closed without a pick.') + '</div>';
    }
    const on = live && !sent;
    return '<div class="cpx-card cpx-roles" data-cpx-card="' + esc(pid) + '"><div class="cpx-head"><b>' + esc(q.question) + '</b><span class="cpx-sub">Pick one and Coder installs a plugin for it.</span></div>' +
      '<div class="cpx-chips" role="group" aria-label="Roles">' + (q.options || []).map((o, k) => '<button type="button" class="cpx-chip" data-cpx="role" data-cpx-pid="' + esc(pid) + '" data-cpx-k="' + k + '"' + (on ? '' : ' disabled') + ' title="' + esc(o.description || '') + '">' + esc(o.label) + '</button>').join('') + '</div>' +
      (on ? '<div class="cpx-other"><input type="text" class="cpx-in" data-cpx-other="' + esc(pid) + '" placeholder="Or type your role" aria-label="Your role" value="' + esc(st.roleOther[pid] || '') + '"><button type="button" class="cpx-btn" data-cpx="role-other" data-cpx-pid="' + esc(pid) + '">Pick</button><button type="button" class="cpx-later" data-cpx="role-skip" data-cpx-pid="' + esc(pid) + '">Skip</button></div>' : '') +
      (st.said[pid] ? '<div class="cpx-note" role="status">' + esc(st.said[pid]) + '</div>' : '') + done + '</div>' + (on ? '<div class="cd-ask-wait">Needs your input</div>' : '');
  }
  async function roleAnswer(pid, choice, answers) {
    if (!X || st.roleSent[pid]) return;
    const p = X.project();
    if (!p) return;
    st.roleSent[pid] = choice; redraw();
    const r = await X.call('/projects/' + encodeURIComponent(p.id) + '/answer', { method: 'POST', body: JSON.stringify({ pid, choice, ...(answers ? { answers } : {}) }) });
    if (!r || r.status !== 200) { delete st.roleSent[pid]; st.said[pid] = (r && r.data && r.data.error) || 'Your answer could not be sent. Try again.'; }
    redraw();
  }
  function findEvent(id, type) { return (X && X.events ? X.events() : []).find((x) => x && String(x.id) === id && (!type || x.type === type)); }

  async function onClick(b) {
    const act = b.dataset.cpx, id = b.dataset.cpxId || '';
    if (act === 'close') { st.done[id] = 'closed'; return redraw(); }
    if (act === 'show') { const k = id + ':' + b.dataset.cpxK; st.skills[k] = !st.skills[k]; return redraw(); }
    if (act === 'copy') { try { await navigator.clipboard.writeText(b.dataset.cpxUrl); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Copy failed'; } return; }
    if (act === 'install') {
      const name = b.dataset.cpxName; b.disabled = true; b.textContent = 'Installing…';
      const r = await X.call('/plugins', { method: 'POST', body: JSON.stringify({ name }) });
      if (r && r.status === 200) { st.done[id + ':' + name] = 'ok'; if (st.installed) st.installed.add(name); st.said[id] = name + ' is installed for all your chats' + (r.data && r.data.added && r.data.added.length ? '. Sign in to ' + r.data.added.join(' and ') + ' in Connectors.' : '.'); }
      else st.said[id] = (r && r.data && r.data.error) || name + ' could not be installed.';
      return redraw();
    }
    if (act === 'add-skill') {
      const name = b.dataset.cpxName; b.disabled = true;
      const r = await X.call('/owner-skills', { method: 'POST', body: JSON.stringify({ name }) });
      if (r && r.status === 200) { st.done[id + ':' + name] = 'ok'; st.said[id] = name + ' is added: Coder can use it from your next message.'; }
      else st.said[id] = (r && r.data && r.data.error) || name + ' could not be added.';
      return redraw();
    }
    if (act === 'save-skill') {
      const e = findEvent(id, 'skills_propose'), s = e && e.skills && e.skills[Number(b.dataset.cpxK)];
      if (!s) return;
      b.disabled = true;
      const r = await X.call('/owner-skills', { method: 'POST', body: JSON.stringify({ name: s.name, description: s.description, body: s.body }) });
      if (r && r.status === 200) { st.done[id + ':' + s.name] = 'ok'; st.said[id] = s.name + ' is saved: Coder can use it from your next message.'; }
      else st.said[id] = (r && r.data && r.data.error) || s.name + ' could not be saved.';
      return redraw();
    }
    const pid = b.dataset.cpxPid || '';
    if (act === 'role') return roleAnswer(pid, 'answers', [{ options: [Number(b.dataset.cpxK)], other: '' }]);
    if (act === 'role-other') { const t = String(st.roleOther[pid] || '').trim(); if (!t) return; return roleAnswer(pid, 'answers', [{ options: [], other: t.slice(0, 100) }]); }
    if (act === 'role-skip') return roleAnswer(pid, 'skip', null);
  }
  document.addEventListener('click', (ev) => { const b = ev.target && ev.target.closest && ev.target.closest('[data-cpx]'); if (b && !b.disabled) { ev.preventDefault(); onClick(b); } });
  document.addEventListener('input', (ev) => { const t = ev.target; if (t && t.dataset && t.dataset.cpxOther) st.roleOther[t.dataset.cpxOther] = t.value; });
  document.addEventListener('keydown', (ev) => { const t = ev.target; if (ev.key === 'Enter' && t && t.dataset && t.dataset.cpxOther) { ev.preventDefault(); const b = t.parentNode.querySelector('[data-cpx="role-other"]'); if (b) onClick(b); } });

  // ── THE PANELS ────────────────────────────────────────────────────────────
  function modal(label, cls) {
    const wrap = document.createElement('div'); wrap.className = 'cd-sure cpx-modal';
    const box = document.createElement('div'); box.className = 'cd-sure-box cpx-panel ' + (cls || ''); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', label);
    wrap.append(box); document.body.append(wrap);
    const close = () => { document.removeEventListener('keydown', key); wrap.remove(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    return { box, close };
  }
  /** THE PLUGINS PANEL (the sidebar's Plugins ▸ Plugins): installed ones with Remove, the catalog with Install, a search. */
  async function pluginsPanel() {
    const { box, close } = modal('Plugins');
    const v = { tab: 'installed', q: '', note: '', installed: [], catalog: [], err: '', busy: '' };
    const load = async () => {
      const r = await X.call('/plugins');
      if (r && r.status === 200 && r.data) { v.installed = r.data.installed || []; v.catalog = r.data.catalog || []; v.err = ''; st.installed = new Set(v.installed.map((p) => p.name)); }
      else v.err = (r && r.data && r.data.error) || 'Plugins could not be loaded.';
    };
    const match = (p) => !v.q || (p.name + ' ' + p.description + ' ' + p.contents + ' ' + (p.category || '')).toLowerCase().includes(v.q.toLowerCase());
    const row = (p) => '<li class="cpx-prow"><span class="cpx-ic">' + ICON.plug + '</span><div class="cpx-name"><b>' + esc(p.name) + '</b>' + (p.category ? '<i class="cpx-cat">' + esc(p.category) + '</i>' : '') + '<span>' + esc(p.description) + '</span><small>Contains: ' + esc(p.contents) + '</small>' +
      (p.skills.length || p.commands.length ? '<small>Skills: ' + esc([...p.skills, ...p.commands].map((s) => p.name + ':' + s).join(', ')) + '</small>' : '') + '</div>' +
      (v.busy === p.name ? '<span class="cpx-on">…</span>' : p.installed ? (v.tab === 'installed' ? '<button type="button" class="cpx-btn cpx-rm" data-pp="remove" data-pp-name="' + esc(p.name) + '">Remove</button>' : '<span class="cpx-on">Installed</span>') : '<button type="button" class="cpx-btn" data-pp="install" data-pp-name="' + esc(p.name) + '">Install</button>') + '</li>';
    const paint = () => {
      const list = (v.tab === 'installed' ? v.installed : v.catalog).filter(match);
      box.innerHTML = '<div class="cd-sure-title">Plugins</div><div class="cd-sure-text">A plugin bundles skills, commands, agents, hooks and connectors, and is installed or removed as one. Installed plugins work in all your chats; their skills are named plugin:skill.</div>' +
        '<div class="cpx-bar"><div class="cpx-seg" role="tablist"><button type="button" role="tab" data-pp-tab="installed" aria-selected="' + (v.tab === 'installed') + '"' + (v.tab === 'installed' ? ' class="on"' : '') + '>Installed <i>' + v.installed.length + '</i></button><button type="button" role="tab" data-pp-tab="catalog" aria-selected="' + (v.tab === 'catalog') + '"' + (v.tab === 'catalog' ? ' class="on"' : '') + '>Discover</button></div>' +
        '<input type="search" class="cpx-in cpx-q" placeholder="Search plugins" aria-label="Search plugins" value="' + esc(v.q) + '"></div>' +
        (v.note ? '<div class="cpx-note" role="status">' + esc(v.note) + '</div>' : '') + (v.err ? '<div class="cpx-note cpx-err">' + esc(v.err) + '</div>' : '') +
        (list.length ? '<ul class="cpx-list">' + list.map(row).join('') + '</ul>' : '<p class="gf-none cpx-empty">' + (v.tab === 'installed' ? (v.installed.length ? 'No installed plugin matches.' : 'No plugins installed yet. Find some in Discover.') : 'No plugin matches.') + '</p>') +
        '<div class="cd-sure-row"><button type="button" class="cd-notify-done" data-pp="done">Done</button></div>';
      box.querySelectorAll('[data-pp-tab]').forEach((b) => { b.onclick = () => { v.tab = b.dataset.ppTab; v.note = ''; paint(); }; });
      const q = box.querySelector('.cpx-q'); q.oninput = () => { v.q = q.value; const at = q.selectionStart; paint(); const n = box.querySelector('.cpx-q'); n.focus(); try { n.setSelectionRange(at, at); } catch (e) {} };
      box.querySelectorAll('[data-pp]').forEach((b) => { b.onclick = async () => {
        const name = b.dataset.ppName;
        if (b.dataset.pp === 'done') return close();
        v.busy = name; paint();
        const r = b.dataset.pp === 'install' ? await X.call('/plugins', { method: 'POST', body: JSON.stringify({ name }) }) : await X.call('/plugins/' + encodeURIComponent(name), { method: 'DELETE' });
        v.busy = '';
        if (r && r.status === 200) v.note = b.dataset.pp === 'install' ? name + ' is installed.' + (r.data && r.data.added && r.data.added.length ? ' Sign in to ' + r.data.added.join(' and ') + ' in Connectors.' : '') : name + ' is removed.';
        else v.note = (r && r.data && r.data.error) || 'That did not work. Try again.';
        await load(); paint(); redraw();
      }; });
    };
    paint();
    await load();
    paint();
  }
  /** THE SKILLS LIST (the sidebar's Plugins ▸ Skills): the repository's, the owner's saved ones (Remove), plugins', and ones to add. */
  async function skillsPanel(repoSkills) {
    const { box, close } = modal('Skills', 'gf-sidelist');
    const v = { saved: [], plugin: [], catalog: [], err: '', note: '' };
    const load = async () => {
      const r = await X.call('/owner-skills');
      if (r && r.status === 200 && r.data) { v.saved = r.data.saved || []; v.plugin = r.data.plugin || []; v.catalog = r.data.catalog || []; v.err = ''; }
      else v.err = (r && r.data && r.data.error) || 'Your skills could not be loaded.';
    };
    const li = (n, d, btn) => '<li><div class="cpx-li"><b>' + esc(n) + '</b><small>' + esc(d) + '</small></div>' + (btn || '') + '</li>';
    const group = (title, items, none) => '<div class="cpx-gh">' + esc(title) + '</div>' + (items.length ? '<ul class="gf-sidelist-ul cpx-sl">' + items.join('') + '</ul>' : '<p class="gf-none cpx-empty">' + esc(none) + '</p>');
    const repoSet = new Set((repoSkills || []).map(([n]) => String(n).replace(/^\//, '').toLowerCase()));
    const paint = () => {
      const repo = repoSkills === null ? null : (repoSkills || []).filter(([n]) => { const k = String(n).replace(/^\//, '').toLowerCase(); return !v.saved.some((s) => s.name.toLowerCase() === k) && !v.plugin.some((s) => s.name.toLowerCase() === k); });
      box.innerHTML = '<div class="cd-sure-title">Skills</div><div class="cd-sure-text">Saved instructions Coder loads when a task matches. Type / in the message box to run one.</div>' +
        (v.note ? '<div class="cpx-note" role="status">' + esc(v.note) + '</div>' : '') + (v.err ? '<div class="cpx-note cpx-err">' + esc(v.err) + '</div>' : '') +
        '<div class="cpx-scroll">' +
        group('This repository', repo === null ? [] : repo.map(([n, d]) => li(n, d)), repo === null ? 'Open a chat to see its repository’s skills (.claude/skills).' : 'This chat’s repository has no skills yet.') +
        group('Your saved skills', v.saved.map((s) => li('/' + s.name, s.description, '<button type="button" class="cpx-btn cpx-rm" data-sk="remove" data-sk-name="' + esc(s.name) + '">Remove</button>')), 'None yet. Save one from Coder’s Proposed skills card, or add one below.') +
        group('From your plugins', v.plugin.map((s) => li(s.name, s.description + ' (' + s.source + ')')), 'None: install a plugin under Plugins.') +
        group('Skills you can add', v.catalog.filter((s) => !repoSet.has(s.name.toLowerCase())).map((s) => li(s.name, s.description, s.saved ? '<span class="cpx-on">Added</span>' : '<button type="button" class="cpx-btn" data-sk="add" data-sk-name="' + esc(s.name) + '">Add</button>')), 'Nothing more to add.') +
        '</div><div class="cd-sure-row"><button type="button" class="cd-notify-done" data-sk="done">Done</button></div>';
      box.querySelectorAll('[data-sk]').forEach((b) => { b.onclick = async () => {
        if (b.dataset.sk === 'done') return close();
        const name = b.dataset.skName; b.disabled = true;
        const r = b.dataset.sk === 'add' ? await X.call('/owner-skills', { method: 'POST', body: JSON.stringify({ name }) }) : await X.call('/owner-skills/' + encodeURIComponent(name), { method: 'DELETE' });
        v.note = r && r.status === 200 ? name + (b.dataset.sk === 'add' ? ' is added.' : ' is removed.') : (r && r.data && r.data.error) || 'That did not work.';
        await load(); paint();
      }; });
    };
    paint();
    await load();
    paint();
  }

  window.CoderPluginsUI = {
    init(x) { X = x; },
    cardHTML,
    roleHTML,
    pluginsPanel,
    skillsPanel,
    _state: st,
  };
})();
