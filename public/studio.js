// ── Zephyr Studio: shot-based projects ─────────────────────────────────────
// A project is an ordered list of SHOTS. Each shot is either one AI
// generation (prompt → clip) or a slice of an imported video (same source,
// in/out range from scene detection). The chat drives everything; the
// storyboard column and shot strip are the display. Export stitches the
// ordered shots into one file, entirely in the browser.

const SB_KEY = 'zephyr_studio_v1';
let sb = { active: null, projects: [] };
let sbSelected = null;      // selected shot id
let sbPlaying = null;       // {ids, idx} while playing the whole film
let sbBusy = false;         // an export or generation batch is running

function sbLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(SB_KEY) || 'null');
    if (raw && Array.isArray(raw.projects)) sb = raw;
  } catch {}
  if (!sb.projects.length) {
    sb.projects.push({ id: 'p' + Date.now(), title: 'My first film', brief: '', shots: [] });
  }
  if (!sb.projects.some((p) => p.id === sb.active)) sb.active = sb.projects[0].id;
  // Imported shots reference blob: URLs that die with the page — mark them.
  for (const p of sb.projects) {
    for (const s of p.shots) {
      if (s.url && s.url.startsWith('blob:')) { s.url = null; if (s.status === 'ready') s.status = 'missing'; }
    }
  }
}
function sbSave() {
  try { localStorage.setItem(SB_KEY, JSON.stringify(sb)); } catch {}
}
function sbProject() {
  return sb.projects.find((p) => p.id === sb.active);
}
function sbShot(id) {
  return sbProject().shots.find((s) => s.id === id);
}
function sbFmt(s) {
  if (!isFinite(s)) return '00:00';
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}
function sbShotDur(s) {
  if (s.out != null && s.in != null) return Math.max(0, s.out - s.in);
  return s.dur || 0;
}

// ── Rendering ──────────────────────────────────────────────────────────────
function sbRender() {
  const proj = sbProject();
  // project picker
  const sel = document.getElementById('sbProjectSel');
  if (sel) {
    sel.innerHTML = '';
    for (const p of sb.projects) {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.title;
      if (p.id === sb.active) o.selected = true;
      sel.appendChild(o);
    }
    const plus = document.createElement('option');
    plus.value = '__new__'; plus.textContent = '+ New project';
    sel.appendChild(plus);
  }
  // storyboard cards
  const list = document.getElementById('sbList');
  if (list) {
    list.innerHTML = '';
    if (!proj.shots.length) {
      const empty = document.createElement('div');
      empty.className = 'sb-empty';
      empty.textContent = 'No shots yet. Describe your film to Zephyr on the left — she’ll break it into shots — or import a video below.';
      list.appendChild(empty);
    }
    proj.shots.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'sb-card' + (s.id === sbSelected ? ' sel' : '') + ' st-' + s.status;
      card.draggable = true;
      card.dataset.id = s.id;
      const thumb = s.thumb
        ? '<img class="sb-thumb" src="' + s.thumb + '" alt="" />'
        : '<span class="sb-thumb sb-thumb-empty">' + (s.status === 'generating' ? '⏳' : '🎬') + '</span>';
      card.innerHTML =
        '<span class="sb-num">' + (i + 1) + '</span>' + thumb +
        '<span class="sb-meta"><b></b><small></small></span>' +
        '<span class="sb-dot" title="' + s.status + '"></span>' +
        '<button class="sb-x" title="Remove shot">×</button>';
      card.querySelector('b').textContent = s.title || 'Shot ' + (i + 1);
      card.querySelector('small').textContent =
        sbFmt(sbShotDur(s)) + ' · ' + (s.status === 'draft' ? 'not generated' : s.status);
      card.onclick = (e) => { if (e.target.className !== 'sb-x') sbSelect(s.id); };
      card.querySelector('.sb-x').onclick = () => sbRemoveShot(s.id);
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/sb', s.id));
      card.addEventListener('dragover', (e) => e.preventDefault());
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        sbMoveShot(e.dataTransfer.getData('text/sb'), s.id);
      });
      list.appendChild(card);
    });
  }
  // shot strip on the timeline
  const track = document.getElementById('timelineTrack');
  if (track) {
    track.innerHTML = '';
    track.classList.toggle('has-shots', proj.shots.length > 0);
    if (!proj.shots.length) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.textContent = 'Describe your film to Zephyr — or import a video — and its shots land here.';
      track.appendChild(empty);
    }
    const total = proj.shots.reduce((a, s) => a + (sbShotDur(s) || 4), 0) || 1;
    proj.shots.forEach((s, i) => {
      const block = document.createElement('div');
      block.className = 'clip-block sb-block' + (s.id === sbSelected ? ' sel' : '') + ' st-' + s.status;
      block.style.width = Math.max(6, ((sbShotDur(s) || 4) / total) * 100) + '%';
      if (s.thumb) block.style.backgroundImage = 'url(' + s.thumb + ')';
      block.innerHTML = '<span>' + (i + 1) + '</span>';
      block.onclick = () => sbSelect(s.id);
      track.appendChild(block);
    });
  }
  const totalEl = document.getElementById('sbTotalDur');
  if (totalEl) {
    const ready = proj.shots.filter((s) => s.status === 'ready').length;
    totalEl.textContent = proj.shots.length
      ? sbFmt(proj.shots.reduce((a, s) => a + sbShotDur(s), 0)) + ' · ' + ready + '/' + proj.shots.length + ' shots ready'
      : '';
  }
}

function sbSwitchProject(v) {
  if (v === '__new__') {
    const title = prompt('Project name:', 'Untitled film') || 'Untitled film';
    const p = { id: 'p' + Date.now(), title, brief: '', shots: [] };
    sb.projects.unshift(p);
    sb.active = p.id;
  } else {
    sb.active = v;
  }
  sbSelected = null;
  sbSave(); sbRender(); sbPreviewClear();
}

function sbMoveShot(fromId, toId) {
  if (!fromId || fromId === toId) return;
  const shots = sbProject().shots;
  const from = shots.findIndex((s) => s.id === fromId);
  const to = shots.findIndex((s) => s.id === toId);
  if (from < 0 || to < 0) return;
  shots.splice(to, 0, shots.splice(from, 1)[0]);
  sbSave(); sbRender();
}

function sbRemoveShot(id) {
  const shots = sbProject().shots;
  const i = shots.findIndex((s) => s.id === id);
  if (i >= 0) shots.splice(i, 1);
  if (sbSelected === id) { sbSelected = null; sbPreviewClear(); }
  sbSave(); sbRender();
}

// ── Preview ────────────────────────────────────────────────────────────────
function sbVideoEl() {
  const stage = document.getElementById('previewStage');
  if (!stage) return null;
  let v = stage.querySelector('video');
  if (!v) {
    stage.innerHTML = '';
    v = document.createElement('video');
    v.controls = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    stage.appendChild(v);
    v.addEventListener('timeupdate', () => {
      const tc = document.getElementById('studioTimecode');
      if (tc) tc.textContent = sbFmt(v.currentTime) + ' / ' + sbFmt(v.duration || 0);
      sbSegmentTick(v);
    });
  }
  return v;
}
function sbPreviewClear() {
  const stage = document.getElementById('previewStage');
  if (stage) stage.innerHTML = '<div class="preview-empty"><div class="preview-empty-text">Pick a shot to preview it</div></div>';
}

// Play only [in, out] of the current source; chain to the next film shot
// when playing the whole cut.
let sbSegment = null; // {out, next}
function sbSegmentTick(v) {
  if (!sbSegment) return;
  if (sbSegment.out != null && v.currentTime >= sbSegment.out - 0.03) {
    if (sbSegment.next) sbSegment.next();
    else { v.pause(); sbSegment = null; }
  }
}
function sbPlayShot(s, next) {
  const v = sbVideoEl();
  if (!v || !s.url) return;
  const start = s.in || 0;
  sbSegment = { out: s.out != null ? s.out : null, next: next || null };
  const go = () => { v.currentTime = start; v.play().catch(() => {}); };
  if (v.dataset.src !== s.url) {
    v.dataset.src = s.url;
    v.src = s.url;
    v.addEventListener('loadedmetadata', go, { once: true });
  } else go();
  if (next) v.onended = () => next();
  else v.onended = null;
}

function sbSelect(id) {
  sbSelected = id;
  sbPlaying = null;
  const s = sbShot(id);
  sbRender();
  if (s && s.url) sbPlayShot(s);
  else if (s) sbStudioNote(s.status === 'draft'
    ? 'Shot ' + (sbProject().shots.indexOf(s) + 1) + ' isn’t generated yet — say "generate shot ' + (sbProject().shots.indexOf(s) + 1) + '" and I’ll run it.'
    : 'That shot’s clip is gone (imported clips don’t survive a reload) — re-import the video to bring it back.');
}

function sbPlayAll() {
  const shots = sbProject().shots.filter((s) => s.url && s.status === 'ready');
  if (!shots.length) { sbStudioNote('Nothing to play yet — generate or import some shots first.'); return; }
  let i = 0;
  const playNext = () => {
    if (i >= shots.length) { sbSegment = null; return; }
    const s = shots[i++];
    sbSelected = s.id; sbRender();
    sbPlayShot(s, playNext);
  };
  playNext();
}

// ── Import → scene detection → shots ──────────────────────────────────────
// Sample the video on a small canvas and cut where consecutive frames differ
// sharply. Virtual shots: same blob URL, in/out ranges. All on-device.
async function sbImportFile(f) {
  const url = URL.createObjectURL(f);
  sbStudioNote('Reading “' + f.name + '” and looking for cuts…');
  try {
    const shots = await sbDetectShots(url, (pct) => sbStudioProgress('Scanning for cuts… ' + pct + '%'));
    const proj = sbProject();
    const base = proj.shots.length;
    shots.forEach((sh, i) => {
      proj.shots.push({
        id: 's' + Date.now() + '_' + i,
        title: f.name.replace(/\.[^.]+$/, '') + ' · ' + (i + 1),
        prompt: '',
        status: 'ready',
        src: 'import',
        url, in: sh.in, out: sh.out, dur: sh.out - sh.in,
        thumb: sh.thumb,
      });
    });
    sbSave(); sbRender();
    sbStudioNote(shots.length > 1
      ? 'Found ' + shots.length + ' shots in “' + f.name + '” — they’re on your storyboard (shots ' + (base + 1) + '–' + (base + shots.length) + '). Note: imported clips live in this tab; re-import after a reload.'
      : 'No hard cuts found — imported “' + f.name + '” as one shot. Ask me to split it if you want.');
  } catch (e) {
    console.error('shot detection failed:', e);
    sbStudioNote('I couldn’t read that video — try an MP4/WebM the browser can play.');
  }
}

function sbGrabFrame(v, w) {
  const c = document.createElement('canvas');
  const h = Math.max(1, Math.round(w * (v.videoHeight / v.videoWidth || 0.5625)));
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  return c;
}

async function sbDetectShots(url, onProgress) {
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto';
  v.src = url;
  await new Promise((ok, err) => { v.onloadedmetadata = ok; v.onerror = err; });
  // Streamed/recorded WebMs report Infinity until you seek past the end.
  if (!isFinite(v.duration)) {
    await new Promise((ok) => { v.onseeked = ok; v.currentTime = 1e9; });
    await new Promise((r) => setTimeout(r, 60));
  }
  const dur = isFinite(v.duration) ? v.duration : v.currentTime;
  if (!isFinite(dur) || dur <= 0) throw new Error('unreadable duration');
  const step = Math.max(0.2, Math.min(0.4, dur / 240)); // ≤ ~240 samples
  const seek = (t) => new Promise((ok) => { v.onseeked = () => ok(); v.currentTime = Math.min(t, dur - 0.01); });
  let samples = 0;

  const W = 48, H = 27, ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = W; ctx.canvas.height = H;
  let prev = null;
  const cuts = [0];
  for (let t = 0; t < dur; t += step) {
    if (++samples > 500) break;
    await seek(t);
    ctx.drawImage(v, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    if (prev) {
      let diff = 0;
      for (let i = 0; i < px.length; i += 4) {
        diff += Math.abs(px[i] - prev[i]) + Math.abs(px[i + 1] - prev[i + 1]) + Math.abs(px[i + 2] - prev[i + 2]);
      }
      diff /= (px.length / 4) * 3; // mean channel delta 0-255
      const last = cuts[cuts.length - 1];
      if (diff > 34 && t - last >= 0.8) cuts.push(t);
    }
    prev = px.slice(0);
    if (onProgress) onProgress(Math.round((t / dur) * 100));
  }
  cuts.push(dur);
  // thumbnails at each shot start
  const shots = [];
  for (let i = 0; i < cuts.length - 1 && shots.length < 60; i++) {
    await seek(Math.min(cuts[i] + 0.1, dur - 0.01));
    shots.push({ in: cuts[i], out: cuts[i + 1], thumb: sbGrabFrame(v, 160).toDataURL('image/jpeg', 0.6) });
  }
  return shots;
}

// ── Generation: one shot = one run through the existing pipeline ──────────
async function sbGenerateShot(s) {
  const proj = sbProject();
  if (s.status === 'generating') return;
  s.status = 'generating';
  sbSave(); sbRender();
  const idx = proj.shots.indexOf(s) + 1;
  try {
    // Continuity: chain from the previous READY generated shot's last frame.
    let startImage;
    const prevShot = proj.shots[proj.shots.indexOf(s) - 1];
    if (prevShot && prevShot.status === 'ready' && prevShot.url && prevShot.src !== 'import') {
      startImage = await sbLastFrame(prevShot).catch(() => undefined);
    }
    const res = await apiFetch('/api/video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: s.model || selectedModels.video,
        prompt: s.prompt,
        duration: Math.max(3, Math.min(12, Math.round(s.dur || 5))),
        ratio: '16:9',
        quality: '720p',
        image: startImage,
      }),
    });
    const job = await res.json();
    if (res.status === 402) throw new Error('not enough credits for this shot');
    if (!res.ok || !job.status_url) throw new Error(JSON.stringify(job));
    if (typeof job.balance === 'number' && typeof setCredits === 'function') setCredits(job.balance);
    for (let waited = 0; waited < 12 * 60 * 1000; waited += 4000) {
      const st = await (await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url))).json();
      if (st.status === 'COMPLETED') break;
      sbStudioProgress('Shot ' + idx + ': ' + (st.status === 'IN_PROGRESS' ? 'generating…' : 'queued…'));
      await new Promise((r) => setTimeout(r, 4000));
    }
    const out = await (await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url))).json();
    let urlOut = out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url;
    if (!urlOut) throw new Error('no video in result');
    // trySave/queuePendingSave live in chat.js: bounded retries, and a failed
    // copy queues a boot-time retry that swaps in the permanent URL later.
    const perm = await trySave(urlOut, 'video', 3);
    if (perm) urlOut = perm;
    else queuePendingSave(urlOut, 'video');
    s.url = urlOut; s.in = null; s.out = null; s.status = 'ready';
    await sbThumb(s).catch(() => {});
    sbSave(); sbRender();
    sbStudioNote(perm
      ? 'Shot ' + idx + ' is ready ✦'
      : 'Shot ' + idx + ' is ready, but its gallery copy failed — using a temporary link and retrying next app open.');
  } catch (e) {
    console.error('shot generation failed:', e);
    s.status = 'draft';
    sbSave(); sbRender();
    sbStudioNote('Shot ' + idx + ' failed to generate — ' + (String(e.message || e).slice(0, 120)) + '. Tweak it and try again.');
  }
}

// Draw the last frame of a shot to a canvas → JPEG data URL (start image for
// the next shot). Needs CORS-readable media; falls back silently if tainted.
async function sbLastFrame(s) {
  const v = document.createElement('video');
  v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  v.src = s.url;
  await new Promise((ok, err) => { v.onloadedmetadata = ok; v.onerror = err; });
  const t = (s.out != null ? s.out : v.duration) - 0.08;
  await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.max(0, t); });
  return sbGrabFrame(v, 1024).toDataURL('image/jpeg', 0.85);
}

async function sbThumb(s) {
  const v = document.createElement('video');
  v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'metadata';
  v.src = s.url;
  await new Promise((ok, err) => { v.onloadedmetadata = ok; v.onerror = err; });
  s.dur = s.dur || v.duration;
  await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.min(0.1, v.duration / 2); });
  s.thumb = sbGrabFrame(v, 160).toDataURL('image/jpeg', 0.6);
}

// ── Export: stitch ready shots into one WebM, all in-browser ──────────────
// Canvas + MediaRecorder: universally supported, realtime. Audio comes along
// via an AudioContext tap. (WebCodecs fast path is a v2 upgrade.)
async function sbExport() {
  if (sbBusy) return;
  const shots = sbProject().shots.filter((s) => s.url && s.status === 'ready');
  if (!shots.length) { sbStudioNote('Nothing to export yet.'); return; }
  sbBusy = true;
  const btn = document.getElementById('sbExportBtn');
  if (btn) btn.textContent = 'Exporting…';
  try {
    const W = 1280, H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const dest = ac.createMediaStreamDestination();
    const stream = canvas.captureStream(30);
    if (dest.stream.getAudioTracks().length) stream.addTrack(dest.stream.getAudioTracks()[0]);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    const done = new Promise((ok) => { rec.onstop = ok; });
    rec.start(250);

    for (let i = 0; i < shots.length; i++) {
      sbStudioProgress('Exporting shot ' + (i + 1) + '/' + shots.length + '…');
      await sbExportShot(shots[i], ctx, W, H, ac, dest);
    }
    rec.stop();
    await done;
    ac.close().catch(() => {});
    const blob = new Blob(parts, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (sbProject().title.replace(/[^\w\- ]+/g, '') || 'film') + '.webm';
    a.click();
    sbStudioNote('Exported “' + sbProject().title + '” (' + shots.length + ' shots) — check your downloads ✦');
  } catch (e) {
    console.error('export failed:', e);
    sbStudioNote('Export hit a snag — ' + String(e.message || e).slice(0, 120));
  } finally {
    sbBusy = false;
    if (btn) btn.textContent = 'Export';
  }
}

function sbExportShot(s, ctx, W, H, ac, dest) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.src = s.url;
    v.muted = false; v.volume = 1;
    let node = null, raf = 0;
    const start = s.in || 0;
    const stopAt = s.out != null ? s.out : Infinity;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      try { if (node) node.disconnect(); } catch {}
      v.pause(); v.src = '';
    };
    v.onerror = () => { cleanup(); reject(new Error('could not read a shot (CORS or codec)')); };
    v.onloadedmetadata = () => {
      try { node = ac.createMediaElementSource(v); node.connect(dest); } catch {}
      v.currentTime = start;
      v.play().then(() => {
        const draw = () => {
          // letterbox into the export frame
          const vr = v.videoWidth / v.videoHeight, fr = W / H;
          let dw = W, dh = H, dx = 0, dy = 0;
          if (vr > fr) { dh = W / vr; dy = (H - dh) / 2; } else { dw = H * vr; dx = (W - dw) / 2; }
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(v, dx, dy, dw, dh);
          if (v.currentTime >= stopAt - 0.03 || v.ended) { cleanup(); resolve(); return; }
          raf = requestAnimationFrame(draw);
        };
        draw();
      }).catch((e) => { cleanup(); reject(e); });
    };
  });
}

// ── Zephyr chat panel ──────────────────────────────────────────────────────
let sbProgressEl = null;
function sbStudioNote(text) {
  sbProgressEl = null;
  const box = document.getElementById('studioMessages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'msg agent';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function sbStudioProgress(text) {
  const box = document.getElementById('studioMessages');
  if (!box) return;
  if (!sbProgressEl || !sbProgressEl.isConnected) {
    sbProgressEl = document.createElement('div');
    sbProgressEl.className = 'msg agent';
    box.appendChild(sbProgressEl);
  }
  sbProgressEl.textContent = text;
  box.scrollTop = box.scrollHeight;
}
function sbUserNote(text) {
  const box = document.getElementById('studioMessages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// The studio director: project state + message → actions.
async function studioSend() {
  const inp = document.getElementById('studioInput');
  if (!inp) return;
  const t = (inp.value || '').trim();
  if (!t) return;
  inp.value = '';
  sbUserNote(t);
  const proj = sbProject();
  sbStudioProgress('Zephyr is thinking…');
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'studio', kind: 'video', prompt: t,
        brief: proj.brief || undefined,
        shots: proj.shots.map((s, i) => ({
          n: i + 1, title: s.title, status: s.status, dur: Math.round(sbShotDur(s)),
          prompt: (s.prompt || '').slice(0, 160), src: s.src || 'gen',
        })),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.reply) sbStudioNote(data.reply);
    if (data.brief) { proj.brief = String(data.brief).slice(0, 600); }
    const toGenerate = [];
    for (const a of Array.isArray(data.actions) ? data.actions : []) {
      if (a.type === 'add_shots' && Array.isArray(a.shots)) {
        for (const ns of a.shots.slice(0, 12)) {
          proj.shots.push({
            id: 's' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
            title: String(ns.title || 'Shot').slice(0, 60),
            prompt: String(ns.prompt || '').slice(0, 1200),
            dur: Math.max(3, Math.min(12, Number(ns.duration) || 5)),
            status: 'draft', src: 'gen', url: null, thumb: null, in: null, out: null,
          });
        }
      } else if (a.type === 'update_shot') {
        const s = proj.shots[a.n - 1];
        if (s) {
          if (a.prompt) { s.prompt = String(a.prompt).slice(0, 1200); if (s.src !== 'import') { s.status = 'draft'; } }
          if (a.title) s.title = String(a.title).slice(0, 60);
          if (a.duration) s.dur = Math.max(3, Math.min(12, Number(a.duration)));
          if (a.trim && s.url) {
            const base = s.in || 0;
            s.in = base + Math.max(0, Number(a.trim.start) || 0);
            if (a.trim.end != null) s.out = base + Number(a.trim.end);
          }
        }
      } else if (a.type === 'remove_shot') {
        const s = proj.shots[a.n - 1];
        if (s) proj.shots.splice(a.n - 1, 1);
      } else if (a.type === 'reorder' && Array.isArray(a.order)) {
        const next = a.order.map((n) => proj.shots[n - 1]).filter(Boolean);
        if (next.length === proj.shots.length) proj.shots = next;
      } else if (a.type === 'generate') {
        if (a.n === 'all') proj.shots.forEach((s) => { if (s.status === 'draft' && s.prompt) toGenerate.push(s); });
        else { const s = proj.shots[a.n - 1]; if (s && s.prompt) toGenerate.push(s); }
      }
    }
    sbSave(); sbRender();
    // Generate sequentially so last-frame chaining sees each finished shot.
    for (const s of toGenerate) await sbGenerateShot(s);
  } catch (e) {
    sbStudioNote('I couldn’t reach the director — try that again in a moment.');
  }
}

// ── Chat → Studio bridge ───────────────────────────────────────────────────
// Called from chat.js media cards: pushes a generated video into the active
// project as a ready shot.
async function sbAddFromChat(url, prompt) {
  sbLoad();
  const proj = sbProject();
  const s = {
    id: 's' + Date.now(),
    title: (prompt || 'From chat').slice(0, 40),
    prompt: prompt || '',
    status: 'ready', src: 'gen', url, thumb: null, in: null, out: null, dur: 0,
  };
  proj.shots.push(s);
  await sbThumb(s).catch(() => {});
  sbSave();
  if (document.getElementById('viewStudio').classList.contains('active')) sbRender();
  return sbProject().shots.length;
}

// ── Init ───────────────────────────────────────────────────────────────────
function initStudio() {
  const file = document.getElementById('studioFile');
  if (file) {
    file.addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) sbImportFile(f);
    });
  }
  sbLoad();
  sbRender();
  sbStudioNote('Tell me the film you’re making and I’ll break it into shots — or import a video and I’ll split it for you.');
}
initStudio();
