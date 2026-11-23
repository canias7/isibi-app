/*
 * THE OWNER'S PROJECTS ON CODER'S PAGE (2026-11-23; Claude Code's Projects tool: container/coder-projects.mjs has the tool,
 * src/coder-owner-projects.mjs the storage). The sidebar's Plugins ▸ Projects opens a panel inside #gfApp:
 *   - the list of projects (New project), each with its documents count and "Use in chats" (the one Coder's projects tool
 *     reads and writes);
 *   - one project: its name, description and instructions (Save), its documents (open, remove, add one: a name and its
 *     text, or a file from this device), and how much of its knowledge limit is used. Delete project.
 * coder.js calls CoderProjectsUI.init once with its `call`; the panel is drawn on demand.
 */
(function () {
  'use strict';
  let X = null; // { call }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kb = (n) => (n < 1000 ? n + ' characters' : (n / 1000).toFixed(n < 10000 ? 1 : 0) + 'k characters');
  const ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const DOC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>';

  function modal() {
    const host = document.getElementById('gfApp') || document.body;
    const wrap = document.createElement('div'); wrap.className = 'cd-sure cpj-modal';
    const box = document.createElement('div'); box.className = 'cd-sure-box cpj-panel'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Projects');
    wrap.append(box); host.append(wrap);
    const close = () => { document.removeEventListener('keydown', key); wrap.remove(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    return { box, close };
  }

  async function projectsPanel() {
    if (!X) return;
    const { box, close } = modal();
    const v = { list: [], open: '', note: '', err: '', adding: false, newing: false, viewing: null, busy: false };
    const load = async () => {
      const r = await X.call('/owner-projects');
      if (r && r.status === 200 && r.data) { v.list = r.data.projects || []; v.err = ''; }
      else v.err = (r && r.data && r.data.error) || 'Your projects could not be loaded.';
    };
    const cur = () => v.list.find((p) => p.id === v.open) || null;
    const note = () => (v.note ? '<div class="cpj-note" role="status">' + esc(v.note) + '</div>' : '') + (v.err ? '<div class="cpj-note cpj-err" role="alert">' + esc(v.err) + '</div>' : '');
    const listView = () => '<div class="cd-sure-title">Projects</div><div class="cd-sure-text">A project holds documents and instructions. The one marked <b>Use in chats</b> is the one Coder reads and writes with its projects tool.</div>' + note() +
      (v.newing ? '<form class="cpj-form" data-cpj-form="new"><label>Name<input class="cpj-in" name="name" maxlength="120" required placeholder="Billing service"></label><label>Description<input class="cpj-in" name="description" maxlength="1000" placeholder="What the project is about"></label><label>Instructions<textarea class="cpj-in cpj-ta" name="instructions" rows="4" placeholder="Rules Coder follows for this project"></textarea></label><div class="cpj-row-end"><button type="button" class="cpj-btn cpj-quiet" data-cpj="cancel-new">Cancel</button><button type="submit" class="cpj-btn cpj-main">Create project</button></div></form>' : '') +
      (v.list.length ? '<ul class="cpj-list">' + v.list.map((p) => '<li class="cpj-item"><button type="button" class="cpj-open" data-cpj="open" data-cpj-id="' + esc(p.id) + '"><span class="cpj-ic">' + ICON + '</span><span class="cpj-name"><b>' + esc(p.name) + '</b><span>' + esc(p.description || 'No description') + '</span><small>' + p.docs.length + (p.docs.length === 1 ? ' document' : ' documents') + ' · ' + kb(p.knowledge.knowledge_size) + '</small></span></button>' + (p.active ? '<span class="cpj-on">In chats</span>' : '<button type="button" class="cpj-btn" data-cpj="use" data-cpj-id="' + esc(p.id) + '">Use in chats</button>') + '</li>').join('') + '</ul>' : (v.newing ? '' : '<p class="cpj-empty">No projects yet. Make one to give Coder documents and instructions it can read in your chats.</p>')) +
      '<div class="cd-sure-row">' + (v.newing ? '' : '<button type="button" class="cpj-btn" data-cpj="new">New project</button>') + '<button type="button" class="cd-notify-done" data-cpj="done">Done</button></div>';
    const projectView = (p) => {
      const pct = Math.min(100, Math.round((p.knowledge.knowledge_size / p.knowledge.max_knowledge_size) * 1000) / 10);
      return '<div class="cpj-top"><button type="button" class="cpj-back" data-cpj="back" aria-label="All projects">‹ Projects</button>' + (p.active ? '<span class="cpj-on">In chats</span>' : '<button type="button" class="cpj-btn" data-cpj="use" data-cpj-id="' + esc(p.id) + '">Use in chats</button>') + '</div>' + note() +
        '<form class="cpj-form" data-cpj-form="edit"><label>Name<input class="cpj-in" name="name" maxlength="120" required value="' + esc(p.name) + '"></label><label>Description<input class="cpj-in" name="description" maxlength="1000" value="' + esc(p.description) + '"></label><label>Instructions<textarea class="cpj-in cpj-ta" name="instructions" rows="4">' + esc(p.instructions) + '</textarea></label><div class="cpj-row-end"><button type="submit" class="cpj-btn cpj-main">Save</button></div></form>' +
        '<div class="cpj-gh"><span>Documents</span><small>' + kb(p.knowledge.knowledge_size) + ' of ' + kb(p.knowledge.max_knowledge_size) + '</small></div><div class="cpj-bar" role="progressbar" aria-label="Knowledge used" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
        (p.docs.length ? '<ul class="cpj-docs">' + p.docs.map((d) => '<li><span class="cpj-dic">' + DOC + '</span><button type="button" class="cpj-dname" data-cpj="view" data-cpj-path="' + esc(d.path) + '">' + esc(d.path) + '</button><small>' + kb(d.size) + '</small><button type="button" class="cpj-btn cpj-rm" data-cpj="rm" data-cpj-path="' + esc(d.path) + '" aria-label="Remove ' + esc(d.path) + '">Remove</button></li>').join('') + '</ul>' : '<p class="cpj-empty">No documents yet.</p>') +
        (v.viewing ? '<div class="cpj-view"><div class="cpj-vh"><b>' + esc(v.viewing.path) + '</b><button type="button" class="cpj-quiet cpj-btn" data-cpj="unview">Close</button></div><pre>' + esc(v.viewing.content) + '</pre></div>' : '') +
        (v.adding ? '<form class="cpj-form" data-cpj-form="doc"><label>Path<input class="cpj-in" name="path" maxlength="300" required placeholder="notes/architecture.md"></label><label>Text<textarea class="cpj-in cpj-ta" name="content" rows="6"></textarea></label><label class="cpj-file">Or a file from this device<input type="file" name="file" accept=".md,.txt,.json,.csv,.yaml,.yml,.html,.js,.ts,.py,text/*"></label><div class="cpj-row-end"><button type="button" class="cpj-btn cpj-quiet" data-cpj="cancel-doc">Cancel</button><button type="submit" class="cpj-btn cpj-main">Add document</button></div></form>' : '') +
        '<div class="cd-sure-row"><button type="button" class="cpj-btn cpj-rm" data-cpj="delete">Delete project</button>' + (v.adding ? '' : '<button type="button" class="cpj-btn" data-cpj="add">Add document</button>') + '<button type="button" class="cd-notify-done" data-cpj="done">Done</button></div>';
    };
    const paint = () => {
      const p = cur();
      box.innerHTML = p ? projectView(p) : listView();
      box.querySelectorAll('[data-cpj]').forEach((b) => { b.onclick = () => act(b); });
      box.querySelectorAll('form[data-cpj-form]').forEach((f) => { f.onsubmit = (e) => { e.preventDefault(); submit(f); }; });
      const file = box.querySelector('input[type=file]');
      if (file) file.onchange = async () => { const f = file.files && file.files[0]; if (!f) return; const form = file.closest('form'); if (!form.elements.path.value) form.elements.path.value = f.name; form.elements.content.value = await f.text(); };
    };
    const after = async (r, ok) => { v.note = r && r.status === 200 ? ok : ''; v.err = r && r.status === 200 ? '' : (r && r.data && r.data.error) || 'That did not work. Try again.'; await load(); paint(); };
    async function act(b) {
      const a = b.dataset.cpj, p = cur();
      v.note = ''; v.err = '';
      if (a === 'done') return close();
      if (a === 'new') { v.newing = true; return paint(); }
      if (a === 'cancel-new') { v.newing = false; return paint(); }
      if (a === 'open') { v.open = b.dataset.cpjId; v.adding = false; v.viewing = null; return paint(); }
      if (a === 'back') { v.open = ''; v.viewing = null; return paint(); }
      if (a === 'add') { v.adding = true; return paint(); }
      if (a === 'cancel-doc') { v.adding = false; return paint(); }
      if (a === 'unview') { v.viewing = null; return paint(); }
      if (a === 'use') return after(await X.call('/owner-projects/' + encodeURIComponent(b.dataset.cpjId), { method: 'PATCH', body: JSON.stringify({ active: true }) }), 'Coder now uses this project in your chats.');
      if (!p) return;
      if (a === 'view') { const r = await X.call('/owner-projects/' + encodeURIComponent(p.id) + '/doc?path=' + encodeURIComponent(b.dataset.cpjPath)); v.viewing = r && r.status === 200 ? r.data : null; if (!v.viewing) v.err = 'That document could not be opened.'; return paint(); }
      if (a === 'rm') return after(await X.call('/owner-projects/' + encodeURIComponent(p.id) + '/doc?path=' + encodeURIComponent(b.dataset.cpjPath), { method: 'DELETE' }), b.dataset.cpjPath + ' is removed.');
      if (a === 'delete') { if (!window.confirm('Delete ' + p.name + ' and its documents?')) return; const r = await X.call('/owner-projects/' + encodeURIComponent(p.id), { method: 'DELETE' }); if (r && r.status === 200) v.open = ''; return after(r, p.name + ' is deleted.'); }
    }
    async function submit(f) {
      v.note = ''; v.err = '';
      const kind = f.dataset.cpjForm;
      if (kind === 'new') { const r = await X.call('/owner-projects', { method: 'POST', body: JSON.stringify({ name: f.elements.name.value, description: f.elements.description.value, instructions: f.elements.instructions.value }) }); if (r && r.status === 200) { v.newing = false; v.open = r.data.project.id; } return after(r, 'Project created.'); }
      const p = cur(); if (!p) return;
      if (kind === 'edit') return after(await X.call('/owner-projects/' + encodeURIComponent(p.id), { method: 'PATCH', body: JSON.stringify({ name: f.elements.name.value, description: f.elements.description.value, instructions: f.elements.instructions.value }) }), 'Saved.');
      if (kind === 'doc') { const r = await X.call('/owner-projects/' + encodeURIComponent(p.id) + '/doc', { method: 'POST', body: JSON.stringify({ path: f.elements.path.value, content: f.elements.content.value }) }); if (r && r.status === 200) v.adding = false; return after(r, r && r.data && r.data.replaced ? f.elements.path.value + ' is replaced.' : f.elements.path.value + ' is added.'); }
    }
    paint();
    await load();
    paint();
  }

  window.CoderProjectsUI = { init(x) { X = x; }, projectsPanel };
})();
