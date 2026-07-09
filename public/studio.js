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
let sbZoomLevel = 1;        // timeline zoom (1 = fit; >1 scrolls)
let sbTitleState = null;    // {id, elapsed} while a title card is "playing"
let sbTitleRAF = 0;
let sbTab = 'shots';        // asset browser tab: shots | transitions | titles | backgrounds

// Account switched on this browser (expired session → different login without
// a reload): drop the previous user's projects from memory and rebuild from
// the now-wiped storage, so Studio never shows the old account's work.
function sbResetForAccountSwitch() {
  sb = { active: null, projects: [] };
  sbSelected = null; sbPlaying = null; sbBusy = false; sbSegment = null;
  if (typeof sbPreviewClear === 'function') sbPreviewClear(); // wipe the old user's video from the stage
  if (typeof sbMediaClear === 'function') sbMediaClear();      // drop the old user's stored imports
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
      // Imported shots reference blob: URLs that die with the page. Persisted
      // ones (stored in IndexedDB) get rehydrated after load → 'restoring';
      // only truly-gone clips become 'missing'.
      if (s.url && s.url.startsWith('blob:')) {
        s.url = null;
        if (s.status === 'ready') s.status = (s.src === 'import' && s.stored) ? 'restoring' : 'missing';
      }
      // A shot left mid-render when the tab closed (Studio has no boot-resume)
      // would be a permanent ⏳ that no button restarts — reset it so it can run
      // again (or shows its result if the URL survived).
      if (s.status === 'generating') s.status = s.url ? 'ready' : 'draft';
      // Library vs. timeline: a clip lives in the left list; only clips added to
      // the film show on the bottom timeline. Older projects (no flag) and
      // AI-generated shots default onto the timeline; imports start off it.
      if (s.onTimeline === undefined) s.onTimeline = true;
      // srcDur = the full length of the underlying source, the ceiling for trim
      // handles. Refined from the real video on first load; seed it from what we
      // know so existing shots can be trimmed before they're ever played.
      if (s.srcDur === undefined) s.srcDur = (s.out != null ? s.out : s.dur) || 0;
    }
    // A background music/voice track survives a reload the same way imports do.
    if (p.music && p.music.stored && p.music.url && p.music.url.startsWith('blob:')) p.music.url = null;
    if (p.voice && p.voice.stored && p.voice.url && p.voice.url.startsWith('blob:')) p.voice.url = null;
    // All audio is green now — drop a cached purple voice waveform so it redraws.
    if (p.voice && p.voice.wave && !p.voice._green) { p.voice.wave = null; p.voice._waveFailed = false; p.voice._green = true; }
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
      sb.projects.forEach((p) => p.shots.forEach((s) => { if (s.thumb) s.thumb = null; if (s.strip) s.strip = null; }));
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

// ── Persistent import store (IndexedDB) ─────────────────────────────────────
// Imported clips live as blob: URLs that die on reload. To make an import "just
// stay there", we also stash the actual file blob in IndexedDB keyed by shot id
// and rehydrate a fresh object URL on load. localStorage (the project JSON) is
// too small for video; IndexedDB holds blobs with a much larger quota.
const SB_DB = 'zephyr_studio_media', SB_STORE = 'clips';
function sbIDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(SB_DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(SB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function sbMediaPut(id, blob) {
  const db = await sbIDB();
  await new Promise((ok, err) => {
    const tx = db.transaction(SB_STORE, 'readwrite');
    tx.objectStore(SB_STORE).put(blob, id);
    tx.oncomplete = ok; tx.onerror = () => err(tx.error); tx.onabort = () => err(tx.error);
  });
}
async function sbMediaGet(id) {
  try {
    const db = await sbIDB();
    return await new Promise((ok, err) => {
      const tx = db.transaction(SB_STORE, 'readonly');
      const r = tx.objectStore(SB_STORE).get(id);
      r.onsuccess = () => ok(r.result || null); r.onerror = () => err(r.error);
    });
  } catch (e) { return null; }
}
async function sbMediaDel(id) {
  try {
    const db = await sbIDB();
    await new Promise((ok) => {
      const tx = db.transaction(SB_STORE, 'readwrite');
      tx.objectStore(SB_STORE).delete(id);
      tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
    });
  } catch (e) {}
}
async function sbMediaClear() {
  try {
    const db = await sbIDB();
    await new Promise((ok) => {
      const tx = db.transaction(SB_STORE, 'readwrite');
      tx.objectStore(SB_STORE).clear();
      tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
    });
  } catch (e) {}
}
// Rebuild object URLs for persisted imports after a reload, then re-render.
async function sbRehydrateImports() {
  let changed = false;
  for (const p of sb.projects) {
    for (const s of p.shots) {
      if (s.src === 'import' && s.stored && !s.url) {
        const blob = await sbMediaGet(s.id);
        if (blob) { s.url = URL.createObjectURL(blob); s.status = 'ready'; }
        else { s.status = 'missing'; }
        changed = true;
      }
    }
    if (p.music && p.music.stored && !p.music.url) {
      const blob = await sbMediaGet('music-' + p.id);
      if (blob) { p.music.url = URL.createObjectURL(blob); }
      else { p.music = null; } // the stored file is gone — drop the dead track
      changed = true;
    }
    if (p.voice && p.voice.stored && !p.voice.url) {
      const blob = await sbMediaGet('voice-' + p.id);
      if (blob) { p.voice.url = URL.createObjectURL(blob); }
      else { p.voice = null; }
      changed = true;
    }
  }
  if (changed) { sbSave(); sbRender(); sbMusicLoad(); sbVoiceLoad(); }
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
        '<button class="sb-tl' + (s.onTimeline ? ' on' : '') + '" title="' +
          (s.onTimeline ? 'On the timeline — click to remove from your film' : 'Add this clip to the timeline') +
          '">' + (s.onTimeline ? '🎞' : '＋') + '</button>' +
        '<button class="sb-x" title="Remove clip">×</button>';
      // Imported clips carry no title label — the user just wants the frame.
      card.querySelector('b').textContent = s.src === 'import' ? '' : (s.title || 'Shot ' + (i + 1));
      card.querySelector('small').textContent =
        sbFmt(sbShotDur(s)) + ' · ' + (s.status === 'draft' ? 'not generated' : s.status) +
        (s.onTimeline ? '' : ' · in list');
      card.onclick = (e) => {
        const c = e.target.className || '';
        if (c !== 'sb-x' && c.indexOf('sb-tl') < 0) sbSelect(s.id);
      };
      card.querySelector('.sb-tl').onclick = (e) => { e.stopPropagation(); sbToggleTimeline(s.id); };
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
  // shot strip on the timeline — only the clips the user has added to the film
  const track = document.getElementById('timelineTrack');
  if (track) {
    const tl = proj.shots.filter((s) => s.onTimeline);
    track.innerHTML = '';
    track.classList.toggle('has-shots', tl.length > 0);
    // Dropping a library clip onto the track adds it to the film.
    track.ondragover = (e) => { e.preventDefault(); track.classList.add('drop-here'); };
    track.ondragleave = () => track.classList.remove('drop-here');
    track.ondrop = (e) => {
      e.preventDefault(); track.classList.remove('drop-here');
      // A title/background dragged in from the browser tabs.
      const asset = e.dataTransfer.getData('text/sb-asset');
      if (asset) {
        try { const a = JSON.parse(asset); if (a.kind === 'title') sbAddTitlePreset(a); else if (a.kind === 'bg') sbAddBackground(a); } catch (_) {}
        return;
      }
      const id = e.dataTransfer.getData('text/sb');
      if (id) sbAddToTimeline(id);
    };
    if (!tl.length) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.textContent = 'Drag a clip here — or tap ＋ on a clip in the list — to build your film.';
      track.appendChild(empty);
    }
    // iMovie-style stacked lanes, all sharing one time axis + one playhead. The
    // track is the scroll viewport; tlInner grows past 100% when zoomed in.
    const inner = document.createElement('div');
    inner.className = 'tl-inner';
    inner.style.minWidth = (sbZoomLevel * 100) + '%';
    track.appendChild(inner);
    const total = tl.reduce((a, s) => a + (sbShotDur(s) || 4), 0) || 1;

    // Video lane: clips butt together, positioned by time so they line up with
    // the audio lanes below.
    const vlane = document.createElement('div');
    vlane.className = 'tl-lane tl-video';
    inner.appendChild(vlane);
    let cum = 0;
    tl.forEach((s) => {
      const n = proj.shots.indexOf(s) + 1;
      const isTitle = s.src === 'title';
      const dur = sbShotDur(s) || 4;
      const block = document.createElement('div');
      block.className = 'clip-block sb-block' + (s.id === sbSelected ? ' sel' : '') + ' st-' + s.status + (isTitle ? ' sb-title' : '');
      block.style.left = (cum / total * 100) + '%';
      block.style.width = (dur / total * 100) + '%';
      cum += dur;
      let body = '';
      if (isTitle) {
        block.style.background = s.bg || 'linear-gradient(135deg,#ff79c6,#ffb84d)';
        body = '<span class="sb-titletext"></span>';
      } else {
        // iMovie-style filmstrip: real sampled frames when we have them,
        // otherwise repeat the poster thumb across the clip (one tile per ~1.4s)
        // so it still reads as a strip of frames rather than one flat block.
        const frames = (Array.isArray(s.strip) && s.strip.length)
          ? s.strip
          : (s.thumb ? Array(Math.max(2, Math.min(8, Math.round(dur / 1.4)))).fill(s.thumb) : []);
        if (frames.length) {
          body = '<div class="sb-strip">' +
            frames.map((src) => '<i class="sb-frame" style="background-image:url(\'' + src + '\')"></i>').join('') +
            '</div>';
        }
      }
      // Per-clip label bar: amber duration + name, iMovie-style ("4.0s Skyline dawn").
      block.innerHTML = body +
        '<span class="sb-cliplabel"><b class="cl-dur"></b><span class="cl-name"></span></span>' +
        (isTitle ? '' : '<button class="sb-cmute" title="Mute this clip">' + (s.muted ? '🔇' : '🔊') + '</button>') +
        '<span class="sb-trim l" title="Trim the start"></span>' +
        '<span class="sb-trim r" title="Trim the end"></span>';
      block.querySelector('.cl-dur').textContent = (Math.round(sbShotDur(s) * 10) / 10) + 's';
      block.querySelector('.cl-name').textContent = isTitle ? '' : (s.src === 'import' ? 'Clip ' + n : (s.title || 'Shot ' + n));
      if (isTitle) {
        const tt = block.querySelector('.sb-titletext');
        tt.textContent = s.text || '';
        tt.style.color = sbTitleInk(s);
      }
      block.querySelector('.sb-trim.l').addEventListener('pointerdown', (e) => sbTrimStart(e, s, 'l'));
      block.querySelector('.sb-trim.r').addEventListener('pointerdown', (e) => sbTrimStart(e, s, 'r'));
      const mute = block.querySelector('.sb-cmute');
      if (mute) {
        mute.addEventListener('pointerdown', (e) => e.stopPropagation());
        mute.addEventListener('click', (e) => { e.stopPropagation(); sbToggleClipMute(s.id); });
      }
      if (isTitle) block.addEventListener('dblclick', (e) => { e.stopPropagation(); sbEditTitle(s.id); });
      vlane.appendChild(block);
    });

    // Audio lanes (music, then voice) as waveform clips from the film's start.
    if (proj.music && proj.music.url) sbAudioLane(inner, proj.music, 'music', total);
    if (proj.voice && proj.voice.url) sbAudioLane(inner, proj.voice, 'voice', total);

    // One playhead spanning every lane.
    const ph = document.createElement('div');
    ph.className = 'playhead';
    ph.style.display = 'none';
    inner.appendChild(ph);
    // Click / drag anywhere on the lanes to move the playhead there and seek.
    track.onpointerdown = (e) => {
      if (e.target.closest('.sb-trim') || e.target.closest('.tl-actrl')) return;
      if (!tl.length) return;
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
      sbScrubbing = true;
      sbScrubToClientX(e.clientX);
      const move = (ev) => { if (sbScrubbing) sbScrubToClientX(ev.clientX); };
      const up = () => {
        sbScrubbing = false;
        track.removeEventListener('pointermove', move);
        track.removeEventListener('pointerup', up);
        track.removeEventListener('pointercancel', up);
      };
      track.addEventListener('pointermove', move);
      track.addEventListener('pointerup', up);
      track.addEventListener('pointercancel', up);
    };
    sbUpdatePlayhead(document.querySelector('#previewStage video'));
  }
  const totalEl = document.getElementById('sbTotalDur');
  if (totalEl) {
    const tl = proj.shots.filter((s) => s.onTimeline);
    const ready = tl.filter((s) => s.status === 'ready').length;
    totalEl.textContent = tl.length
      ? sbFmt(tl.reduce((a, s) => a + sbShotDur(s), 0)) + ' · ' + ready + '/' + tl.length + ' shots ready'
      : '';
  }
  sbMusicLoad();
  sbVoiceLoad();
  sbRenderStyleControls();
  sbRenderBrowser();
}

// One audio lane (music or voice) drawn as a waveform clip from the film start,
// with hover controls (volume, and for music fade/duck, plus remove).
function sbAudioLane(inner, tr, kind, total) {
  const dur = tr.dur || total;
  const lane = document.createElement('div');
  lane.className = 'tl-lane tl-audio tl-' + kind;
  const clip = document.createElement('div');
  clip.className = 'tl-aclip';
  clip.style.width = Math.min(100, (dur / total) * 100) + '%';
  const esc2 = (typeof esc === 'function') ? esc : (x) => x;
  const nm = (kind === 'music' ? '♪ ' : '🎙 ') + (tr.name || kind);
  const vol = tr.volume != null ? tr.volume : (kind === 'music' ? 0.6 : 1);
  clip.innerHTML =
    '<span class="tl-wave"' + (tr.wave ? ' style="background-image:url(' + tr.wave + ')"' : '') + '></span>' +
    '<span class="tl-alabel">' + esc2(nm) + '</span>' +
    '<span class="tl-actrl">' +
      '<input class="tl-avol" type="range" min="0" max="1" step="0.05" value="' + vol + '" title="Volume" />' +
      (kind === 'music'
        ? '<button class="tl-achip tl-fade' + (tr.fade ? ' on' : '') + '" title="Fade in/out">Fade</button>' +
          '<button class="tl-achip tl-duck' + (tr.duck ? ' on' : '') + '" title="Duck under clips with sound">Duck</button>'
        : '') +
      '<button class="tl-ax" title="Remove ' + kind + '">×</button>' +
    '</span>';
  const av = clip.querySelector('.tl-avol');
  av.addEventListener('pointerdown', (e) => e.stopPropagation());
  av.addEventListener('input', () => {
    tr.volume = Math.max(0, Math.min(1, parseFloat(av.value)));
    const a = document.getElementById(kind === 'music' ? 'sbMusicAudio' : 'sbVoiceAudio');
    if (a) a.volume = tr.volume;
    sbSave();
  });
  const ax = clip.querySelector('.tl-ax');
  ax.addEventListener('pointerdown', (e) => e.stopPropagation());
  ax.addEventListener('click', (e) => { e.stopPropagation(); if (kind === 'music') sbRemoveMusic(); else sbRemoveVoice(); });
  if (kind === 'music') {
    const fd = clip.querySelector('.tl-fade'), dk = clip.querySelector('.tl-duck');
    fd.addEventListener('pointerdown', (e) => e.stopPropagation());
    fd.addEventListener('click', (e) => { e.stopPropagation(); tr.fade = !tr.fade; sbSave(); sbRender(); });
    dk.addEventListener('pointerdown', (e) => e.stopPropagation());
    dk.addEventListener('click', (e) => { e.stopPropagation(); tr.duck = !tr.duck; sbSave(); sbRender(); });
  }
  lane.appendChild(clip);
  inner.appendChild(lane);
  if (!tr.wave && !tr._waving && !tr._waveFailed) sbBuildWave(tr, kind);
}
// Decode an audio track to an iMovie-style waveform image: a darker filled shape
// mirrored around the centre, drawn on transparent canvas so the solid clip body
// (green for music, purple for voice) reads through it.
async function sbBuildWave(tr, kind) {
  if (!tr || !tr.url || tr._waving) return;
  tr._waving = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const bytes = await fetch(tr.url).then((r) => r.arrayBuffer());
    const audio = await ac.decodeAudioData(bytes);
    const ch = audio.getChannelData(0);
    const W = 1600, H = 120, mid = H / 2, amp = mid - 2, peaks = 500;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d');
    const bucket = Math.max(1, Math.floor(ch.length / peaks));
    const stride = Math.max(1, Math.floor(bucket / 40));
    const vals = new Array(peaks);
    for (let i = 0; i < peaks; i++) {
      let max = 0; const base = i * bucket;
      for (let j = 0; j < bucket; j += stride) { const v = Math.abs(ch[base + j] || 0); if (v > max) max = v; }
      vals[i] = Math.min(1, max);
    }
    cx.fillStyle = 'rgba(11,66,32,.5)'; // darker green — all audio is green, like iMovie
    cx.beginPath();
    cx.moveTo(0, mid);
    for (let i = 0; i < peaks; i++) { const x = (i / (peaks - 1)) * W; cx.lineTo(x, mid - Math.max(1.2, vals[i] * amp)); }
    for (let i = peaks - 1; i >= 0; i--) { const x = (i / (peaks - 1)) * W; cx.lineTo(x, mid + Math.max(1.2, vals[i] * amp)); }
    cx.closePath(); cx.fill();
    tr.wave = c.toDataURL('image/png');
    ac.close().catch(() => {});
  } catch (e) { tr._waveFailed = true; /* keep the solid clip body, don't retry */ }
  finally { tr._waving = false; sbRender(); }
}

// Add/remove a clip to the film (the bottom timeline). The clip stays in the
// left library either way — the timeline is just the ordered subset that plays
// and exports.
function sbAddToTimeline(id) {
  const s = sbShot(id);
  if (!s || s.onTimeline) return;
  s.onTimeline = true;
  sbSave(); sbRender();
}
function sbToggleTimeline(id) {
  const s = sbShot(id);
  if (!s) return;
  s.onTimeline = !s.onTimeline;
  sbSave(); sbRender();
}
function sbToggleClipMute(id) {
  const s = sbShot(id);
  if (!s) return;
  s.muted = !s.muted;
  const v = document.querySelector('#previewStage video');
  if (v && sbSelected === id) v.volume = s.muted ? 0 : 1;
  sbSave(); sbRender();
}
function sbSetZoom(level) {
  sbZoomLevel = Math.max(1, Math.min(6, level || 1));
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (inner) inner.style.minWidth = (sbZoomLevel * 100) + '%';
}
// Film-wide export style (both already honored by the exporters).
function sbSetTransition(v) {
  const proj = sbProject();
  proj.transition = ['crossfade', 'dip', 'none'].indexOf(v) >= 0 ? v : 'none';
  sbSave();
}
function sbToggleFade() {
  const proj = sbProject();
  proj.fade = !proj.fade;
  sbSave();
  sbRenderStyleControls();
}
function sbRenderStyleControls() {
  const proj = sbProject();
  const sel = document.getElementById('sbTransition');
  if (sel) sel.value = proj.transition || 'none';
  const fb = document.getElementById('sbFadeBtn');
  if (fb) { fb.textContent = 'Fade ' + (proj.fade ? '●' : '○'); fb.classList.toggle('on', !!proj.fade); }
  const zoom = document.getElementById('sbZoom');
  if (zoom) zoom.value = sbZoomLevel;
}

// Map the currently-playing clip + its progress onto a left-offset across the
// timeline, so a single line tracks the film position.
function sbUpdatePlayhead(v) {
  const track = document.getElementById('timelineTrack');
  const ph = track && track.querySelector('.playhead');
  if (!ph) return;
  const tl = sbProject().shots.filter((s) => s.onTimeline);
  const idx = tl.findIndex((s) => s.id === sbSelected);
  if (idx < 0) { ph.style.display = 'none'; return; }
  const total = tl.reduce((a, s) => a + (sbShotDur(s) || 4), 0) || 1;
  let before = 0;
  for (let k = 0; k < idx; k++) before += (sbShotDur(tl[k]) || 4);
  const s = tl[idx];
  const dur = sbShotDur(s) || 4;
  let within;
  if (s.src === 'title') within = (sbTitleState && sbTitleState.id === s.id) ? Math.min(dur, sbTitleState.elapsed) : 0;
  else { if (!v) { ph.style.display = 'none'; return; } within = Math.min(dur, Math.max(0, v.currentTime - (s.in || 0))); }
  ph.style.left = ((before + within) / total * 100).toFixed(2) + '%';
  ph.style.display = '';
}

// ── Click-to-seek / scrub ───────────────────────────────────────────────────
let sbScrubbing = false;
// Map a pixel x on the track to a fraction of the film, then seek there.
function sbScrubToClientX(clientX) {
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (!inner) return;
  const rect = inner.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
  sbSeekFilmFraction(frac);
}
// Fraction of the whole film → the clip under it + the offset inside that clip.
function sbSeekFilmFraction(frac) {
  const tl = sbProject().shots.filter((s) => s.onTimeline);
  if (!tl.length) return;
  const durs = tl.map((s) => sbShotDur(s) || 4);
  const total = durs.reduce((a, b) => a + b, 0) || 1;
  let t = frac * total, acc = 0, idx = 0, off = 0;
  for (let k = 0; k < tl.length; k++) {
    if (t <= acc + durs[k] || k === tl.length - 1) { idx = k; off = Math.max(0, Math.min(durs[k], t - acc)); break; }
    acc += durs[k];
  }
  sbSeekClip(tl[idx], off);
}
// Load (if needed) a clip and seek to `off` seconds into it, keeping play state.
function sbSeekClip(s, off) {
  if (s.src === 'title') {
    if (sbSelected !== s.id) { sbSelected = s.id; sbPlaying = null; sbRender(); }
    sbStopTitle();
    sbTitleState = { id: s.id, elapsed: off || 0, playing: false };
    sbShowTitleCard(s);
    sbUpdatePlayhead(null);
    sbMusicSync(null);
    return;
  }
  const v = sbVideoEl();
  const wasPlaying = v && !v.paused && !v.ended;
  if (sbSelected !== s.id) { sbSelected = s.id; sbPlaying = null; sbRender(); }
  sbStopTitle();
  if (!v) return;
  if (!s.url) { sbUpdatePlayhead(v); return; }
  sbSegment = { out: s.out != null ? s.out : null, next: null };
  const target = (s.in || 0) + off;
  const doSeek = () => {
    sbNoteSrcDur(s, v);
    v.volume = s.muted ? 0 : 1;
    try { v.currentTime = target; } catch (_) {}
    if (wasPlaying) v.play().catch(() => {});
    sbUpdatePlayhead(v);
    sbMusicSync(v);
  };
  if (v.dataset.src !== s.url) {
    v.dataset.src = s.url; v.src = s.url;
    v.addEventListener('loadedmetadata', doSeek, { once: true });
  } else doSeek();
}

// ── Trim handles ────────────────────────────────────────────────────────────
// Drag a clip edge to change its in/out. dx across the track maps 1:1 to film
// seconds (the track spans the whole film), which is the same as source seconds.
function sbTrimStart(e, s, side) {
  e.stopPropagation(); e.preventDefault();
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (!inner) return;
  const handle = e.currentTarget;
  try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  const rect = inner.getBoundingClientRect();
  const tl = sbProject().shots.filter((x) => x.onTimeline);
  const total = tl.reduce((a, x) => a + (sbShotDur(x) || 4), 0) || 1;
  const startX = e.clientX;
  const in0 = s.in || 0;
  const out0 = s.out != null ? s.out : (s.srcDur || sbShotDur(s) || 0);
  const cap = s.srcDur || out0 || sbShotDur(s) || 0;
  const MINLEN = 0.3;
  const block = handle.closest('.clip-block');
  const snap = (val) => { const r = Math.round(val * 2) / 2; return Math.abs(r - val) < 0.12 ? r : val; }; // gentle 0.5s snap
  const move = (ev) => {
    const dSec = ((ev.clientX - startX) / (rect.width || 1)) * total;
    if (side === 'l') s.in = Math.max(0, Math.min(snap(in0 + dSec), out0 - MINLEN));
    else s.out = Math.min(cap || (out0 + dSec), Math.max(in0 + MINLEN, snap(out0 + dSec)));
    // Live width feedback against the pre-drag total (re-rendered exactly on drop).
    if (block) block.style.width = Math.max(6, ((sbShotDur(s) || 4) / total) * 100) + '%';
    const tc = document.getElementById('studioTimecode');
    if (tc) tc.textContent = 'Trim · ' + sbFmt(sbShotDur(s));
  };
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    sbSave(); sbRender();
    // Re-seek to the (possibly new) in-point so the preview reflects the trim.
    if (sbSelected === s.id) sbSeekClip(s, 0);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

// ── Split at playhead ───────────────────────────────────────────────────────
// Cut the selected timeline clip into two at the current preview position. Both
// halves reference the same source; only their in/out ranges differ.
function sbSplitAtPlayhead() {
  const s = sbShot(sbSelected);
  if (!s || !s.onTimeline) { sbStudioNote('Pick a clip on the timeline first, then scrub to where you want to split it.'); return; }
  const v = document.querySelector('#previewStage video');
  if (!v || v.dataset.src !== s.url) { sbStudioNote('Play or scrub the clip to the split point first.'); return; }
  const inP = s.in || 0;
  const outP = s.out != null ? s.out : (s.srcDur || (inP + sbShotDur(s)));
  const cut = v.currentTime;
  const MIN = 0.3;
  if (cut <= inP + MIN || cut >= outP - MIN) { sbStudioNote('Scrub nearer the middle of the clip — too close to an edge to split.'); return; }
  const proj = sbProject();
  const i = proj.shots.indexOf(s);
  const b = Object.assign({}, s, { id: sbUid('s'), in: cut, out: outP, thumb: null, strip: null });
  s.out = cut;
  proj.shots.splice(i + 1, 0, b);
  sbSave(); sbRender();
  if (s.url) { sbBuildStrip(s); sbBuildStrip(b); } // refresh both halves' frames
  sbStudioNote('Split into two clips at ' + sbFmt(cut) + '.');
}

// Rebuild a clip's poster + filmstrip honoring its in/out window (used after a
// split so each half shows its own frames rather than the whole source).
async function sbBuildStrip(s) {
  if (!s.url) return;
  const v = document.createElement('video');
  v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'metadata'; v.src = s.url;
  try {
    await sbMeta(v);
    const inP = s.in || 0;
    const outP = s.out != null ? s.out : v.duration;
    const span = Math.max(0.1, outP - inP);
    await sbSeek(v, Math.min(inP + span / 2, outP - 0.01));
    s.thumb = sbGrabFrame(v, 480).toDataURL('image/jpeg', 0.72);
    const SEC_PER_FRAME = 0.5, MAX_FRAMES = 30;
    const n = Math.max(2, Math.min(MAX_FRAMES, Math.ceil(span / SEC_PER_FRAME)));
    const frames = [];
    for (let i = 0; i < n; i++) {
      await sbSeek(v, Math.min(inP + (span * (i + 0.5)) / n, outP - 0.01));
      frames.push(sbGrabFrame(v, 160).toDataURL('image/jpeg', 0.5));
    }
    s.strip = frames;
    sbSave(); sbRender();
  } catch (e) { /* keep whatever we had */ }
}

// ── Music / audio track ─────────────────────────────────────────────────────
// A single background track per project. Plays under the film during preview +
// Play film, and mixes into the export. Persisted in IndexedDB like imports.
function sbMusicEl() {
  let a = document.getElementById('sbMusicAudio');
  if (!a) { a = document.createElement('audio'); a.id = 'sbMusicAudio'; a.preload = 'auto'; document.body.appendChild(a); }
  return a;
}
function sbMusicLoad() {
  const m = sbProject().music;
  const a = sbMusicEl();
  if (!m || !m.url) { a.pause(); if (a.dataset.src) { a.removeAttribute('src'); a.dataset.src = ''; try { a.load(); } catch (_) {} } return; }
  if (a.dataset.src !== m.url) { a.dataset.src = m.url; a.src = m.url; }
  a.volume = m.volume != null ? m.volume : 0.6;
}
// Cumulative film position (seconds) of the current clip + offset.
function sbFilmTime() {
  const tl = sbProject().shots.filter((s) => s.onTimeline);
  const idx = tl.findIndex((s) => s.id === sbSelected);
  if (idx < 0) return 0;
  let before = 0;
  for (let k = 0; k < idx; k++) before += (sbShotDur(tl[k]) || 4);
  const s = tl[idx];
  let within = 0;
  if (s.src === 'title') within = (sbTitleState && sbTitleState.id === s.id) ? sbTitleState.elapsed : 0;
  else { const v = document.querySelector('#previewStage video'); within = v ? Math.min(sbShotDur(s) || 4, Math.max(0, v.currentTime - (s.in || 0))) : 0; }
  return before + Math.min(sbShotDur(s) || 4, within);
}
// Effective music volume — base, dipped when ducking under a clip with audio.
function sbMusicVol() {
  const m = sbProject().music;
  if (!m) return 0;
  let vol = m.volume != null ? m.volume : 0.6;
  if (m.duck) {
    const s = sbShot(sbSelected);
    const overAudio = s && s.src !== 'title' && !s.muted; // a talking clip is playing
    if (overAudio) vol *= 0.4;
  }
  return vol;
}
// Keep the music element aligned to the film position + play/pause state.
function sbMusicSync(v, opts) {
  const m = sbProject().music;
  const a = document.getElementById('sbMusicAudio');
  if (!m || !m.url) { if (a && !a.paused) a.pause(); return; }
  sbMusicLoad();
  const am = sbMusicEl();
  am.volume = sbMusicVol();
  const ft = sbFilmTime();
  const target = (m.dur && m.dur > 0.1) ? (ft % m.dur) : ft; // loop if film outlasts the track
  if ((opts && opts.hard) || Math.abs((am.currentTime || 0) - target) > 0.35) {
    try { am.currentTime = target; } catch (_) {}
  }
  const playing = (sbTitleState && sbTitleState.playing) || (v && !v.paused && !v.ended);
  if (playing) { if (am.paused) am.play().catch(() => {}); }
  else if (!am.paused) am.pause();
  sbVoiceSync(v, opts);
}
// The voiceover plays from the start of the film (film time 0), no loop.
function sbVoiceEl() {
  let a = document.getElementById('sbVoiceAudio');
  if (!a) { a = document.createElement('audio'); a.id = 'sbVoiceAudio'; a.preload = 'auto'; document.body.appendChild(a); }
  return a;
}
function sbVoiceLoad() {
  const vo = sbProject().voice;
  const a = sbVoiceEl();
  if (!vo || !vo.url) { a.pause(); if (a.dataset.src) { a.removeAttribute('src'); a.dataset.src = ''; } return; }
  if (a.dataset.src !== vo.url) { a.dataset.src = vo.url; a.src = vo.url; }
  a.volume = vo.volume != null ? vo.volume : 1;
}
function sbVoiceSync(v, opts) {
  const vo = sbProject().voice;
  const a = document.getElementById('sbVoiceAudio');
  if (!vo || !vo.url) { if (a && !a.paused) a.pause(); return; }
  sbVoiceLoad();
  const av = sbVoiceEl();
  const ft = sbFilmTime();
  if (vo.dur && ft > vo.dur + 0.2) { if (!av.paused) av.pause(); return; } // voice ran out
  if ((opts && opts.hard) || Math.abs((av.currentTime || 0) - ft) > 0.35) { try { av.currentTime = ft; } catch (_) {} }
  const playing = (sbTitleState && sbTitleState.playing) || (v && !v.paused && !v.ended);
  if (playing) { if (av.paused) av.play().catch(() => {}); }
  else if (!av.paused) av.pause();
}
async function sbSetMusic(f) {
  const proj = sbProject();
  const url = URL.createObjectURL(f);
  proj.music = { name: f.name.replace(/\.[^.]+$/, ''), mime: f.type || '', url, stored: false, dur: 0, volume: 0.6 };
  sbSave(); sbRenderMusicBar();
  try { await sbMediaPut('music-' + proj.id, f); proj.music.stored = true; }
  catch (e) { console.warn('could not persist music (kept for this tab only):', e); }
  try {
    const a = document.createElement('audio'); a.preload = 'metadata'; a.src = url;
    await new Promise((ok, err) => { a.onloadedmetadata = ok; a.onerror = err; });
    proj.music.dur = a.duration || 0;
  } catch (e) {}
  sbSave(); sbRenderMusicBar(); sbMusicLoad();
  sbStudioNote('Added music: “' + proj.music.name + '”. It plays under your film and exports with it — drag the slider to balance it.');
}
function sbRemoveMusic() {
  const proj = sbProject();
  if (!proj.music) return;
  const a = document.getElementById('sbMusicAudio');
  if (a) { a.pause(); a.removeAttribute('src'); a.dataset.src = ''; }
  if (proj.music.stored) sbMediaDel('music-' + proj.id);
  proj.music = null;
  sbSave(); sbRenderMusicBar();
}
function sbSetMusicVolume(val) {
  const proj = sbProject();
  if (!proj.music) return;
  proj.music.volume = Math.max(0, Math.min(1, val));
  const a = document.getElementById('sbMusicAudio');
  if (a) a.volume = proj.music.volume;
  sbSave();
}
// Music/voice now live as waveform lanes in the timeline; these just refresh it.
function sbRenderMusicBar() { sbMusicLoad(); sbRender(); }

// ── Title / text cards ──────────────────────────────────────────────────────
function sbAddTitle() {
  const text = prompt('Title text:', 'Title');
  if (text == null) return;
  const proj = sbProject();
  const t = {
    id: sbUid('s'), title: 'Title', text: String(text).slice(0, 120) || 'Title',
    prompt: '', status: 'ready', src: 'title', onTimeline: true,
    dur: 3, in: 0, out: 3, srcDur: 3, g0: '#ff79c6', g1: '#ffb84d', bg: sbGrad('#ff79c6', '#ffb84d'),
  };
  proj.shots.push(t);
  sbSave(); sbRender(); sbSelect(t.id);
  sbStudioNote('Added a title card. Drag its edges to change how long it holds; double-click it on the timeline to edit the text.');
}
function sbEditTitle(id) {
  const s = sbShot(id);
  if (!s || s.src !== 'title') return;
  const text = prompt('Title text:', s.text || 'Title');
  if (text == null) return;
  s.text = String(text).slice(0, 120) || 'Title';
  sbSave(); sbRender();
  if (sbSelected === id) sbShowTitleCard(s);
}
function sbShowTitleCard(s) {
  const stage = document.getElementById('previewStage');
  if (!stage) return;
  stage.innerHTML = '<div class="preview-title" style="background:' + (s.bg || sbGrad('#ff79c6', '#ffb84d')) + ';color:' + sbTitleInk(s) + '"><span></span></div>';
  stage.querySelector('.preview-title span').textContent = s.text || '';
}
// Relative luminance of a #hex colour (0..1), for picking readable ink.
function sbHexLum(h) {
  h = String(h || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
// White ink on dark title/background gradients, near-black on light ones.
function sbTitleInk(s) {
  const l = (sbHexLum(s.g0 || '#ff79c6') + sbHexLum(s.g1 || '#ffb84d')) / 2;
  return l < 0.52 ? '#ffffff' : '#0b0b10';
}
function sbGrad(a, b) { return 'linear-gradient(135deg,' + a + ',' + b + ')'; }

// Draw a title/background card onto the export canvas (word-wrapped, centered).
// A background clip carries an empty text and paints the gradient only.
function sbPaintTitle(ctx, W, H, s) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, s.g0 || '#ff79c6'); g.addColorStop(1, s.g1 || '#ffb84d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const txt = String(s.text || '').trim();
  if (!txt) return; // background: gradient only
  ctx.fillStyle = sbTitleInk(s);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = Math.round(H * 0.12);
  ctx.font = '700 ' + fs + "px 'Space Grotesk', Inter, sans-serif";
  const words = txt.split(/\s+/);
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > W * 0.86 && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const lh = fs * 1.2, y0 = H / 2 - (lines.length - 1) * lh / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * lh));
}

// ── Asset browser: Shots · Transitions · Titles · Backgrounds ────────────────
// The middle column doubles as an iMovie-style browser. "Shots" is the
// storyboard; the other tabs are draggable-free click-to-add grids.
const SB_BROWSER_TABS = [
  { k: 'shots', label: 'Shots' },
  { k: 'transitions', label: 'Transitions' },
  { k: 'titles', label: 'Titles' },
  { k: 'backgrounds', label: 'Backgrounds' },
];
// Only transitions the exporter actually renders (applied film-wide).
const SB_TRANSITIONS = [
  { k: 'none', label: 'None', kind: 'cut' },
  { k: 'crossfade', label: 'Cross Dissolve', kind: 'xfade' },
  { k: 'dip', label: 'Dip to Black', kind: 'dip' },
];
const SB_TITLE_PRESETS = [
  { k: 'sunset', label: 'Sunset', g0: '#ff79c6', g1: '#ffb84d' },
  { k: 'grape', label: 'Grape', g0: '#a06cff', g1: '#ff79c6' },
  { k: 'ocean', label: 'Ocean', g0: '#3ec6ff', g1: '#8a7bff' },
  { k: 'mint', label: 'Mint', g0: '#34d399', g1: '#3ec6ff' },
  { k: 'ember', label: 'Ember', g0: '#ff7a5b', g1: '#ff2d78' },
  { k: 'mono', label: 'Mono', g0: '#20202a', g1: '#0b0b10' },
];
const SB_BG_PRESETS = [
  { k: 'black', label: 'Black', g0: '#0b0b10', g1: '#0b0b10' },
  { k: 'white', label: 'White', g0: '#f4f4f8', g1: '#e7e7ee' },
  { k: 'sunset', label: 'Sunset', g0: '#ff79c6', g1: '#ffb84d' },
  { k: 'ocean', label: 'Ocean', g0: '#3ec6ff', g1: '#8a7bff' },
  { k: 'grape', label: 'Grape', g0: '#a06cff', g1: '#ff79c6' },
  { k: 'forest', label: 'Forest', g0: '#34d399', g1: '#0e7d5a' },
  { k: 'slate', label: 'Slate', g0: '#3a3a46', g1: '#1a1a22' },
  { k: 'gold', label: 'Gold', g0: '#ffd76b', g1: '#f0932b' },
];

function sbSetTab(t) {
  sbTab = SB_BROWSER_TABS.some((x) => x.k === t) ? t : 'shots';
  sbRenderBrowser();
}
function sbRenderBrowser() {
  const tabsEl = document.getElementById('sbBrowserTabs');
  if (tabsEl) {
    tabsEl.innerHTML = '';
    SB_BROWSER_TABS.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mb-tab' + (t.k === sbTab ? ' active' : '');
      b.textContent = t.label;
      b.onclick = () => sbSetTab(t.k);
      tabsEl.appendChild(b);
    });
  }
  const onShots = sbTab === 'shots';
  const list = document.getElementById('sbList');
  const actions = document.getElementById('sbActions');
  const browser = document.getElementById('sbBrowser');
  if (list) list.hidden = !onShots;
  if (actions) actions.style.display = onShots ? '' : 'none';
  if (!browser) return;
  browser.hidden = onShots;
  if (onShots) return;
  const proj = sbProject();
  browser.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'mb-grid';
  if (sbTab === 'transitions') {
    const note = document.createElement('div');
    note.className = 'mb-note'; note.textContent = 'Applied between every clip in the film.';
    browser.appendChild(note);
    SB_TRANSITIONS.forEach((tr) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mb-item' + ((proj.transition || 'none') === tr.k ? ' active' : '');
      item.innerHTML = '<span class="mb-prev mb-tr mb-tr-' + tr.kind + '"></span><span class="mb-label">' + tr.label + '</span>';
      item.onclick = () => {
        sbSetTransition(tr.k); sbRenderBrowser();
        sbStudioNote(tr.k === 'none' ? 'Transitions off — hard cuts between clips.' : tr.label + ' between every clip.');
      };
      grid.appendChild(item);
    });
    // Whole-film fade in/out is an independent toggle, stackable on any transition.
    const fadeItem = document.createElement('button');
    fadeItem.type = 'button';
    fadeItem.className = 'mb-item' + (proj.fade ? ' active' : '');
    fadeItem.innerHTML = '<span class="mb-prev mb-tr mb-tr-fade"></span><span class="mb-label">Fade in / out</span>';
    fadeItem.onclick = () => {
      sbToggleFade(); sbRenderBrowser();
      sbStudioNote(sbProject().fade ? 'The film now fades in from black and out to black.' : 'Film-wide fade off.');
    };
    grid.appendChild(fadeItem);
  } else if (sbTab === 'titles' || sbTab === 'backgrounds') {
    const isTitles = sbTab === 'titles';
    const note = document.createElement('div');
    note.className = 'mb-note'; note.textContent = 'Click or drag onto the timeline.';
    browser.appendChild(note);
    (isTitles ? SB_TITLE_PRESETS : SB_BG_PRESETS).forEach((p) => {
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'mb-item'; item.draggable = true;
      item.innerHTML = '<span class="mb-prev" style="background:' + sbGrad(p.g0, p.g1) + '">'
        + (isTitles ? '<b style="color:' + sbTitleInk(p) + '">Title</b>' : '') + '</span>'
        + '<span class="mb-label">' + p.label + '</span>';
      item.onclick = () => isTitles ? sbAddTitlePreset(p) : sbAddBackground(p);
      item.ondragstart = (e) => {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/sb-asset', JSON.stringify({ kind: isTitles ? 'title' : 'bg', k: p.k, label: p.label, g0: p.g0, g1: p.g1 }));
      };
      item.ondragend = () => item.classList.remove('dragging');
      grid.appendChild(item);
    });
  }
  browser.appendChild(grid);
}
function sbAddTitlePreset(p) {
  const proj = sbProject();
  const t = {
    id: sbUid('s'), title: 'Title', text: 'Title', prompt: '', status: 'ready',
    src: 'title', onTimeline: true, dur: 3, in: 0, out: 3, srcDur: 3,
    g0: p.g0, g1: p.g1, bg: sbGrad(p.g0, p.g1),
  };
  proj.shots.push(t);
  sbSave(); sbRender(); sbSelect(t.id);
  sbStudioNote('Added the ' + p.label + ' title. Double-click it on the timeline to edit the text; drag its edges to change how long it holds.');
}
function sbAddBackground(p) {
  const proj = sbProject();
  const bgc = {
    id: sbUid('s'), title: 'Background', text: '', prompt: '', status: 'ready',
    src: 'title', onTimeline: true, dur: 3, in: 0, out: 3, srcDur: 3,
    g0: p.g0, g1: p.g1, bg: sbGrad(p.g0, p.g1),
  };
  proj.shots.push(bgc);
  sbSave(); sbRender(); sbSelect(bgc.id);
  sbStudioNote('Added the ' + p.label + ' background. Drag its edges to change its length.');
}
function sbStopTitle() {
  if (sbTitleRAF) { cancelAnimationFrame(sbTitleRAF); sbTitleRAF = 0; }
  sbTitleState = null;
}
function sbPlayTitle(s, next) {
  sbShowTitleCard(s);
  const dur = sbShotDur(s) || 3;
  sbStopTitle();
  sbTitleState = { id: s.id, elapsed: 0, playing: true };
  const t0 = performance.now();
  sbMusicSync(null, { hard: true });
  const step = () => {
    if (!sbTitleState || sbTitleState.id !== s.id) return;
    sbTitleState.elapsed = (performance.now() - t0) / 1000;
    sbUpdatePlayhead(null);
    sbMusicSync(null);
    if (sbTitleState.elapsed >= dur) { sbStopTitle(); if (next) next(); else sbMusicSync(null); return; }
    sbTitleRAF = requestAnimationFrame(step);
  };
  step();
}

// ── Voiceover: record a mic track straight into the timeline ─────────────────
let sbVoiceRec = null; // active MediaRecorder while recording
async function sbToggleVoiceRecord() {
  if (sbVoiceRec) { try { sbVoiceRec.stop(); } catch (e) {} return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    sbStudioNote('This browser can’t record audio.'); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { sbStudioNote('I need microphone permission to record a voiceover.'); return; }
  const rec = new MediaRecorder(stream);
  const parts = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    sbVoiceRec = null;
    const btn = document.getElementById('sbVoiceBtn');
    if (btn) { btn.textContent = '● Voiceover'; btn.classList.remove('recording'); }
    const blob = new Blob(parts, { type: rec.mimeType || 'audio/webm' });
    await sbSetVoice(blob);
  };
  sbVoiceRec = rec;
  rec.start();
  const btn = document.getElementById('sbVoiceBtn');
  if (btn) { btn.textContent = '■ Stop'; btn.classList.add('recording'); }
  sbStudioNote('Recording a voiceover — click ■ Stop when you’re done.');
}
async function sbSetVoice(blob) {
  const proj = sbProject();
  const url = URL.createObjectURL(blob);
  proj.voice = { name: 'Voiceover', mime: blob.type || 'audio/webm', url, stored: false, dur: 0, volume: 1 };
  sbSave(); sbRenderVoiceBar();
  try { await sbMediaPut('voice-' + proj.id, blob); proj.voice.stored = true; }
  catch (e) { console.warn('could not persist voiceover:', e); }
  try {
    const a = document.createElement('audio'); a.preload = 'metadata'; a.src = url;
    await new Promise((ok, err) => { a.onloadedmetadata = ok; a.onerror = err; });
    proj.voice.dur = a.duration || 0;
  } catch (e) {}
  sbSave(); sbRenderVoiceBar();
  sbStudioNote('Voiceover added — it plays from the start of your film and mixes into the export.');
}
function sbRemoveVoice() {
  const proj = sbProject();
  if (!proj.voice) return;
  const a = document.getElementById('sbVoiceAudio');
  if (a) { a.pause(); a.removeAttribute('src'); }
  if (proj.voice.stored) sbMediaDel('voice-' + proj.id);
  proj.voice = null;
  sbSave(); sbRenderVoiceBar();
}
function sbRenderVoiceBar() { sbVoiceLoad(); sbRender(); }

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
  if (i >= 0) {
    if (shots[i].src === 'import' && shots[i].stored) sbMediaDel(id); // free the stored file
    shots.splice(i, 1);
  }
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
      sbUpdatePlayhead(v);
      sbMusicSync(v);
    });
    // Keep the background music track locked to the film's play state.
    v.addEventListener('play', () => sbMusicSync(v, { hard: true }));
    v.addEventListener('pause', () => sbMusicSync(v));
    v.addEventListener('seeking', () => sbMusicSync(v, { hard: true }));
    v.addEventListener('ended', () => sbMusicSync(v));
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
// Once a clip's real video is loaded, record the true source length (the trim
// ceiling) and fill in default in/out so the trim handles have concrete bounds.
function sbNoteSrcDur(s, v) {
  if (!v || !isFinite(v.duration) || v.duration <= 0) return;
  let changed = false;
  if (!s.srcDur || Math.abs(s.srcDur - v.duration) > 0.05) { s.srcDur = v.duration; changed = true; }
  if (s.in == null) { s.in = 0; changed = true; }
  if (s.out == null) { s.out = v.duration; changed = true; }
  if (changed) sbSave();
}
function sbPlayShot(s, next) {
  if (s.src === 'title') return sbPlayTitle(s, next);
  sbStopTitle();
  const v = sbVideoEl();
  if (!v || !s.url) return;
  const start = s.in || 0;
  sbSegment = { out: s.out != null ? s.out : null, next: next || null };
  const go = () => { sbNoteSrcDur(s, v); v.volume = s.muted ? 0 : 1; v.currentTime = start; v.play().catch(() => {}); };
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
  if (s && s.src === 'title') { sbStopTitle(); sbShowTitleCard(s); sbUpdatePlayhead(null); return; }
  sbStopTitle();
  if (s && s.url) sbPlayShot(s);
  else if (s && s.status === 'restoring') sbStudioNote('Restoring your imported clip — one sec…');
  else if (s) sbStudioNote(s.status === 'draft'
    ? 'Shot ' + (sbProject().shots.indexOf(s) + 1) + ' isn’t generated yet — say "generate shot ' + (sbProject().shots.indexOf(s) + 1) + '" and I’ll run it.'
    : 'That shot’s clip is gone (imported clips don’t survive a reload) — re-import the video to bring it back.');
}

function sbPlayAll() {
  const shots = sbProject().shots.filter((s) => s.onTimeline && (s.src === 'title' || (s.url && s.status === 'ready')));
  if (!shots.length) { sbStudioNote('Nothing on the timeline yet — add clips to your film first (drag them onto the timeline or tap ＋).'); return; }
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
  // Just drop the clip in as one shot — no scene detection, no director, no
  // chat chatter. The user imported it because they want it sitting here.
  const url = URL.createObjectURL(f);
  const proj = sbProject();
  const shot = {
    id: sbUid('s'),
    title: '',            // no filename label on imported cards
    prompt: '',
    status: 'ready',
    src: 'import',
    onTimeline: false,    // lands in the clip list — drag onto the timeline to use it
    url, in: null, out: null, dur: 0,
    thumb: null,
    stored: false,        // flipped true once the blob lands in IndexedDB
  };
  proj.shots.push(shot);
  sbSave(); sbRender();
  // Persist the actual file so the clip survives a reload ("just leave it there").
  try { await sbMediaPut(shot.id, f); shot.stored = true; }
  catch (e) { console.warn('could not persist import (kept for this tab only):', e); }
  // Fill in the real duration + a crisp poster frame from the file itself.
  try { await sbThumb(shot); } catch (e) { console.error('poster grab failed:', e); }
  sbSave(); sbRender();
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

// Burn a caption onto a shot (bottom / top / center).
async function sbApplyText(s, content, position) {
  const text = String(content || '').slice(0, 200);
  if (!text.trim()) return;
  const pos = ['bottom', 'top', 'center'].indexOf(position) >= 0 ? position : 'bottom';
  const winDur = sbShotDur(s) || 0;
  await sbRenderEdit(s, 'add a caption to',
    (onProgress) => window.sbFFText(s.url, text, { url: s.url, position: pos, start: s.in || 0, dur: winDur, onProgress }),
    winDur || null,
    (idx) => 'Captioned shot ' + idx + ' — “' + text.slice(0, 40) + (text.length > 40 ? '…' : '') + '”. Fresh clip in this tab; Export or download to keep it.');
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
  s.srcDur = v.duration || s.dur || 0;
  if (s.in == null) s.in = 0;
  if (s.out == null) s.out = s.srcDur;
  await sbSeek(v, Math.min(0.1, v.duration / 2));
  s.thumb = sbGrabFrame(v, 480).toDataURL('image/jpeg', 0.72);
  // Filmstrip: sample frames at a fixed time density (≈one every 0.5s, like
  // iMovie) so a longer clip gets more frames and every frame is the same
  // on-screen width. Capped so a very long clip doesn't trigger a huge number
  // of seeks / bloat storage.
  try {
    const dur = s.dur || v.duration || 0;
    const SEC_PER_FRAME = 0.5, MAX_FRAMES = 30;
    const n = Math.max(2, Math.min(MAX_FRAMES, Math.ceil((dur || 2) / SEC_PER_FRAME)));
    const frames = [];
    for (let i = 0; i < n; i++) {
      await sbSeek(v, Math.min((dur * (i + 0.5)) / n, dur - 0.01));
      frames.push(sbGrabFrame(v, 160).toDataURL('image/jpeg', 0.5));
    }
    s.strip = frames;
  } catch (e) { /* keep the single poster fallback */ }
}

// Trigger a browser download for a produced Blob, named after the project.
function sbDownloadBlob(blob, ext) {
  const a = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = (sbProject().title.replace(/[^\w\- ]+/g, '') || 'film') + '.' + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objUrl), 15000);
}

// ── Export: stitch ready shots into one film ──────────────────────────────
// Prefer the on-device ffmpeg stitch (fast, higher quality, orientation-aware);
// fall back to the realtime canvas + MediaRecorder path if the editor can't run
// or the stitch fails.
// A clip is exportable if it's a title card (no source needed) or a ready video.
function sbExportable(s) {
  return s.onTimeline && (s.src === 'title' || (s.url && s.status === 'ready'));
}
async function sbExport(deliver) {
  if (sbBusy) return;
  const shots = sbProject().shots.filter(sbExportable);
  if (!shots.length) { sbStudioNote('Nothing on the timeline to export — add clips to your film first.'); return; }
  sbBusy = true;
  // deliver(blob, ext) decides what happens with the finished film — download by
  // default, or upload when saving to the gallery.
  const send = deliver || ((blob, ext) => sbDownloadBlob(blob, ext));
  const btn = document.getElementById('sbExportBtn');
  if (btn && !deliver) btn.textContent = 'Exporting…';
  // Title cards (synthesized frame-by-frame) and a voiceover track (a second
  // mixed source) can't go through the ffmpeg stitch — route those films through
  // the realtime canvas exporter, which handles both. Music-only stays on ffmpeg.
  const proj0 = sbProject();
  const hasTitle = shots.some((s) => s.src === 'title');
  const hasVoice = !!(proj0.voice && proj0.voice.url);
  try {
    if (!hasTitle && !hasVoice && window.sbFFExport && window.sbFFSupported && window.sbFFSupported()) {
      try {
        const proj = sbProject();
        const descriptors = shots.map((s) => ({ src: s.url, url: s.url, start: s.in || 0, dur: sbShotDur(s) || 0, muted: !!s.muted }));
        const music = (proj.music && proj.music.url)
          ? { src: proj.music.url, mime: proj.music.mime || '', volume: (proj.music.volume != null ? proj.music.volume : 0.6) * (proj.music.duck ? 0.4 : 1), fade: !!proj.music.fade }
          : null;
        const r = await window.sbFFExport(descriptors, {
          transition: proj.transition || 'none',
          fade: !!proj.fade,
          music,
          onProgress: (p) => sbStudioProgress('Stitching your film… ' + Math.round(p * 100) + '%'),
        });
        await send(r.blob, 'mp4');
        if (!deliver) {
          const styleNote = (proj.transition && proj.transition !== 'none')
            ? ', ' + (proj.transition === 'dip' ? 'dip-to-black' : 'crossfade') + ' transitions' : '';
          sbStudioNote('Exported “' + sbProject().title + '” (' + r.used + ' shot' + (r.used === 1 ? '' : 's') +
            (r.used < r.total ? ', ' + (r.total - r.used) + ' skipped' : '') + ', ' + r.w + '×' + r.h + styleNote +
            (proj.fade ? ', fades' : '') + ') — check your downloads ✦');
        }
        return;
      } catch (e) {
        console.warn('on-device stitch failed, using the realtime exporter:', e);
      }
    }
    await sbExportCanvas(shots, send, !!deliver);
  } catch (e) {
    console.error('export failed:', e);
    sbStudioNote('Export hit a snag — ' + String(e.message || e).slice(0, 120));
  } finally {
    sbBusy = false;
    if (btn) btn.textContent = 'Export';
  }
}

// ── Save to gallery ─────────────────────────────────────────────────────────
// Stitch the film, then upload it (base64 → /api/save, behind the paid storage
// gate) and add it to the cloud gallery. Falls back to a download if the account
// can't save or the film is too big.
function sbBlobToB64(blob) {
  return new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); ok(s.slice(s.indexOf(',') + 1)); };
    r.onerror = () => err(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}
// The current preview frame → a poster data URI for the saved film.
function sbCaptureFrame() {
  try {
    const v = document.querySelector('#previewStage video');
    if (v && v.videoWidth) {
      const c = document.createElement('canvas');
      c.width = Math.min(640, v.videoWidth); c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    }
  } catch (e) {}
  // Fall back to the first timeline clip's poster frame.
  const first = sbProject().shots.find((s) => s.onTimeline && s.thumb);
  return first ? first.thumb : null;
}
function sbAddFilmToGallery(url, poster) {
  if (typeof chatStore === 'undefined' || !chatStore) return;
  let chat = chatStore.chats.find((c) => c.studioFilms);
  if (!chat) {
    chat = (typeof newChatEntry === 'function') ? newChatEntry() : { id: 'films', title: '🎬 Films', msgs: [], updatedAt: Date.now() };
    chat.title = '🎬 Films'; chat.studioFilms = true;
    chatStore.chats.unshift(chat);
  }
  chat.msgs.push({ t: 'media', kind: 'video', url, prompt: sbProject().title || 'Film', poster: poster || undefined, at: Date.now() });
  chat.updatedAt = Date.now();
  if (typeof persistStore === 'function') persistStore();
  if (typeof touchSync === 'function') touchSync(chat.id);
  if (typeof pushChats === 'function') { try { pushChats(); } catch (e) {} }
  if (typeof renderGallery === 'function') renderGallery();
}
async function sbSaveToGallery() {
  if (sbBusy) return;
  const shots = sbProject().shots.filter(sbExportable);
  if (!shots.length) { sbStudioNote('Nothing to save yet — add clips to your film first.'); return; }
  const btn = document.getElementById('sbSaveBtn');
  if (btn) btn.textContent = 'Saving…';
  const poster = sbCaptureFrame();
  try {
    await sbExport(async (blob, ext) => {
      // WebM films (Chrome canvas fallback) aren't accepted by every gallery
      // surface as reliably as MP4, but the worker takes both.
      if (blob.size > 38_000_000) { sbStudioNote('This film is a bit large to save to the gallery — downloading it instead.'); sbDownloadBlob(blob, ext); return; }
      let b64;
      try { b64 = await sbBlobToB64(blob); } catch (e) { sbDownloadBlob(blob, ext); return; }
      if (typeof trySave !== 'function') { sbDownloadBlob(blob, ext); return; }
      sbStudioProgress('Saving your film to the gallery…');
      const res = await trySave(null, 'video', 3, { kind: 'video', data: b64 });
      if (res && res.url) {
        sbAddFilmToGallery(res.url, poster);
        sbStudioNote('Saved “' + (sbProject().title || 'your film') + '” to your gallery ✦ — find it under Gallery.');
      } else if (res && res.block === 'free') {
        sbStudioNote('Saving to the gallery is a paid feature. Downloading your film instead.'); sbDownloadBlob(blob, ext);
      } else if (res && res.block === 'full') {
        sbStudioNote('Your gallery storage is full. Downloading your film instead.'); sbDownloadBlob(blob, ext);
      } else {
        sbStudioNote('Couldn’t save to the gallery just now — downloading your film instead.'); sbDownloadBlob(blob, ext);
      }
    });
  } finally {
    if (btn) btn.textContent = '⬆ Save to gallery';
  }
}

// Realtime fallback: canvas + MediaRecorder, universally supported. Audio comes
// along via an AudioContext tap. Letterboxes every shot into a 1280x720 frame.
async function sbExportCanvas(shots, deliver, quiet) {
  {
    const send = deliver || ((blob, ext) => sbDownloadBlob(blob, ext));
    const W = 1280, H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const dest = ac.createMediaStreamDestination();
    const stream = canvas.captureStream(30);
    if (dest.stream.getAudioTracks().length) stream.addTrack(dest.stream.getAudioTracks()[0]);
    // Feed the background music into the recorded audio (only to dest, so it's
    // captured but not audible during export). Loops to cover the whole film.
    const filmDur = shots.reduce((a, s) => a + (sbShotDur(s) || 0), 0);
    let musicAudio = null;
    const mus = sbProject().music;
    if (mus && mus.url) {
      try {
        musicAudio = new Audio(); musicAudio.src = mus.url; musicAudio.loop = true; musicAudio.crossOrigin = 'anonymous';
        const mnode = ac.createMediaElementSource(musicAudio);
        const g = ac.createGain();
        const base = (mus.volume != null ? mus.volume : 0.6) * (mus.duck ? 0.4 : 1);
        g.gain.value = base;
        if (mus.fade && filmDur > 1) {
          const fd = Math.max(0.3, Math.min(2, filmDur * 0.12));
          const now = ac.currentTime;
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(base, now + fd);
          g.gain.setValueAtTime(base, now + Math.max(fd, filmDur - fd));
          g.gain.linearRampToValueAtTime(0.0001, now + filmDur);
        }
        mnode.connect(g).connect(dest);
        await musicAudio.play().catch(() => {});
      } catch (e) { console.warn('music tap failed (exporting without it):', e); musicAudio = null; }
    }
    // Voiceover tap — plays once from the film's start (no loop).
    let voiceAudio = null;
    const vo = sbProject().voice;
    if (vo && vo.url) {
      try {
        voiceAudio = new Audio(); voiceAudio.src = vo.url; voiceAudio.crossOrigin = 'anonymous';
        const vnode = ac.createMediaElementSource(voiceAudio);
        const vg = ac.createGain(); vg.gain.value = vo.volume != null ? vo.volume : 1;
        vnode.connect(vg).connect(dest);
        await voiceAudio.play().catch(() => {});
      } catch (e) { console.warn('voice tap failed (exporting without it):', e); voiceAudio = null; }
    }
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

    // Transitions + film-wide fade are painted as overlays here (the ffmpeg path
    // does them natively; this realtime path must draw them itself).
    const proj0c = sbProject();
    const transition = proj0c.transition || 'none';
    const fade = !!proj0c.fade;
    let ok = 0, skipped = 0, filmStart = 0, prevFrame = null;
    for (let i = 0; i < shots.length; i++) {
      const sdur = sbShotDur(shots[i]) || 0;
      sbStudioProgress('Exporting shot ' + (i + 1) + '/' + shots.length + '…');
      // One unreadable/stalled shot must not abort the whole export — skip it
      // and keep the shots that worked.
      try {
        prevFrame = await sbExportShot(shots[i], {
          ctx, W, H, ac, dest, filmStart, filmTotal: filmDur, transition, fade,
          isFirst: i === 0, isLast: i === shots.length - 1, prevFrame,
        });
        ok++;
      } catch (e) { console.warn('shot ' + (i + 1) + ' skipped:', e); skipped++; prevFrame = null; }
      filmStart += sdur;
    }
    rec.stop();
    await done;
    if (musicAudio) { try { musicAudio.pause(); } catch (e) {} }
    if (voiceAudio) { try { voiceAudio.pause(); } catch (e) {} }
    ac.close().catch(() => {});
    if (!ok) { sbStudioNote('Export failed — none of the shots could be read (they may still be uploading, or blocked by the browser).'); return; }
    // Match the file to what the recorder actually produced (webm on Chrome,
    // mp4 on Safari) so the download opens cleanly.
    const outType = ((rec.mimeType || mime || 'video/webm').split(';')[0]) || 'video/webm';
    const ext = outType.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    await send(new Blob(parts, { type: outType }), ext);
    if (!quiet) sbStudioNote('Exported “' + sbProject().title + '” (' + ok + ' shot' + (ok === 1 ? '' : 's') +
      (skipped ? ', ' + skipped + ' skipped' : '') + ') — check your downloads ✦');
  }
}

// Snapshot the current export canvas into a detached canvas — the outgoing
// clip's last frame, dissolved out over the next clip for a cross dissolve.
function sbSnapshot(ctx, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  try { c.getContext('2d').drawImage(ctx.canvas, 0, 0); } catch (e) {}
  return c;
}
// Paint transition / film-wide-fade overlays over the just-drawn base frame.
// st = seconds into this clip, dur = clip length. Cosmetic; callers wrap it.
function sbFrameOverlays(ctx, W, H, o, st, dur) {
  const T = Math.min(0.6, (dur || 4) * 0.4);          // per-seam transition length
  const FF = Math.min(0.5, (o.filmTotal || 1) * 0.1); // film fade length
  const ft = o.filmStart + Math.max(0, st);
  // Cross dissolve: fade the previous clip's frozen last frame out over our first T.
  if (o.transition === 'crossfade' && !o.isFirst && o.prevFrame && st < T) {
    ctx.globalAlpha = Math.max(0, 1 - st / T);
    ctx.drawImage(o.prevFrame, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  let black = 0;
  if (o.fade && o.filmTotal) {
    if (ft < FF) black = Math.max(black, 1 - ft / FF);
    if (ft > o.filmTotal - FF) black = Math.max(black, (ft - (o.filmTotal - FF)) / FF);
  }
  if (o.transition === 'dip') {
    const t2 = T / 2;
    if (!o.isFirst && st < t2) black = Math.max(black, 1 - st / t2);
    if (!o.isLast && st > dur - t2) black = Math.max(black, (st - (dur - t2)) / t2);
  }
  black = Math.max(0, Math.min(1, black));
  if (black > 0) { ctx.globalAlpha = black; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// Play one clip onto the shared export canvas; resolves with its last frame.
function sbExportShot(s, o) {
  const { ctx, W, H, ac, dest } = o;
  const shotDur = sbShotDur(s) || (s.src === 'title' ? 3 : 4);
  // Title / background cards have no video — paint the card for the clip length.
  if (s.src === 'title') {
    return new Promise((resolve) => {
      const durMs = shotDur * 1000;
      const t0 = performance.now();
      const draw = () => {
        sbPaintTitle(ctx, W, H, s);
        try { sbFrameOverlays(ctx, W, H, o, (performance.now() - t0) / 1000, shotDur); } catch (e) {}
        if (performance.now() - t0 >= durMs) { resolve(sbSnapshot(ctx, W, H)); return; }
        requestAnimationFrame(draw);
      };
      draw();
    });
  }
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
    const budget = (shotDur + 20) * 1000;
    const guard = setTimeout(() => finish(reject, new Error('shot timed out')), Math.min(budget, 180000));
    v.onerror = () => finish(reject, new Error('could not read a shot (CORS or codec)'));
    v.onloadedmetadata = () => {
      // A muted clip is drawn but not routed to the recorded audio.
      try { node = ac.createMediaElementSource(v); if (!s.muted) node.connect(dest); } catch {}
      v.currentTime = start;
      v.play().then(() => {
        const draw = () => {
          // letterbox into the export frame
          const vr = v.videoWidth / v.videoHeight, fr = W / H;
          let dw = W, dh = H, dx = 0, dy = 0;
          if (vr > fr) { dh = W / vr; dy = (H - dh) / 2; } else { dw = H * vr; dx = (W - dw) / 2; }
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(v, dx, dy, dw, dh);
          try { sbFrameOverlays(ctx, W, H, o, v.currentTime - start, shotDur); } catch (e) {}
          if (v.currentTime >= stopAt - 0.03 || v.ended) { finish(resolve, sbSnapshot(ctx, W, H)); return; }
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
  // Don't stack the same message over and over (e.g. clicking a missing shot).
  const last = box.lastElementChild;
  if (last && last.classList.contains('agent') && last.textContent === text) {
    box.scrollTop = box.scrollHeight;
    return;
  }
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
    // The Studio chat editor is the Video Editor add-on ($19.99/mo). No sub →
    // 402: surface the upsell instead of a generic error.
    if (res.status === 402) {
      if (sbProgressEl) { sbProgressEl.remove(); sbProgressEl = null; }
      sbStudioNote('The Video Editor add-on ($19.99/mo) powers this chat editor. Add it to direct your edits by chat — the editing tools themselves stay free.');
      if (typeof window.openVideoEditorUpsell === 'function') window.openVideoEditorUpsell();
      return;
    }
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
            status: 'draft', src: 'gen', onTimeline: true, url: null, thumb: null, in: null, out: null,
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
          if (a.text && s.url) {
            const tx = typeof a.text === 'string' ? { content: a.text } : a.text;
            if (tx && tx.content) edits.push({ op: 'text', s, content: String(tx.content), position: tx.position });
          }
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
      } else if (a.type === 'export_style') {
        // How the film is stitched at Export time (applies to all shots).
        if (a.transition != null) {
          const t = String(a.transition);
          proj.transition = ['crossfade', 'dip', 'none'].indexOf(t) >= 0 ? t : 'none';
        }
        if (a.fade != null) proj.fade = !!a.fade;
      }
    }
    sbSave(); sbRender();
    // Real on-device edits first (ffmpeg loads once, ops are serialized).
    for (const e of edits) {
      if (e.op === 'trim') await sbApplyTrim(e.s, e.start, e.end);
      else if (e.op === 'speed') await sbApplySpeed(e.s, e.speed);
      else if (e.op === 'reframe') await sbApplyReframe(e.s, e.aspect);
      else if (e.op === 'text') await sbApplyText(e.s, e.content, e.position);
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
  const music = document.getElementById('studioMusic');
  if (music) {
    music.addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) sbSetMusic(f);
    });
  }
  // Editor keyboard shortcuts — only when Studio is the visible view and the
  // user isn't typing into a field.
  document.addEventListener('keydown', (e) => {
    const view = document.getElementById('viewStudio');
    if (!view || !view.classList.contains('active')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const v = document.querySelector('#previewStage video');
    if (e.code === 'Space') { e.preventDefault(); sbTogglePlay(); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); sbSplitAtPlayhead(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (v) { v.currentTime = Math.min(v.duration || 1e9, v.currentTime + (e.shiftKey ? 1 : 0.1)); } }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (v) { v.currentTime = Math.max(0, v.currentTime - (e.shiftKey ? 1 : 0.1)); } }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (sbSelected) { e.preventDefault(); sbRemoveShot(sbSelected); } }
  });
  sbLoad();
  sbRender();
  sbMusicLoad();          // point the audio element at this project's track
  sbVoiceLoad();
  sbRehydrateImports();   // bring persisted imported clips (and music/voice) back after a reload
}
initStudio();
