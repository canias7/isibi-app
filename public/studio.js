// ── isibi.ai Studio: shot-based projects ─────────────────────────────────────
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

// Account switched on this browser (expired session → different login without
// a reload): drop the previous user's projects from memory and rebuild from
// the now-wiped storage, so Studio never shows the old account's work.
function sbResetForAccountSwitch() {
  sb = { active: null, projects: [] };
  sbSelected = null; sbPlaying = null; sbBusy = false; sbSegment = null;
  if (typeof sbPreviewClear === 'function') sbPreviewClear(); // wipe the old user's video from the stage
  sbLoad();   // storage was just cleared → creates a fresh default project
  sbRender();
}

function sbLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(SB_KEY) || 'null');
    if (raw && Array.isArray(raw.projects)) sb = raw;
  } catch {}
  if (!sb.projects.length) {
    sb.projects.push({ id: sbUid('p'), title: 'My first film', brief: '', shots: [] });
  }
  if (!sb.projects.some((p) => p.id === sb.active)) sb.active = sb.projects[0].id;
  for (const p of sb.projects) {
    for (const s of p.shots) {
      // Imported shots reference blob: URLs that die with the page — mark them.
      if (s.url && s.url.startsWith('blob:')) { s.url = null; if (s.status === 'ready') s.status = 'missing'; }
      // A shot left mid-render when the tab closed (Studio has no boot-resume)
      // would be a permanent ⏳ that no button restarts — reset it so it can run
      // again (or shows its result if the URL survived).
      if (s.status === 'generating') s.status = s.url ? 'ready' : 'draft';
    }
  }
}
// A short, collision-resistant id (timestamp alone collides within a ms).
function sbUid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
// Transient message for Studio (storage/export problems etc.).
function sbToast(msg) {
  let t = document.getElementById('sbToast');
  if (!t) { t = document.createElement('div'); t.id = 'sbToast'; t.className = 'sb-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(sbToast._t);
  sbToast._t = setTimeout(() => t.classList.remove('show'), 5000);
}
function sbSave() {
  try { localStorage.setItem(SB_KEY, JSON.stringify(sb)); return true; }
  catch (e) {
    // Out of localStorage room (thumbnails add up): drop this project's base64
    // thumbs and retry once so at least the project structure survives, and
    // tell the user rather than silently losing work.
    try {
      sb.projects.forEach((p) => p.shots.forEach((s) => { if (s.thumb) s.thumb = null; }));
      localStorage.setItem(SB_KEY, JSON.stringify(sb));
      if (typeof sbToast === 'function') sbToast('Storage is full — cleared shot thumbnails to save your project.');
      return true;
    } catch {
      if (typeof sbToast === 'function') sbToast('Storage is full — could not save. Export or delete a project to free space.');
      return false;
    }
  }
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
      empty.textContent = 'No shots yet. Describe your film on the left — isibi.ai breaks it into shots — or import a video below.';
      list.appendChild(empty);
    }
    proj.shots.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'sb-card' + (s.id === sbSelected ? ' sel' : '') + ' st-' + s.status;
      card.draggable = true;
      card.dataset.id = s.id;
      const thumb = s.thumb
        ? '<img class="sb-thumb" src="' + (typeof esc === 'function' ? esc(s.thumb) : s.thumb) + '" alt="" />'
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
      empty.textContent = 'Describe your film to isibi.ai — or import a video — and its shots land here.';
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
    const p = { id: sbUid('p'), title, brief: '', shots: [] };
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

// ── Preview transport (the toolbar buttons around the stage) ────────────────
// The native <video controls> already handles scrub/volume; these add
// shot-to-shot navigation and quick play/fullscreen/speed on top.
function sbCurIndex() {
  const shots = sbProject().shots;
  const i = shots.findIndex((s) => s.id === sbSelected);
  return { shots, i };
}
function sbPrevShot() { const { shots, i } = sbCurIndex(); const j = i > 0 ? i - 1 : (i < 0 ? shots.length - 1 : 0); if (shots[j]) sbSelect(shots[j].id); }
function sbNextShot() { const { shots, i } = sbCurIndex(); const j = i < shots.length - 1 ? i + 1 : 0; if (shots[j]) sbSelect(shots[j].id); }
function sbTogglePlay() {
  const v = document.querySelector('#previewStage video');
  if (!v) { const { shots } = sbCurIndex(); const first = shots.find((s) => s.url); if (first) sbSelect(first.id); return; }
  if (v.paused) v.play().catch(() => {}); else v.pause();
}
function sbFullscreenPreview() {
  const v = document.querySelector('#previewStage video');
  if (v && v.requestFullscreen) v.requestFullscreen().catch(() => {});
}
function sbToggleMute() {
  const v = document.querySelector('#previewStage video');
  if (!v) return;
  v.muted = !v.muted;
  const b = document.getElementById('sbVolBtn');
  if (b) b.textContent = v.muted ? '🔇' : '🔊';
}
const SB_SPEEDS = [1, 1.5, 2, 0.5];
let sbSpeedIdx = 0;
function sbCycleSpeed() {
  sbSpeedIdx = (sbSpeedIdx + 1) % SB_SPEEDS.length;
  const r = SB_SPEEDS[sbSpeedIdx];
  const v = document.querySelector('#previewStage video');
  if (v) v.playbackRate = r;
  const b = document.getElementById('sbSpeedBtn');
  if (b) { b.textContent = r + '×'; b.title = 'Speed: ' + r + '×'; }
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
        id: sbUid('s'),
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
  // Scale the sample step to the whole clip so a long video is scanned end to
  // end within a bounded ~480-sample budget (was a fixed 0.4s that only ever
  // reached the first ~200s before the hard sample cap).
  const step = Math.max(0.4, dur / 480);
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
    let softFails = 0;
    for (let waited = 0; waited < 12 * 60 * 1000; waited += 4000) {
      let st;
      try {
        st = await (await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url))).json();
        softFails = 0;
      } catch {
        // Tolerate a transient blip; only give up after a sustained outage.
        if (++softFails >= 15) throw new Error('lost the connection while rendering');
        await new Promise((r) => setTimeout(r, 4000)); continue;
      }
      if (st.status === 'COMPLETED') break;
      // Fail fast on a model error instead of polling out the 12-minute budget.
      if (st.status === 'ERROR' || st.status === 'FAILED') throw new Error('the model failed on this shot');
      sbStudioProgress('Shot ' + idx + ': ' + (st.status === 'IN_PROGRESS' ? 'generating…' : 'queued…'));
      await new Promise((r) => setTimeout(r, 4000));
    }
    const out = await (await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url))).json();
    let urlOut = out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url;
    if (!urlOut) throw new Error('no video in result');
    // trySave/queuePendingSave live in chat.js: bounded retries, and a failed
    // copy queues a boot-time retry that swaps in the permanent URL later.
    const { url: perm } = await trySave(urlOut, 'video', 3);
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

// ── Real trim: cut a fresh clip on-device (ffmpeg.wasm) ───────────────────────
// The director asks for trim {start,end} (seconds within the shot). We render an
// actual clipped MP4 in the browser — free, private, frame-accurate — and swap
// it in as the shot's source. Degrades to the old in/out virtual trim if the
// on-device editor can't run (old browser, wasm blocked, or a render error).
async function sbApplyTrim(s, startRel, endRel) {
  const idx = sbProject().shots.indexOf(s) + 1;
  const base = s.in || 0;
  const winEnd = s.out != null ? s.out : (s.dur || 0);
  const absStart = base + Math.max(0, Number(startRel) || 0);
  let absEnd = endRel != null ? base + Number(endRel) : winEnd;
  if (winEnd && absEnd > winEnd) absEnd = winEnd;
  const durSec = Math.max(0.05, absEnd - absStart);
  // Fallback: keep the non-destructive in/out range (old behaviour).
  const virtualTrim = () => {
    s.in = absStart;
    if (endRel != null) s.out = absEnd;
    sbSave(); sbRender();
  };
  if (typeof window.sbFFTrim !== 'function' || !window.sbFFSupported || !window.sbFFSupported()) {
    virtualTrim();
    return;
  }
  const prevStatus = s.status;
  s.status = 'editing'; sbSave(); sbRender();
  try {
    const blob = await window.sbFFTrim(s.url, absStart, durSec, {
      url: s.url,
      onProgress: (p) => sbStudioProgress('Trimming shot ' + idx + '… ' + Math.round(p * 100) + '%'),
    });
    const newURL = URL.createObjectURL(blob);
    // A previous on-device edit left a blob we own — revoke it to free memory.
    if (s.local && typeof s.url === 'string' && s.url.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(s.url); } catch (e) {}
    }
    s.url = newURL; s.in = null; s.out = null; s.dur = durSec;
    s.status = 'ready'; s.edited = true; s.local = true;
    await sbThumb(s).catch(() => {});
    sbSave(); sbRender();
    sbStudioNote('Trimmed shot ' + idx + ' to ' + sbFmt(durSec) +
      ' ✂ — that’s a fresh clip living in this tab. Export or download it to keep it.');
  } catch (e) {
    console.error('on-device trim failed:', e);
    s.status = prevStatus;
    virtualTrim();
    sbStudioNote('I couldn’t render that trim on-device, so I set the shot’s in/out points instead.');
  }
}

// Swap a shot's source for a freshly-rendered on-device clip (blob), clearing
// any virtual in/out and marking it a tab-local edited file.
function sbSwapClip(s, blob, newDur) {
  const newURL = URL.createObjectURL(blob);
  if (s.local && typeof s.url === 'string' && s.url.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(s.url); } catch (e) {}
  }
  s.url = newURL; s.in = null; s.out = null;
  if (newDur != null) s.dur = newDur;
  s.status = 'ready'; s.edited = true; s.local = true;
}

// Shared runner for the render-and-swap edits (speed, reframe). `render(onProg)`
// returns the new clip Blob; `noteDone` builds the success message. Unlike trim
// there's no virtual fallback — if the editor can't run we just say so.
async function sbRenderEdit(s, verb, render, newDur, noteDone) {
  const idx = sbProject().shots.indexOf(s) + 1;
  if (!s.url || !window.sbFFSupported || !window.sbFFSupported()) {
    sbStudioNote('The on-device editor can’t run in this browser, so I couldn’t ' + verb + ' shot ' + idx + '.');
    return;
  }
  const prevStatus = s.status;
  s.status = 'editing'; sbSave(); sbRender();
  try {
    const blob = await render((p) => sbStudioProgress('Editing shot ' + idx + '… ' + Math.round(p * 100) + '%'));
    sbSwapClip(s, blob, newDur);
    await sbThumb(s).catch(() => {});
    sbSave(); sbRender();
    sbStudioNote(noteDone(idx));
  } catch (e) {
    console.error('on-device ' + verb + ' failed:', e);
    s.status = prevStatus; sbSave(); sbRender();
    sbStudioNote('I couldn’t ' + verb + ' shot ' + idx + ' on-device — ' + String(e.message || e).slice(0, 80) + '.');
  }
}

// Retime a shot (2 = twice as fast, 0.5 = slow motion). Applies to the shot's
// current window (an imported slice's in/out is honored).
async function sbApplySpeed(s, speed) {
  const spd = Math.max(0.25, Math.min(4, Number(speed) || 1));
  const winDur = sbShotDur(s) || 0;
  const newDur = winDur ? winDur / spd : null;
  await sbRenderEdit(s, 'change the speed of',
    (onProgress) => window.sbFFSpeed(s.url, spd, { url: s.url, start: s.in || 0, dur: winDur, onProgress }),
    newDur,
    (idx) => (spd >= 1 ? 'Sped shot ' + idx + ' up to ' + spd + '×' : 'Slowed shot ' + idx + ' to ' + spd + '×') +
      (newDur ? ' — now ' + sbFmt(newDur) : '') + '. Fresh clip in this tab; Export or download to keep it.');
}

// Re-crop a shot to a target aspect ratio (centered), e.g. 9:16 vertical.
async function sbApplyReframe(s, aspect) {
  const asp = /^\d+:\d+$/.test(String(aspect)) ? String(aspect) : '9:16';
  const winDur = sbShotDur(s) || 0;
  await sbRenderEdit(s, 'reframe',
    (onProgress) => window.sbFFReframe(s.url, asp, { url: s.url, start: s.in || 0, dur: winDur, onProgress }),
    winDur || null,
    (idx) => 'Reframed shot ' + idx + ' to ' + asp + '. Fresh clip in this tab; Export or download to keep it.');
}

// Resolve when the video seeks, but never hang: a decode error or a stalled
// source that emits no event would otherwise leave the caller awaiting forever.
function sbSeek(v, time) {
  return new Promise((ok, err) => {
    const to = setTimeout(() => err(new Error('seek timed out')), 12000);
    v.onerror = () => { clearTimeout(to); err(new Error('seek error')); };
    v.onseeked = () => { clearTimeout(to); ok(); };
    v.currentTime = time;
  });
}
function sbMeta(v) {
  return new Promise((ok, err) => {
    const to = setTimeout(() => err(new Error('load timed out')), 12000);
    v.onloadedmetadata = () => { clearTimeout(to); ok(); };
    v.onerror = () => { clearTimeout(to); err(new Error('load error')); };
  });
}

// Draw the last frame of a shot to a canvas → JPEG data URL (start image for
// the next shot). Needs CORS-readable media; falls back silently if tainted.
async function sbLastFrame(s) {
  const v = document.createElement('video');
  v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  v.src = s.url;
  await sbMeta(v);
  const t = (s.out != null ? s.out : v.duration) - 0.08;
  await sbSeek(v, Math.max(0, t));
  return sbGrabFrame(v, 1024).toDataURL('image/jpeg', 0.85);
}

async function sbThumb(s) {
  const v = document.createElement('video');
  v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'metadata';
  v.src = s.url;
  await sbMeta(v);
  s.dur = s.dur || v.duration;
  await sbSeek(v, Math.min(0.1, v.duration / 2));
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
    // Pick a container the browser can actually record. Chrome keeps webm/vp9;
    // Safari has no webm MediaRecorder, so fall through to mp4 (else its
    // constructor throws). Last resort: let the browser choose its default.
    const CANDS = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=h264,aac', 'video/mp4'];
    let mime = '';
    for (const c of CANDS) { if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) { mime = c; break; } }
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 }); }
    catch (e) { rec = new MediaRecorder(stream); }
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    const done = new Promise((ok) => { rec.onstop = ok; });
    rec.start(250);

    let ok = 0, skipped = 0;
    for (let i = 0; i < shots.length; i++) {
      sbStudioProgress('Exporting shot ' + (i + 1) + '/' + shots.length + '…');
      // One unreadable/stalled shot must not abort the whole export — skip it
      // and keep the shots that worked.
      try { await sbExportShot(shots[i], ctx, W, H, ac, dest); ok++; }
      catch (e) { console.warn('shot ' + (i + 1) + ' skipped:', e); skipped++; }
    }
    rec.stop();
    await done;
    ac.close().catch(() => {});
    if (!ok) { sbStudioNote('Export failed — none of the shots could be read (they may still be uploading, or blocked by the browser).'); return; }
    // Match the file to what the recorder actually produced (webm on Chrome,
    // mp4 on Safari) so the download opens cleanly.
    const outType = ((rec.mimeType || mime || 'video/webm').split(';')[0]) || 'video/webm';
    const ext = outType.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    const blob = new Blob(parts, { type: outType });
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = (sbProject().title.replace(/[^\w\- ]+/g, '') || 'film') + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000); // free the blob after the download starts
    sbStudioNote('Exported “' + sbProject().title + '” (' + ok + ' shot' + (ok === 1 ? '' : 's') +
      (skipped ? ', ' + skipped + ' skipped' : '') + ') — check your downloads ✦');
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
    let node = null, raf = 0, settled = false;
    const start = s.in || 0;
    const stopAt = s.out != null ? s.out : Infinity;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      clearTimeout(guard);
      try { if (node) node.disconnect(); } catch {}
      v.pause(); v.src = '';
    };
    const finish = (fn, arg) => { if (settled) return; settled = true; cleanup(); fn(arg); };
    // Hard stop: a shot that never loads or a remote stream that stalls (no
    // error event) can't hang the whole export. Bound to the clip length + 20s.
    const budget = ((sbShotDur(s) || 10) + 20) * 1000;
    const guard = setTimeout(() => finish(reject, new Error('shot timed out')), Math.min(budget, 180000));
    v.onerror = () => finish(reject, new Error('could not read a shot (CORS or codec)'));
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
          if (v.currentTime >= stopAt - 0.03 || v.ended) { finish(resolve); return; }
          raf = requestAnimationFrame(draw);
        };
        draw();
      }).catch((e) => finish(reject, e));
    };
  });
}

// ── isibi.ai chat panel ──────────────────────────────────────────────────────
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
  sbStudioProgress('isibi.ai is thinking…');
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
    const edits = [];
    for (const a of Array.isArray(data.actions) ? data.actions : []) {
      if (a.type === 'add_shots' && Array.isArray(a.shots)) {
        for (const ns of a.shots.slice(0, 12)) {
          proj.shots.push({
            id: sbUid('s'),
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
          // On-device edits (rendered after the loop, in the order listed).
          if (a.trim && s.url) {
            edits.push({ op: 'trim', s, start: Number(a.trim.start) || 0, end: a.trim.end != null ? Number(a.trim.end) : null });
          }
          if (a.speed && s.url) edits.push({ op: 'speed', s, speed: Number(a.speed) });
          if (a.reframe && s.url) edits.push({ op: 'reframe', s, aspect: String(a.reframe) });
        }
      } else if (a.type === 'remove_shot') {
        const s = proj.shots[a.n - 1];
        if (s) proj.shots.splice(a.n - 1, 1);
      } else if (a.type === 'reorder' && Array.isArray(a.order)) {
        // Require a true permutation — a duplicate index (e.g. [1,1,3]) would
        // alias one shot into two slots and silently drop another.
        const idx = a.order.map((n) => n - 1);
        const uniq = new Set(idx);
        const valid = idx.length === proj.shots.length && uniq.size === proj.shots.length &&
          idx.every((i) => i >= 0 && i < proj.shots.length);
        if (valid) proj.shots = idx.map((i) => proj.shots[i]);
      } else if (a.type === 'generate') {
        if (a.n === 'all') proj.shots.forEach((s) => { if (s.status === 'draft' && s.prompt) toGenerate.push(s); });
        else { const s = proj.shots[a.n - 1]; if (s && s.prompt) toGenerate.push(s); }
      }
    }
    sbSave(); sbRender();
    // Real on-device edits first (ffmpeg loads once, ops are serialized).
    for (const e of edits) {
      if (e.op === 'trim') await sbApplyTrim(e.s, e.start, e.end);
      else if (e.op === 'speed') await sbApplySpeed(e.s, e.speed);
      else if (e.op === 'reframe') await sbApplyReframe(e.s, e.aspect);
    }
    // Generate sequentially so last-frame chaining sees each finished shot.
    for (const s of toGenerate) await sbGenerateShot(s);
  } catch (e) {
    sbStudioNote('I couldn’t reach the director — try that again in a moment.');
  }
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
