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
let sbTitleState = null;    // {id, elapsed} while a static card (title OR photo) is "playing"
let sbTitleRAF = 0;
let sbAudioOnly = null;     // {playing, t0, raf} while previewing music/voice with no video on the timeline
let sbPip = null;           // {oid, kind, wrap, media} — the live picture-in-picture overlay element

// A "static" clip has no moving source — a title card or an imported still photo.
// Both are painted frame-by-frame off a RAF clock (sbTitleState) rather than a
// <video> element, in the preview and the export alike.
function sbIsImage(s) { return !!(s && s.kind === 'image'); }
function sbIsStatic(s) { return !!(s && (s.src === 'title' || s.kind === 'image')); }
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
    // Audio clips gained offset/trim/fade fields — backfill them.
    if (p.music) sbAudioInit(p.music);
    if (p.voice) sbAudioInit(p.voice);
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
// Friendly clip length that never collapses a real short clip to "00:00":
// sub-minute clips read in seconds ("0.6s", "12.4s"), longer ones as mm:ss.
function sbFmtDur(s) {
  if (!isFinite(s) || s <= 0) return '0s';
  if (s < 60) return (Math.round(s * 10) / 10) + 's';
  return sbFmt(s);
}
// mm:ss:ff at 30fps — the frame field gives iMovie-style frame-exact readout.
function sbFmtFrames(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const ff = Math.floor((s - Math.floor(s)) * 30);
  return sbFmt(s) + ':' + String(ff).padStart(2, '0');
}
// ── Skim magnifier (iMovie-style) ─────────────────────────────────────────────
// Hovering the timeline shows the EXACT frame under the cursor in a floating
// loupe (frame-accurate), plus a mm:ss:ff readout — without moving the real
// playhead. A hidden <video> is seeked to the hovered source time; seeks are
// throttled to one at a time so the loupe chases the cursor smoothly.
let sbSkimVideo = null, sbSkimBusy = false, sbSkimNext = null, sbSkimSrcId = null;
function sbSkimBox() {
  let box = document.getElementById('sbSkim');
  if (!box) {
    box = document.createElement('div');
    box.id = 'sbSkim'; box.className = 'sb-skim'; box.style.display = 'none';
    box.innerHTML = '<canvas width="240" height="135"></canvas><span class="sb-skim-tc"></span>';
    document.body.appendChild(box);
  }
  if (!sbSkimVideo) {
    sbSkimVideo = document.createElement('video');
    sbSkimVideo.muted = true; sbSkimVideo.crossOrigin = 'anonymous'; sbSkimVideo.preload = 'auto';
  }
  return box;
}
function sbSkimGrab(clip, srcT, ctx) {
  sbSkimNext = { clip, srcT, ctx };
  if (sbSkimBusy) return;
  sbSkimBusy = true;
  const step = () => {
    const job = sbSkimNext; sbSkimNext = null;
    if (!job) { sbSkimBusy = false; return; }
    const v = sbSkimVideo;
    const drawAndLoop = () => {
      try { job.ctx.drawImage(v, 0, 0, 240, 135); } catch (e) {}
      if (sbSkimNext) step(); else sbSkimBusy = false;
    };
    if (sbSkimSrcId !== job.clip.id) {
      sbSkimSrcId = job.clip.id;
      v.onloadedmetadata = () => { v.onseeked = drawAndLoop; try { v.currentTime = Math.min(job.srcT, v.duration || job.srcT); } catch (e) { sbSkimBusy = false; } };
      v.onerror = () => { sbSkimBusy = false; sbSkimSrcId = null; };
      v.src = job.clip.url;
    } else {
      v.onseeked = drawAndLoop;
      try { v.currentTime = job.srcT; } catch (e) { sbSkimBusy = false; }
    }
  };
  step();
}
function sbAttachSkim(track, skimLine, total) {
  const box = sbSkimBox();
  const sctx = box.querySelector('canvas').getContext('2d');
  const label = box.querySelector('.sb-skim-tc');
  const hide = () => { box.style.display = 'none'; skimLine.style.display = 'none'; };
  track.addEventListener('pointerleave', hide);
  track.addEventListener('pointermove', (e) => {
    if (sbScrubbing) { hide(); return; } // dragging the real playhead → no skim
    if (e.target.closest('.tl-actrl') || e.target.closest('.tl-atrim') || e.target.closest('.tl-fadedot') || e.target.closest('.sb-trim')) { hide(); return; }
    const inner = track.querySelector('.tl-inner'); if (!inner) { hide(); return; }
    const irect = inner.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - irect.left) / (irect.width || 1)));
    const ft = frac * total;
    const tl = sbProject().shots.filter(sbOnMain);
    if (!tl.length) { hide(); return; }
    let acc = 0, clip = tl[tl.length - 1], srcT = clip.in || 0;
    for (const s of tl) { const d = sbShotDur(s) || 0; if (ft < acc + d) { clip = s; srcT = (s.in || 0) + Math.max(0, ft - acc); break; } acc += d; }
    skimLine.style.left = (frac * 100) + '%'; skimLine.style.display = 'block';
    box.style.display = 'block';
    box.style.left = Math.round(e.clientX) + 'px';
    box.style.top = Math.round(irect.top - 10) + 'px';
    label.textContent = sbFmtFrames(ft);
    if (clip && clip.src === 'title') {
      sctx.fillStyle = clip.g0 || '#20202a'; sctx.fillRect(0, 0, 240, 135);
      sctx.fillStyle = sbTitleInk(clip); sctx.font = "700 20px 'Space Grotesk', sans-serif";
      sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
      sctx.fillText((clip.text || 'Title').slice(0, 24), 120, 67);
    } else if (clip && clip.url) {
      sbSkimGrab(clip, srcT, sctx);
    } else {
      sctx.fillStyle = '#000'; sctx.fillRect(0, 0, 240, 135);
    }
  });
}
// Effective (timeline) length. A per-clip speed change scales it so the clip's
// width, the film total, the playhead and the export duration all agree.
function sbShotDur(s) {
  const raw = (s.out != null && s.in != null) ? Math.max(0, s.out - s.in) : (s.dur || 0);
  const sp = s.speed && s.speed > 0 ? s.speed : 1;
  const d = raw / sp;
  return Number.isFinite(d) && d >= 0 ? d : 0; // never leak NaN/negative into widths & totals
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
        if (blob) {
          s.url = URL.createObjectURL(blob); s.status = 'ready';
          // A photo's poster + filmstrip ARE its (now-fresh) object URL.
          if (s.kind === 'image') { s.thumb = s.url; s.strip = [s.url]; }
        }
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
        ? '<img class="sb-thumb' + (sbIsImage(s) ? ' sb-thumb-photo' : '') + '" src="' + (typeof esc === 'function' ? esc(s.thumb) : s.thumb) + '" alt="" />'
        : '<span class="sb-thumb sb-thumb-empty">' + (s.status === 'generating' ? '⏳' : '🎬') + '</span>';
      // Just the thumbnail. The add-to-timeline (＋/🎞) and remove (×) buttons
      // sit over it and appear on hover — no clutter text, duration, or status dot.
      card.innerHTML = thumb +
        '<button class="sb-tl' + (s.onTimeline ? ' on' : '') + '" title="' +
          (s.onTimeline ? 'On the timeline — click to remove from your film' : 'Add this clip to the timeline') +
          '">' + (s.onTimeline ? '🎞' : '＋') + '</button>' +
        '<button class="sb-x" title="Remove clip">×</button>';
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
    const tl = proj.shots.filter(sbOnMain);
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
      if (id) sbDropOnTimeline(id, e.clientX);
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

    // Time ruler: mm:ss ticks across the top, shared with every lane below.
    const ruler = document.createElement('div');
    ruler.className = 'tl-ruler';
    const step = total <= 12 ? 1 : total <= 45 ? 5 : total <= 120 ? 10 : 30;
    for (let t = 0; t <= total + 0.001; t += step) {
      if (t > 0 && t / total > 0.965) break; // don't jam a label against the right edge
      const tick = document.createElement('span');
      tick.className = 'tl-tick';
      tick.style.left = (t / total * 100) + '%';
      tick.textContent = sbFmt(t);
      ruler.appendChild(tick);
    }
    inner.appendChild(ruler);

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
      } else if (sbIsImage(s)) {
        // A photo isn't a strip of different frames — it's one image. Tile the
        // WHOLE image across the clip at its real aspect ratio (repeat-x, fit to
        // lane height) so you see the actual picture, not a zoomed-in crop.
        body = '<div class="sb-strip sb-photostrip" style="background-image:url(\'' + (s.url || s.thumb || '') + '\')"></div>';
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
      // iMovie-style audio band along the clip's bottom (real waveform, in memory).
      if (!isTitle && !sbIsImage(s) && s.url) {
        const wv = sbClipWave[s.id];
        if (wv === undefined) sbBuildClipWave(s);
        if (typeof wv === 'string') body += '<span class="sb-clipwave" style="background-image:url(' + wv + ')"></span>';
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
      // Keyboard access: focusable, labeled, operable without a mouse.
      // Enter/Space selects & previews · Delete removes from the timeline ·
      // Alt+←/→ reorders. (Trim stays pointer-only for now.)
      block.tabIndex = 0;
      block.setAttribute('role', 'button');
      block.dataset.sid = s.id;
      block.setAttribute('aria-label',
        (isTitle ? 'Title card' + (s.text ? ': ' + s.text : '') : (s.src === 'import' ? 'Clip ' + n : (s.title || 'Shot ' + n)))
        + ', ' + (Math.round(sbShotDur(s) * 10) / 10) + ' seconds' + (s.id === sbSelected ? ', selected' : ''));
      block.addEventListener('keydown', (e) => {
        const isArrow = e.key === 'ArrowRight' || e.key === 'ArrowLeft';
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sbSelect(s.id); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); sbToggleTimeline(s.id); }
        else if (e.shiftKey && e.altKey && isArrow) { e.preventDefault(); sbKbdTrim(s, 'l', dir * 0.1); } // trim START
        else if (e.shiftKey && isArrow) { e.preventDefault(); sbKbdTrim(s, 'r', dir * 0.1); }             // trim END
        else if (e.altKey && isArrow) {                                                                   // reorder
          e.preventDefault();
          const idx = tl.indexOf(s), nb = tl[idx + dir];
          if (nb) { sbMoveShot(s.id, nb.id); const el = document.querySelector('.sb-block[data-sid="' + s.id + '"]'); if (el) el.focus(); }
        }
      });
      block.addEventListener('pointerdown', (e) => sbClipDragStart(e, s)); // drag to reorder / click to seek
      vlane.appendChild(block);
    });

    // Overlay lane (picture-in-picture) — only once there's a base clip to sit
    // on top of (an overlay with nothing under it makes no sense), or if one
    // already exists.
    if (tl.length || proj.shots.some(sbIsOverlay)) sbOverlayLane(inner, total);

    // Audio lanes (music, then voice) as waveform clips from the film's start.
    if (proj.music && proj.music.url) sbAudioLane(inner, proj.music, 'music', total);
    if (proj.voice && proj.voice.url) sbAudioLane(inner, proj.voice, 'voice', total);

    // One playhead spanning every lane.
    const ph = document.createElement('div');
    ph.className = 'playhead';
    ph.style.display = 'none';
    inner.appendChild(ph);
    // Skim magnifier: hover the lanes to preview the exact frame under the cursor.
    const skimLine = document.createElement('div');
    skimLine.className = 'skimline'; skimLine.style.display = 'none';
    inner.appendChild(skimLine);
    sbAttachSkim(track, skimLine, total);
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
    const tl = proj.shots.filter(sbOnMain);
    const ready = tl.filter((s) => s.status === 'ready').length;
    totalEl.textContent = tl.length
      ? sbFmt(tl.reduce((a, s) => a + sbShotDur(s), 0)) + ' · ' + ready + '/' + tl.length + ' shots ready'
      : '';
  }
  sbMusicLoad();
  sbVoiceLoad();
  sbRenderStyleControls();
  sbRenderBrowser();
  sbRenderAdjust();
  sbUpdateTimecode();
}

// Fill in audio-clip defaults (offset in the film + trim in/out + fades).
// Also sanitize non-finite fields (corrupt/legacy data) so they can't leak
// NaN into lane widths, the film clock, or the exporter.
function sbAudioInit(tr) {
  if (!tr) return;
  const num = (x, d) => (Number.isFinite(x) ? x : d);
  tr.dur = Math.max(0, num(tr.dur, 0));
  tr.offset = Math.max(0, num(tr.offset, 0));
  tr.in = Math.max(0, num(tr.in, 0));
  tr.out = num(tr.out, tr.dur);
  if (!Number.isFinite(tr.out) || tr.out < tr.in) tr.out = tr.dur;
  tr.fadeIn = Math.max(0, num(tr.fadeIn, 0));
  tr.fadeOut = Math.max(0, num(tr.fadeOut, 0));
  if (tr.volume != null) tr.volume = Math.max(0, Math.min(1, num(tr.volume, 1)));
}
function sbAClipDur(tr) { return Math.max(0.1, (tr.out != null && tr.in != null) ? (tr.out - tr.in) : (tr.dur || 0)); }

// One audio lane (music or voice): an iMovie clip you can drag along the lane,
// trim at either edge, and fade in/out via the corner dots.
function sbAudioLane(inner, tr, kind, total) {
  sbAudioInit(tr);
  const clipDur = sbAClipDur(tr);
  const leftPct = Math.max(0, Math.min(99, (tr.offset / total) * 100));
  const wPct = Math.max(2, Math.min(100 - leftPct, (clipDur / total) * 100));
  const lane = document.createElement('div');
  lane.className = 'tl-lane tl-audio tl-' + kind;
  const clip = document.createElement('div');
  clip.className = 'tl-aclip';
  clip.style.left = leftPct + '%';
  clip.style.width = wPct + '%';
  const esc2 = (typeof esc === 'function') ? esc : (x) => x;
  const nm = (kind === 'music' ? '♪ ' : '🎙 ') + (tr.name || kind);
  const vol = tr.volume != null ? tr.volume : (kind === 'music' ? 0.6 : 1);
  const fiPct = Math.min(50, (tr.fadeIn / clipDur) * 100);
  const foPct = Math.min(50, (tr.fadeOut / clipDur) * 100);
  clip.innerHTML =
    '<span class="tl-wave"' + (tr.wave ? ' style="background-image:url(' + tr.wave + ')"' : '') + '></span>' +
    '<span class="tl-fadefill l" style="width:' + fiPct + '%"></span>' +
    '<span class="tl-fadefill r" style="width:' + foPct + '%"></span>' +
    '<span class="tl-alabel">' + esc2(nm) + '</span>' +
    '<span class="tl-atrim l" title="Trim the start"></span>' +
    '<span class="tl-atrim r" title="Trim the end"></span>' +
    '<span class="tl-fadedot l" title="Fade in" style="left:' + fiPct + '%"></span>' +
    '<span class="tl-fadedot r" title="Fade out" style="right:' + foPct + '%"></span>' +
    '<span class="tl-actrl">' +
      '<input class="tl-avol" type="range" min="0" max="1" step="0.05" value="' + vol + '" title="Volume" />' +
      (kind === 'music' ? '<button class="tl-achip tl-duck' + (tr.duck ? ' on' : '') + '" title="Duck under clips with sound">Duck</button>' : '') +
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
    const dk = clip.querySelector('.tl-duck');
    dk.addEventListener('pointerdown', (e) => e.stopPropagation());
    dk.addEventListener('click', (e) => { e.stopPropagation(); tr.duck = !tr.duck; sbSave(); sbRender(); });
  }
  clip.querySelector('.tl-atrim.l').addEventListener('pointerdown', (e) => sbAudioTrim(e, tr, 'l', total));
  clip.querySelector('.tl-atrim.r').addEventListener('pointerdown', (e) => sbAudioTrim(e, tr, 'r', total));
  clip.querySelector('.tl-fadedot.l').addEventListener('pointerdown', (e) => sbAudioFade(e, tr, 'l', total));
  clip.querySelector('.tl-fadedot.r').addEventListener('pointerdown', (e) => sbAudioFade(e, tr, 'r', total));
  clip.addEventListener('pointerdown', (e) => sbAudioDrag(e, tr, kind, total));
  // Keyboard access: focusable, labeled. Delete removes · Alt+←/→ nudges start.
  clip.tabIndex = 0;
  clip.setAttribute('role', 'group');
  clip.setAttribute('aria-label',
    (kind === 'music' ? 'Music' : 'Voiceover') + ' “' + (tr.name || kind) +
    '”, starts at ' + sbFmt(tr.offset || 0) + ', ' + sbFmt(clipDur) + ' long');
  clip.addEventListener('keydown', (e) => {
    if (e.target.closest('.tl-actrl')) return; // the volume slider owns its own keys
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (kind === 'music') sbRemoveMusic(); else sbRemoveVoice(); }
    else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      tr.offset = Math.max(0, (tr.offset || 0) + (e.key === 'ArrowRight' ? 0.5 : -0.5));
      sbSave(); sbRender();
      const el = document.querySelector('#timelineTrack .tl-' + kind + ' .tl-aclip'); if (el) el.focus();
    }
  });
  lane.appendChild(clip);
  inner.appendChild(lane);
  if (!tr.wave && !tr._waving && !tr._waveFailed) sbBuildWave(tr, kind);
}
// Drag the audio clip body → move its offset (start time) along the film.
function sbAudioDrag(e, tr, kind, total) {
  if (e.target.closest('.tl-atrim') || e.target.closest('.tl-fadedot') || e.target.closest('.tl-actrl')) return;
  e.stopPropagation();
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (!inner) return;
  const rect = inner.getBoundingClientRect();
  const startX = e.clientX, off0 = tr.offset || 0;
  const el = e.currentTarget;
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
  el.classList.add('dragging');
  const move = (ev) => {
    const dSec = ((ev.clientX - startX) / (rect.width || 1)) * total;
    tr.offset = Math.max(0, off0 + dSec);
    el.style.left = Math.max(0, Math.min(99, (tr.offset / total) * 100)) + '%';
  };
  const up = () => {
    el.classList.remove('dragging');
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    sbSave(); sbRender();
  };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
// Trim an audio clip edge. Left edge also nudges offset so the audio stays put.
function sbAudioTrim(e, tr, side, total) {
  e.stopPropagation(); e.preventDefault();
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (!inner) return;
  const handle = e.currentTarget;
  try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  const rect = inner.getBoundingClientRect();
  const startX = e.clientX;
  const in0 = tr.in || 0, out0 = tr.out != null ? tr.out : (tr.dur || 0), off0 = tr.offset || 0;
  const MIN = 0.2;
  const move = (ev) => {
    const dSec = ((ev.clientX - startX) / (rect.width || 1)) * total;
    if (side === 'l') { const ni = Math.max(0, Math.min(in0 + dSec, out0 - MIN)); tr.in = ni; tr.offset = Math.max(0, off0 + (ni - in0)); }
    else { tr.out = Math.max(in0 + MIN, Math.min(out0 + dSec, tr.dur || (out0 + dSec))); }
    const cd = sbAClipDur(tr);
    const lp = Math.max(0, Math.min(99, (tr.offset / total) * 100));
    handle.parentElement.style.left = lp + '%';
    handle.parentElement.style.width = Math.max(2, Math.min(100 - lp, (cd / total) * 100)) + '%';
  };
  const up = () => {
    handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    sbSave(); sbRender();
  };
  handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
}
// Drag a corner dot inward to set fade-in / fade-out length.
function sbAudioFade(e, tr, side, total) {
  e.stopPropagation(); e.preventDefault();
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (!inner) return;
  const dot = e.currentTarget;
  try { dot.setPointerCapture(e.pointerId); } catch (_) {}
  const rect = inner.getBoundingClientRect();
  const startX = e.clientX;
  const cd = sbAClipDur(tr);
  const f0 = side === 'l' ? (tr.fadeIn || 0) : (tr.fadeOut || 0);
  const move = (ev) => {
    let dSec = ((ev.clientX - startX) / (rect.width || 1)) * total;
    if (side === 'r') dSec = -dSec; // right dot drags leftward to grow
    const f = Math.max(0, Math.min(cd / 2, f0 + dSec));
    if (side === 'l') tr.fadeIn = f; else tr.fadeOut = f;
    const clip = dot.parentElement;
    const pct = Math.min(50, (f / cd) * 100);
    if (side === 'l') { clip.querySelector('.tl-fadefill.l').style.width = pct + '%'; dot.style.left = pct + '%'; }
    else { clip.querySelector('.tl-fadefill.r').style.width = pct + '%'; dot.style.right = pct + '%'; }
  };
  const up = () => {
    dot.removeEventListener('pointermove', move); dot.removeEventListener('pointerup', up); dot.removeEventListener('pointercancel', up);
    try { dot.releasePointerCapture(e.pointerId); } catch (_) {}
    sbSave();
  };
  dot.addEventListener('pointermove', move); dot.addEventListener('pointerup', up); dot.addEventListener('pointercancel', up);
}
// Decode an audio track to an iMovie-style waveform image: a darker filled shape
// mirrored around the centre, drawn on transparent canvas so the solid clip body
// (green for music, purple for voice) reads through it.
async function sbBuildWave(tr, kind) {
  if (!tr || !tr.url || tr._waving) return;
  tr._waving = true;
  let ac = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();
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
  } catch (e) { tr._waveFailed = true; /* keep the solid clip body, don't retry */ }
  finally { if (ac) ac.close().catch(() => {}); tr._waving = false; sbRender(); }
}

// Per-clip audio waveform (the iMovie "blue band" under a video clip). Decoded
// from the clip's own audio, windowed to its [in,out], and cached IN MEMORY
// (keyed by shot id) so it never bloats the saved project. undefined = not built,
// 'pending' = decoding, false = no audio / failed, string = waveform PNG.
const sbClipWave = {};
function sbBuildClipWave(s) {
  if (!s || !s.url || sbIsImage(s) || s.src === 'title') return;
  if (sbClipWave[s.id] !== undefined) return;
  sbClipWave[s.id] = 'pending';
  (async () => {
    let ac = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      const bytes = await fetch(s.url).then((r) => r.arrayBuffer());
      const audio = await ac.decodeAudioData(bytes);
      const ch = audio.getChannelData(0), sr = audio.sampleRate;
      const inT = s.in || 0, outT = (s.out != null ? s.out : audio.duration);
      let a = Math.max(0, Math.floor(inT * sr)), b = Math.min(ch.length, Math.floor(outT * sr));
      if (b <= a) { a = 0; b = ch.length; }
      const span = b - a;
      const W = 1200, H = 70, mid = H / 2, amp = mid - 1, peaks = 400;
      const bucket = Math.max(1, Math.floor(span / peaks)), stride = Math.max(1, Math.floor(bucket / 30));
      const vals = new Array(peaks); let any = false;
      for (let i = 0; i < peaks; i++) {
        let max = 0; const base = a + i * bucket;
        for (let j = 0; j < bucket; j += stride) { const v = Math.abs(ch[base + j] || 0); if (v > max) max = v; }
        vals[i] = Math.min(1, max); if (max > 0.012) any = true;
      }
      if (!any) { sbClipWave[s.id] = false; return; } // silent clip → no band
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const cx = c.getContext('2d');
      // iMovie blue band: a vertical gradient with the waveform in a lighter tint,
      // baked into one transparent PNG so it blends cleanly over the filmstrip.
      const bg = cx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(74,132,208,.90)'); bg.addColorStop(1, 'rgba(38,84,150,.94)');
      cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
      const wamp = amp * 0.8; // leave a little margin so it reads as a waveform, not a bar
      cx.fillStyle = 'rgba(214,232,255,.72)';
      cx.beginPath(); cx.moveTo(0, mid);
      for (let i = 0; i < peaks; i++) { const x = (i / (peaks - 1)) * W; cx.lineTo(x, mid - Math.max(1, vals[i] * wamp)); }
      for (let i = peaks - 1; i >= 0; i--) { const x = (i / (peaks - 1)) * W; cx.lineTo(x, mid + Math.max(1, vals[i] * wamp)); }
      cx.closePath(); cx.fill();
      sbClipWave[s.id] = c.toDataURL('image/png');
    } catch (e) { sbClipWave[s.id] = false; }
    finally { if (ac) ac.close().catch(() => {}); sbRender(); }
  })();
}

// Add/remove a clip to the film (the bottom timeline). The clip stays in the
// left library either way — the timeline is just the ordered subset that plays
// and exports.
// Lane predicates — the main video sequence vs. floating PiP overlays.
function sbOnMain(s) { return s.onTimeline && s.lane !== 'overlay'; }
function sbIsOverlay(s) { return s.onTimeline && s.lane === 'overlay'; }

function sbAddToTimeline(id) {
  const s = sbShot(id);
  if (!s || s.onTimeline) return;
  s.onTimeline = true; s.lane = 'main';
  sbSave(); sbRender();
}
// Drop a clip onto the main lane AT the release position — insert it between the
// existing clips where you dropped it, not always at the end. Works for a clip
// dragged from the media list or an existing timeline clip being repositioned.
function sbDropOnTimeline(id, clientX) {
  const s = sbShot(id);
  if (!s) return;
  const proj = sbProject();
  const arr = proj.shots;
  const inner = document.querySelector('#timelineTrack .tl-inner');
  // Which existing main clip does the drop-x land before? (null → append at end)
  let insertBefore = null;
  const main = arr.filter((x) => sbOnMain(x) && x.id !== id);
  if (inner && main.length) {
    const rect = inner.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
    const total = main.reduce((a, x) => a + (sbShotDur(x) || 4), 0) || 1;
    const t = frac * total;
    let acc = 0;
    for (const x of main) {
      const d = sbShotDur(x) || 4;
      if (t < acc + d / 2) { insertBefore = x; break; }
      acc += d;
    }
  }
  s.onTimeline = true; s.lane = 'main';
  const cur = arr.indexOf(s);
  if (cur >= 0) arr.splice(cur, 1);
  let target = insertBefore ? arr.indexOf(insertBefore) : arr.length;
  if (target < 0) target = arr.length;
  arr.splice(target, 0, s);
  sbSave(); sbRender();
}
// Press-and-drag a timeline clip to REORDER it (iMovie-style). A plain click
// (no drag past the threshold) falls through to seek/select at that point, so
// clicking a clip still works exactly as before.
function sbClipDragStart(e, s) {
  if (e.button != null && e.button !== 0) return;
  if (e.target.closest('.sb-trim, .sb-cmute')) return; // trim/mute own their gesture
  e.stopPropagation(); // this pointer is ours, not the track's scrub
  const block = e.currentTarget;
  if (!document.querySelector('#timelineTrack .tl-inner')) return;
  try { block.setPointerCapture(e.pointerId); } catch (_) {}
  const startX = e.clientX;
  let dragging = false;
  const move = (ev) => {
    const dx = ev.clientX - startX;
    if (!dragging && Math.abs(dx) > 6) { dragging = true; block.classList.add('dragging'); }
    if (dragging) block.style.transform = 'translateX(' + dx + 'px)';
  };
  const up = (ev) => {
    block.removeEventListener('pointermove', move);
    block.removeEventListener('pointerup', up);
    block.removeEventListener('pointercancel', up);
    try { block.releasePointerCapture(e.pointerId); } catch (_) {}
    block.style.transform = '';
    block.classList.remove('dragging');
    if (dragging) sbDropOnTimeline(s.id, ev.clientX); // reorder to the release point
    else sbScrubToClientX(ev.clientX);                // plain click → seek/select there
  };
  block.addEventListener('pointermove', move);
  block.addEventListener('pointerup', up);
  block.addEventListener('pointercancel', up);
}

// ── Overlay / picture-in-picture lane ───────────────────────────────────────
// An overlay clip floats ON TOP of the main film — it has its own start time on
// the lane and a corner position, and doesn't add to the film's length.
const SB_PIP_CORNERS = ['br', 'bl', 'tr', 'tl'];
const SB_PIP_GLYPH = { br: '◢', bl: '◣', tr: '◥', tl: '◤' };
function sbOverlayInit(s) {
  if (!s) return;
  if (s.start == null) s.start = 0;
  if (!SB_PIP_CORNERS.includes(s.pip)) s.pip = 'br';
  if (s.pipScale == null) s.pipScale = 0.34;
  if (s.in == null) s.in = 0;
  if (s.out == null && (s.srcDur || s.dur)) s.out = s.srcDur || s.dur;
}
function sbFilmTotalMain() {
  return sbProject().shots.filter(sbOnMain).reduce((a, s) => a + (sbShotDur(s) || 4), 0) || 1;
}
// Drop a clip onto the overlay lane → it becomes a PiP starting at the drop time.
function sbDropOverlay(id, clientX) {
  const s = sbShot(id);
  if (!s) return;
  const total = sbFilmTotalMain();
  let t = 0;
  const inner = document.querySelector('#timelineTrack .tl-inner');
  if (inner) {
    const rect = inner.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
    t = frac * total;
  }
  s.onTimeline = true; s.lane = 'overlay';
  sbOverlayInit(s);
  const dur = sbShotDur(s) || 4;
  s.start = Math.max(0, Math.min(t, Math.max(0, total - Math.min(dur, 0.3))));
  sbSave(); sbRender();
  sbStudioNote('Overlay added — it plays on top of your film. Drag it along the lane to time it, trim its ends, or tap the corner button to move the picture-in-picture.');
}
function sbCyclePip(id) {
  const s = sbShot(id); if (!s) return;
  sbOverlayInit(s);
  s.pip = SB_PIP_CORNERS[(SB_PIP_CORNERS.indexOf(s.pip) + 1) % SB_PIP_CORNERS.length];
  sbSave(); sbRender(); sbPipSync(document.querySelector('#previewStage video'));
}
function sbRemoveOverlay(id) {
  const s = sbShot(id); if (!s) return;
  s.onTimeline = false; s.lane = 'main';
  if (sbSelected === id) sbSelected = null;
  if (sbPip && sbPip.oid === id && sbPip.wrap) { sbPip.wrap.remove(); sbPip = null; }
  sbSave(); sbRender();
}
// Drag an overlay clip along the lane to change WHEN it plays.
function sbOverlayDrag(e, s, total) {
  if (e.target.closest('.sb-trim, .sb-ocorner, .sb-x')) return;
  e.stopPropagation();
  const inner = document.querySelector('#timelineTrack .tl-inner'); if (!inner) return;
  const rect = inner.getBoundingClientRect();
  const el = e.currentTarget;
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
  const startX = e.clientX, start0 = s.start || 0;
  const dur = sbShotDur(s) || 4;
  let moved = false;
  const move = (ev) => {
    const dSec = ((ev.clientX - startX) / (rect.width || 1)) * total;
    if (Math.abs(dSec) > 0.03) moved = true;
    s.start = Math.max(0, Math.min(Math.max(0, total - Math.min(dur, 0.3)), start0 + dSec));
    el.style.left = Math.max(0, (s.start / total) * 100) + '%';
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) { sbSave(); sbRender(); } else { sbSelect(s.id); }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
// Render the overlay lane + its PiP clips (positioned by start over the film).
function sbOverlayLane(inner, total) {
  const proj = sbProject();
  const ovs = proj.shots.filter(sbIsOverlay);
  const lane = document.createElement('div');
  lane.className = 'tl-lane tl-overlay';
  lane.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); lane.classList.add('drop-here'); });
  lane.addEventListener('dragleave', () => lane.classList.remove('drop-here'));
  lane.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation(); lane.classList.remove('drop-here');
    const id = e.dataTransfer.getData('text/sb');
    if (id) sbDropOverlay(id, e.clientX);
  });
  if (!ovs.length) {
    const hint = document.createElement('span');
    hint.className = 'tl-overlay-hint';
    hint.textContent = '＋ Overlay — drop a clip here to play it on top (picture-in-picture)';
    lane.appendChild(hint);
  }
  ovs.forEach((s) => {
    sbOverlayInit(s);
    const dur = sbShotDur(s) || 4;
    const leftPct = Math.max(0, Math.min(99, (s.start / total) * 100));
    const wPct = Math.max(3, Math.min(100 - leftPct, (dur / total) * 100));
    const clip = document.createElement('div');
    clip.className = 'tl-oclip sb-block' + (s.id === sbSelected ? ' sel' : '');
    clip.style.left = leftPct + '%';
    clip.style.width = wPct + '%';
    clip.dataset.sid = s.id;
    let body = '';
    if (sbIsImage(s)) {
      body = '<div class="sb-strip sb-photostrip" style="background-image:url(\'' + (s.url || s.thumb || '') + '\')"></div>';
    } else {
      const frames = (Array.isArray(s.strip) && s.strip.length) ? s.strip : (s.thumb ? [s.thumb, s.thumb] : []);
      if (frames.length) body = '<div class="sb-strip">' + frames.map((src) => '<i class="sb-frame" style="background-image:url(\'' + src + '\')"></i>').join('') + '</div>';
    }
    clip.innerHTML = body +
      '<span class="sb-cliplabel"><b class="cl-dur">' + (Math.round(dur * 10) / 10) + 's</b> <span>PiP</span></span>' +
      '<button class="sb-ocorner" title="Move the picture-in-picture corner">' + (SB_PIP_GLYPH[s.pip] || '◢') + '</button>' +
      '<button class="sb-x sb-ox" title="Remove overlay">×</button>' +
      '<span class="sb-trim l" title="Trim the start"></span><span class="sb-trim r" title="Trim the end"></span>';
    clip.querySelector('.sb-trim.l').addEventListener('pointerdown', (e) => sbTrimStart(e, s, 'l'));
    clip.querySelector('.sb-trim.r').addEventListener('pointerdown', (e) => sbTrimStart(e, s, 'r'));
    const corner = clip.querySelector('.sb-ocorner');
    corner.addEventListener('pointerdown', (e) => e.stopPropagation());
    corner.addEventListener('click', (e) => { e.stopPropagation(); sbCyclePip(s.id); });
    const x = clip.querySelector('.sb-ox');
    x.addEventListener('pointerdown', (e) => e.stopPropagation());
    x.addEventListener('click', (e) => { e.stopPropagation(); sbRemoveOverlay(s.id); });
    clip.addEventListener('pointerdown', (e) => sbOverlayDrag(e, s, total));
    lane.appendChild(clip);
  });
  inner.appendChild(lane);
}
function sbToggleTimeline(id) {
  const s = sbShot(id);
  if (!s) return;
  s.onTimeline = !s.onTimeline;
  if (s.onTimeline && s.lane == null) s.lane = 'main';
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
  proj.transition = SB_TRANSITION_KEYS.indexOf(v) >= 0 ? v : 'none';
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
  const tl = sbProject().shots.filter(sbOnMain);
  const idx = tl.findIndex((s) => s.id === sbSelected);
  if (idx < 0) { ph.style.display = 'none'; return; }
  const total = tl.reduce((a, s) => a + (sbShotDur(s) || 4), 0) || 1;
  let before = 0;
  for (let k = 0; k < idx; k++) before += (sbShotDur(tl[k]) || 4);
  const s = tl[idx];
  const dur = sbShotDur(s) || 4;
  let within;
  if (sbIsStatic(s)) within = (sbTitleState && sbTitleState.id === s.id) ? Math.min(dur, sbTitleState.elapsed) : 0;
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
  const tl = sbProject().shots.filter(sbOnMain);
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
  if (sbIsOverlay(s)) { if (sbSelected !== s.id) { sbSelected = s.id; sbRender(); } return; }
  if (sbIsStatic(s)) {
    if (sbSelected !== s.id) { sbSelected = s.id; sbPlaying = null; sbRender(); }
    sbStopTitle();
    sbTitleState = { id: s.id, elapsed: off || 0, playing: false };
    sbShowStatic(s);
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
  const tl = sbProject().shots.filter(sbOnMain);
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
    delete sbClipWave[s.id]; // re-window the audio band for the new trim
    sbSave(); sbRender();
    // Re-seek to the (possibly new) in-point so the preview reflects the trim.
    if (sbSelected === s.id) sbSeekClip(s, 0);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

// Keyboard trim: nudge a clip's start ('l') or end ('r') by delta seconds, with
// the same clamps as the pointer trim. Keeps focus on the clip after re-render.
function sbKbdTrim(s, edge, delta) {
  const in0 = s.in || 0;
  const out0 = s.out != null ? s.out : (s.srcDur || sbShotDur(s) || 0);
  const cap = s.srcDur || out0 || sbShotDur(s) || 0;
  const MINLEN = 0.3;
  if (edge === 'r') s.out = Math.min(cap, Math.max(in0 + MINLEN, out0 + delta));
  else s.in = Math.max(0, Math.min(in0 + delta, out0 - MINLEN));
  delete sbClipWave[s.id]; // re-window the audio band for the new trim
  sbSave(); sbRender();
  if (sbSelected === s.id) sbSeekClip(s, 0);
  const el = document.querySelector('.sb-block[data-sid="' + s.id + '"]');
  if (el) el.focus();
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
  // An imported clip's source blob lives in IndexedDB keyed by its shot id. The
  // new half has a fresh id, so copy the blob across — otherwise it rehydrates as
  // 'missing' on reload and the user loses the second half of every split.
  if (s.src === 'import' && s.stored) {
    sbMediaGet(s.id).then((blob) => { if (blob) return sbMediaPut(b.id, blob); }).catch(() => {});
  }
  delete sbClipWave[s.id]; // both halves re-window their audio band
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
    if (s.out == null && !isFinite(v.duration)) { try { await sbSeek(v, 1e9); } catch (e) {} } // resolve webm Infinity
    const inP = s.in || 0;
    const outP = s.out != null ? s.out : ((isFinite(v.duration) && v.duration > 0) ? v.duration : (v.currentTime || 0));
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
  // Clamp: a stored volume outside [0,1] (bad/legacy data) would throw on assign
  // and take the whole editor render down with it.
  a.volume = Math.max(0, Math.min(1, m.volume != null ? m.volume : 0.6));
}
// Cumulative film position (seconds) of the current clip + offset.
function sbFilmTime() {
  // Previewing music/voice on their own (no video on the timeline): the film
  // clock IS the elapsed audio time.
  if (sbAudioOnly && sbAudioOnly.playing) return (performance.now() - sbAudioOnly.t0) / 1000;
  const tl = sbProject().shots.filter(sbOnMain);
  const idx = tl.findIndex((s) => s.id === sbSelected);
  if (idx < 0) return 0;
  let before = 0;
  for (let k = 0; k < idx; k++) before += (sbShotDur(tl[k]) || 4);
  const s = tl[idx];
  let within = 0;
  if (sbIsStatic(s)) within = (sbTitleState && sbTitleState.id === s.id) ? sbTitleState.elapsed : 0;
  else { const v = document.querySelector('#previewStage video'); within = v ? Math.min(sbShotDur(s) || 4, Math.max(0, v.currentTime - (s.in || 0))) : 0; }
  return before + Math.min(sbShotDur(s) || 4, within);
}
// Fade multiplier at position localT within a clip of length clipDur.
function sbFadeMul(tr, localT, clipDur) {
  let m = 1;
  if (tr.fadeIn > 0 && localT < tr.fadeIn) m *= Math.max(0, localT / tr.fadeIn);
  if (tr.fadeOut > 0 && localT > clipDur - tr.fadeOut) m *= Math.max(0, (clipDur - localT) / tr.fadeOut);
  return m;
}
// Read an audio file's real duration, resolving the MediaRecorder-webm quirk
// where the duration reads Infinity until you seek past the end. Recorded
// voiceovers are ALWAYS such a webm, so without this every voiceover (and any
// duration-less music file) lands on the lane with infinite length.
async function sbAudioDuration(url) {
  const a = document.createElement('audio'); a.preload = 'metadata'; a.src = url;
  try {
    await new Promise((ok, err) => { a.onloadedmetadata = ok; a.onerror = err; setTimeout(ok, 6000); });
    if (!isFinite(a.duration) || a.duration <= 0) {
      await new Promise((ok) => { a.onseeked = ok; try { a.currentTime = 1e9; } catch (e) {} setTimeout(ok, 2500); });
    }
    return (isFinite(a.duration) && a.duration > 0) ? a.duration : (a.currentTime || 0);
  } catch (e) { return 0; }
}
// Sync one audio track's element to the film position, honoring its offset,
// trim (in/out), fades, volume, and (music) ducking. Silent outside its span.
function sbSyncAudioTrack(tr, el, kind, v, opts) {
  if (!tr || !tr.url || !el) { if (el && !el.paused) el.pause(); return; }
  sbAudioInit(tr);
  const playing = (sbTitleState && sbTitleState.playing) || (sbAudioOnly && sbAudioOnly.playing) || (v && !v.paused && !v.ended);
  const ft = sbFilmTime();
  const off = tr.offset || 0;
  const clipDur = sbAClipDur(tr);
  const localT = ft - off;
  if (!playing || localT < -0.05 || localT > clipDur + 0.05) { if (!el.paused) el.pause(); return; }
  const lt = Math.max(0, Math.min(clipDur, localT));
  const srcTime = (tr.in || 0) + lt;
  if ((opts && opts.hard) || Math.abs((el.currentTime || 0) - srcTime) > 0.35) { try { el.currentTime = srcTime; } catch (_) {} }
  let vol = tr.volume != null ? tr.volume : (kind === 'music' ? 0.6 : 1);
  vol *= sbFadeMul(tr, lt, clipDur);
  if (kind === 'music' && tr.duck) { const s = sbShot(sbSelected); if (s && s.src !== 'title' && !s.muted) vol *= 0.4; }
  el.volume = Math.max(0, Math.min(1, vol));
  if (el.paused) el.play().catch(() => {});
}
// Keep both audio tracks aligned to the film position + play state.
function sbMusicSync(v, opts) {
  sbMusicLoad();
  sbSyncAudioTrack(sbProject().music, document.getElementById('sbMusicAudio'), 'music', v, opts);
  sbVoiceSync(v, opts);
  sbPipSync(v);
  sbUpdateTimecode();
}
// Film-global transport timecode (position / total), honest when the film is
// empty. mm:ss like iMovie — not the dense mm:ss:ff we used to show.
function sbUpdateTimecode() {
  const tc = document.getElementById('studioTimecode');
  if (!tc) return;
  const main = sbProject().shots.filter(sbOnMain);
  if (!main.length) { tc.textContent = '0:00 / 0:00'; return; }
  const total = main.reduce((a, s) => a + (sbShotDur(s) || 4), 0);
  tc.textContent = sbFmtClock(sbFilmTime()) + ' / ' + sbFmtClock(total);
}
// m:ss (drop the leading zero on minutes, iMovie-style).
function sbFmtClock(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + String(ss).padStart(2, '0');
}
// ── Picture-in-picture preview ──────────────────────────────────────────────
// Which overlay clip (if any) is on screen at the current film time.
function sbActiveOverlay(ft) {
  const ovs = sbProject().shots.filter(sbIsOverlay);
  for (const o of ovs) {
    sbOverlayInit(o);
    const d = sbShotDur(o) || 4;
    if (ft >= o.start - 0.03 && ft < o.start + d + 0.03 && (o.url || sbIsImage(o))) return o;
  }
  return null;
}
function sbApplyPipPos(wrap, pip, scale) {
  wrap.style.width = Math.round((scale || 0.34) * 100) + '%';
  wrap.style.top = wrap.style.bottom = wrap.style.left = wrap.style.right = '';
  const m = '4.5%';
  if (pip === 'tl') { wrap.style.top = m; wrap.style.left = m; }
  else if (pip === 'tr') { wrap.style.top = m; wrap.style.right = m; }
  else if (pip === 'bl') { wrap.style.bottom = m; wrap.style.left = m; }
  else { wrap.style.bottom = m; wrap.style.right = m; } // br
}
// Show/sync the PiP element over the preview for whatever overlay is on screen.
function sbPipSync(v) {
  const stage = document.getElementById('previewStage');
  if (!stage) return;
  const ft = sbFilmTime();
  const playing = (sbTitleState && sbTitleState.playing) || (sbAudioOnly && sbAudioOnly.playing) || (v && !v.paused && !v.ended);
  const o = sbActiveOverlay(ft);
  if (!o) {
    if (sbPip && sbPip.wrap) { if (sbPip.media && sbPip.media.pause) { try { sbPip.media.pause(); } catch (e) {} } sbPip.wrap.remove(); }
    return;
  }
  const isImg = sbIsImage(o);
  if (!sbPip || sbPip.oid !== o.id || sbPip.kind !== (isImg ? 'img' : 'vid')) {
    if (sbPip && sbPip.wrap) sbPip.wrap.remove();
    const wrap = document.createElement('div'); wrap.className = 'sb-pip';
    const media = document.createElement(isImg ? 'img' : 'video'); media.className = 'sb-pip-media';
    if (!isImg) { media.muted = true; media.playsInline = true; media.preload = 'auto'; }
    media.src = o.url;
    wrap.appendChild(media);
    sbPip = { oid: o.id, kind: isImg ? 'img' : 'vid', wrap, media };
  }
  // Re-attach after any innerHTML wipe from a clip switch (keeps the decoded frame).
  if (sbPip.wrap.parentNode !== stage) stage.appendChild(sbPip.wrap);
  sbApplyPipPos(sbPip.wrap, o.pip, o.pipScale);
  if (!isImg && sbPip.media) {
    const srcT = (o.in || 0) + Math.max(0, ft - o.start);
    if (Math.abs((sbPip.media.currentTime || 0) - srcT) > 0.34) { try { sbPip.media.currentTime = srcT; } catch (e) {} }
    if (playing) { if (sbPip.media.paused) sbPip.media.play().catch(() => {}); }
    else if (!sbPip.media.paused) sbPip.media.pause();
  }
}
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
}
function sbVoiceSync(v, opts) {
  sbVoiceLoad();
  sbSyncAudioTrack(sbProject().voice, document.getElementById('sbVoiceAudio'), 'voice', v, opts);
}
async function sbSetMusic(f) {
  const proj = sbProject();
  // Replacing an existing track — free its old object URL first.
  if (proj.music && typeof proj.music.url === 'string' && proj.music.url.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(proj.music.url); } catch (e) {}
  }
  const url = URL.createObjectURL(f);
  proj.music = { name: f.name.replace(/\.[^.]+$/, ''), mime: f.type || '', url, stored: false, dur: 0, volume: 0.6 };
  sbSave(); sbRenderMusicBar();
  try { await sbMediaPut('music-' + proj.id, f); proj.music.stored = true; }
  catch (e) { console.warn('could not persist music (kept for this tab only):', e); }
  proj.music.dur = await sbAudioDuration(url);
  proj.music.out = proj.music.dur; sbAudioInit(proj.music);
  sbSave(); sbRenderMusicBar(); sbMusicLoad();
  sbStudioNote('Added music: “' + proj.music.name + '”. Drag it along the lane to reposition, trim its ends, or fade it with the corner dots.');
}
function sbRemoveMusic() {
  const proj = sbProject();
  if (!proj.music) return;
  const a = document.getElementById('sbMusicAudio');
  if (a) { a.pause(); a.removeAttribute('src'); a.dataset.src = ''; }
  if (proj.music.stored) sbMediaDel('music-' + proj.id);
  if (typeof proj.music.url === 'string' && proj.music.url.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(proj.music.url); } catch (e) {}
  }
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
  { k: 'shots', label: 'Media' },
  { k: 'themes', label: 'Themes' },
  { k: 'transitions', label: 'Transitions' },
  { k: 'titles', label: 'Titles' },
  { k: 'backgrounds', label: 'Backgrounds' },
];
// Only transitions the exporter actually renders (applied film-wide).
const SB_TRANSITIONS = [
  { k: 'none', label: 'None', kind: 'cut' },
  { k: 'crossfade', label: 'Cross Dissolve', kind: 'xfade' },
  { k: 'dip', label: 'Dip to Black', kind: 'dip' },
  { k: 'dipwhite', label: 'Dip to White', kind: 'dip' },
  { k: 'wipe', label: 'Wipe', kind: 'xfade' },
];
// Keep every validator + exporter agreeing on the allowed set.
const SB_TRANSITION_KEYS = SB_TRANSITIONS.map((t) => t.k);
const SB_TITLE_PRESETS = [
  { k: 'sunset', label: 'Sunset', g0: '#ff79c6', g1: '#ffb84d' },
  { k: 'grape', label: 'Grape', g0: '#a06cff', g1: '#ff79c6' },
  { k: 'ocean', label: 'Ocean', g0: '#3ec6ff', g1: '#8a7bff' },
  { k: 'mint', label: 'Mint', g0: '#34d399', g1: '#3ec6ff' },
  { k: 'ember', label: 'Ember', g0: '#ff7a5b', g1: '#ff2d78' },
  { k: 'mono', label: 'Mono', g0: '#20202a', g1: '#0b0b10' },
];
// iMovie-style themes: one click sets the film transition + whole-film fade and
// recolors every title/background card to a matching palette.
const SB_THEMES = [
  { k: 'none',   label: 'None',   transition: 'none',      fade: false, g0: '#0b0b10', g1: '#0b0b10' },
  { k: 'modern', label: 'Modern', transition: 'crossfade', fade: true,  g0: '#20202a', g1: '#0b0b10' },
  { k: 'bright', label: 'Bright', transition: 'dipwhite',  fade: true,  g0: '#3ec6ff', g1: '#8a7bff' },
  { k: 'sunset', label: 'Sunset', transition: 'crossfade', fade: true,  g0: '#ff79c6', g1: '#ffb84d' },
  { k: 'bold',   label: 'Bold',   transition: 'wipe',      fade: false, g0: '#ff7a5b', g1: '#ff2d78' },
  { k: 'noir',   label: 'Noir',   transition: 'dip',       fade: true,  g0: '#26262e', g1: '#0b0b10' },
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
  if (sbTab === 'themes') {
    const note = document.createElement('div');
    note.className = 'mb-note'; note.textContent = 'One click sets the transition, fade, and title look for the whole film.';
    browser.appendChild(note);
    SB_THEMES.forEach((t) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mb-item' + ((proj.theme || 'none') === t.k ? ' active' : '');
      item.innerHTML = '<span class="mb-prev" style="background:' + sbGrad(t.g0, t.g1) + '"><b style="color:' + sbTitleInk(t) + '">' + t.label + '</b></span><span class="mb-label">' + t.label + '</span>';
      item.onclick = () => { sbApplyTheme(t); sbRenderBrowser(); };
      grid.appendChild(item);
    });
  } else if (sbTab === 'transitions') {
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
// Apply a theme: set the film transition + fade, and recolor every title card.
function sbApplyTheme(t) {
  const proj = sbProject();
  proj.theme = t.k;
  proj.transition = SB_TRANSITION_KEYS.indexOf(t.transition) >= 0 ? t.transition : 'none';
  proj.fade = !!t.fade;
  (proj.shots || []).forEach((s) => {
    if (s.src === 'title') { s.g0 = t.g0; s.g1 = t.g1; s.bg = sbGrad(t.g0, t.g1); }
  });
  sbSave(); sbRender();
  const trLabel = (SB_TRANSITIONS.find((x) => x.k === proj.transition) || {}).label;
  sbStudioNote('Applied the ' + t.label + ' theme — ' +
    (proj.transition === 'none' ? 'hard cuts' : (trLabel || '').toLowerCase() + ' transitions') +
    (proj.fade ? ', film fade in/out' : '') + ', and matching title colors.');
}
// iMovie "detach audio": pull a video clip's audio into the audio lane (the
// voice slot) as its own draggable/trimmable clip, and mute the source clip.
async function sbDetachAudio(id) {
  const s = sbShot(id);
  if (!s || s.src === 'title' || sbIsImage(s)) { sbStudioNote('Select a video clip first, then detach its audio.'); return; }
  if (!s.url) { sbStudioNote('That clip isn’t loaded yet — try again once it’s ready.'); return; }
  if (!window.sbFFExtractAudio || !window.sbFFSupported || !window.sbFFSupported()) {
    sbStudioNote('This browser can’t run the on-device audio extractor.'); return;
  }
  const proj = sbProject();
  if (proj.voice && proj.voice.url) { sbStudioNote('The audio lane is already in use — remove that track first, then detach.'); return; }
  const idx = proj.shots.indexOf(s) + 1;
  // Place the detached audio at the clip's position in the film.
  let filmStart = 0;
  for (const x of proj.shots.filter(sbOnMain)) { if (x.id === s.id) break; filmStart += sbShotDur(x) || 0; }
  const prev = s.status;
  s.status = 'editing'; sbSave(); sbRender();
  try {
    const blob = await window.sbFFExtractAudio(s.url, {
      url: s.url, mime: s.mime, start: s.in || 0, dur: sbShotDur(s),
      onProgress: (p) => sbStudioProgress('Detaching audio… ' + Math.round(p * 100) + '%'),
    });
    s.status = prev;
    if (!blob) { sbSave(); sbRender(); sbStudioNote('Clip ' + idx + ' has no audio to detach.'); return; }
    const dur = sbShotDur(s) || 0;
    const url = URL.createObjectURL(blob);
    proj.voice = { name: 'Clip ' + idx + ' audio', mime: 'audio/mp4', url, stored: false, dur, volume: 1, offset: filmStart, in: 0, out: dur, fadeIn: 0, fadeOut: 0 };
    s.muted = true; // the audio now lives in the lane; mute the source clip
    sbAudioInit(proj.voice);
    try { await sbMediaPut('voice-' + proj.id, blob); proj.voice.stored = true; } catch (e) {}
    sbSave(); sbRenderVoiceBar(); sbRender();
    sbStudioNote('Detached clip ' + idx + '’s audio into its own lane — drag, trim, or fade it independently. The clip is now muted.');
  } catch (e) {
    console.error('detach audio failed:', e);
    s.status = prev; sbSave(); sbRender();
    sbStudioNote('Couldn’t detach that clip’s audio — try again in a moment.');
  }
}
function sbStopTitle() {
  if (sbTitleRAF) { cancelAnimationFrame(sbTitleRAF); sbTitleRAF = 0; }
  sbTitleState = null;
}
// Drop a still photo into the preview stage (letterboxed, with the clip's look).
function sbShowStill(s) {
  const stage = document.getElementById('previewStage');
  if (!stage) return;
  stage.innerHTML = '<img class="preview-still" alt="" style="width:100%;height:100%;object-fit:contain;display:block;background:#000;filter:'
    + sbFilterStr(s) + '" />';
  const img = stage.querySelector('.preview-still');
  if (img && s.url) img.src = s.url;
}
// Show whichever static clip this is — a title card or a still photo.
function sbShowStatic(s) { if (sbIsImage(s)) sbShowStill(s); else sbShowTitleCard(s); }
// Play a static clip (title card or photo): paint it, run a RAF clock for its
// length, keep the audio + play button + playhead in sync, then chain onward.
function sbPlayStatic(s, next) {
  sbShowStatic(s);
  const dur = sbShotDur(s) || 3;
  sbStopTitle();
  sbStopAudioOnly();
  sbTitleState = { id: s.id, elapsed: 0, playing: true };
  const t0 = performance.now();
  sbSyncPlayBtn();
  sbMusicSync(null, { hard: true });
  const step = () => {
    if (!sbTitleState || sbTitleState.id !== s.id) return;
    sbTitleState.elapsed = (performance.now() - t0) / 1000;
    sbUpdatePlayhead(null);
    sbMusicSync(null);
    if (sbTitleState.elapsed >= dur) { sbStopTitle(); sbSyncPlayBtn(); if (next) next(); else sbMusicSync(null); return; }
    sbTitleRAF = requestAnimationFrame(step);
  };
  step();
}
// ── Audio-only preview ──────────────────────────────────────────────────────
// When the timeline holds only a music / voiceover track (no video, no photos),
// there's no <video> to drive playback — so run our own clock and let the audio
// sync ride on it. This is what makes "press play with just music" actually play.
function sbStopAudioOnly() {
  if (sbAudioOnly && sbAudioOnly.raf) cancelAnimationFrame(sbAudioOnly.raf);
  sbAudioOnly = null;
}
function sbAudioSpan(tr) { return (tr && tr.url) ? (tr.offset || 0) + sbAClipDur(tr) : 0; }
function sbPlayAudioOnly() {
  const proj = sbProject();
  const dur = Math.max(sbAudioSpan(proj.music), sbAudioSpan(proj.voice));
  if (dur <= 0) { sbStudioNote('Import a music track first — then press play to hear it.'); return; }
  sbStopTitle();
  sbStopAudioOnly();
  const t0 = performance.now();
  sbAudioOnly = { playing: true, t0, raf: 0 };
  sbSyncPlayBtn();
  sbMusicSync(null, { hard: true });
  const step = () => {
    if (!sbAudioOnly || !sbAudioOnly.playing) return;
    const el = (performance.now() - t0) / 1000;
    sbMusicSync(null);
    if (el >= dur) { sbStopAudioOnly(); sbMusicSync(null); sbSyncPlayBtn(); return; }
    sbAudioOnly.raf = requestAnimationFrame(step);
  };
  step();
}
// Keep the transport play button's glyph honest: ❚❚ while anything is actually
// playing (video, static card, or audio-only), ▶ when stopped/paused.
function sbSyncPlayBtn() {
  const btn = document.querySelector('.pc-play');
  if (!btn) return;
  const v = document.querySelector('#previewStage video');
  const playing = (sbTitleState && sbTitleState.playing) || (sbAudioOnly && sbAudioOnly.playing) || (v && !v.paused && !v.ended);
  btn.textContent = playing ? '❚❚' : '▶';
  btn.title = playing ? 'Pause' : 'Play';
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
  // Replacing an existing voiceover — free its old object URL first.
  if (proj.voice && typeof proj.voice.url === 'string' && proj.voice.url.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(proj.voice.url); } catch (e) {}
  }
  const url = URL.createObjectURL(blob);
  proj.voice = { name: 'Voiceover', mime: blob.type || 'audio/webm', url, stored: false, dur: 0, volume: 1 };
  sbSave(); sbRenderVoiceBar();
  try { await sbMediaPut('voice-' + proj.id, blob); proj.voice.stored = true; }
  catch (e) { console.warn('could not persist voiceover:', e); }
  proj.voice.dur = await sbAudioDuration(url);
  proj.voice.out = proj.voice.dur; sbAudioInit(proj.voice);
  sbSave(); sbRenderVoiceBar();
  sbStudioNote('Voiceover added — drag it along the lane to place it, trim its ends, or fade it with the corner dots.');
}
function sbRemoveVoice() {
  const proj = sbProject();
  if (!proj.voice) return;
  const a = document.getElementById('sbVoiceAudio');
  if (a) { a.pause(); a.removeAttribute('src'); }
  if (proj.voice.stored) sbMediaDel('voice-' + proj.id);
  if (typeof proj.voice.url === 'string' && proj.voice.url.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(proj.voice.url); } catch (e) {}
  }
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
    // Free the clip's object URL — nothing references it once the shot is gone.
    if (typeof shots[i].url === 'string' && shots[i].url.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(shots[i].url); } catch (e) {}
    }
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
    v.controls = false; // clean iMovie-style preview — our own transport + the
                        // timeline drive play/scrub (no browser chrome or a second timecode)
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    stage.appendChild(v);
    v.addEventListener('timeupdate', () => {
      sbSegmentTick(v);
      sbUpdatePlayhead(v);
      sbMusicSync(v); // also refreshes the timecode + PiP
    });
    // Keep the background music track + the play button locked to the film's state.
    v.addEventListener('play', () => { sbMusicSync(v, { hard: true }); sbSyncPlayBtn(); });
    v.addEventListener('pause', () => { sbMusicSync(v); sbSyncPlayBtn(); });
    v.addEventListener('seeking', () => sbMusicSync(v, { hard: true }));
    v.addEventListener('ended', () => { sbMusicSync(v); sbSyncPlayBtn(); });
    v.addEventListener('click', () => sbTogglePlay()); // click the viewer to play/pause (iMovie)
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
  if (sbIsStatic(s)) return sbPlayStatic(s, next);
  sbStopTitle();
  sbStopAudioOnly();
  const v = sbVideoEl();
  if (!v || !s.url) return;
  const start = s.in || 0;
  sbSegment = { out: s.out != null ? s.out : null, next: next || null };
  // If the clip can't load (e.g. a blob URL that was revoked because the clip was
  // deleted mid-play, or a broken source), don't stall the film — advance to the
  // next clip instead of waiting on a loadedmetadata that will never come.
  const onErr = () => {
    v.removeEventListener('loadedmetadata', go);
    if (next) next(); else { sbSegment = null; sbSyncPlayBtn(); }
  };
  const go = () => {
    v.removeEventListener('error', onErr);
    sbNoteSrcDur(s, v);
    sbApplyPreview(s);
    v.currentTime = start; v.play().catch(() => {});
  };
  if (v.dataset.src !== s.url) {
    v.dataset.src = s.url;
    v.src = s.url;
    v.addEventListener('loadedmetadata', go, { once: true });
    v.addEventListener('error', onErr, { once: true });
  } else go();
  if (next) v.onended = () => next();
  else v.onended = null;
}
// Cue a clip into the preview WITHOUT playing it — load it, show its first frame,
// park the playhead there. Selecting a clip cues it (iMovie-style); the ▶ button
// is what starts playback.
function sbCueShot(s) {
  if (sbIsStatic(s)) { sbStopTitle(); sbShowStatic(s); sbUpdatePlayhead(null); sbSyncPlayBtn(); return; }
  sbStopTitle();
  sbStopAudioOnly();
  const v = sbVideoEl();
  if (!v || !s.url) return;
  const start = s.in || 0;
  sbSegment = { out: s.out != null ? s.out : null, next: null };
  const go = () => {
    sbNoteSrcDur(s, v);
    sbApplyPreview(s);
    try { v.currentTime = start; } catch (_) {}
    v.pause();
    sbUpdatePlayhead(v); sbMusicSync(v); sbSyncPlayBtn();
  };
  if (v.dataset.src !== s.url) {
    v.dataset.src = s.url;
    v.src = s.url;
    v.addEventListener('loadedmetadata', go, { once: true });
  } else go();
  v.onended = null;
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
  const playing = (sbTitleState && sbTitleState.playing) || (sbAudioOnly && sbAudioOnly.playing) || (v && !v.paused && !v.ended);
  // Playing → stop everything (video, static card, or audio-only preview).
  if (playing) {
    if (v) v.pause();
    sbStopTitle(); sbStopAudioOnly(); sbSegment = null;
    sbMusicSync(v || null); sbSyncPlayBtn();
    return;
  }
  // Not playing → play THROUGH the film from the selected clip to the end,
  // chaining shot → shot (this is what makes it "keep on playing" instead of
  // stopping at the current clip).
  const tl = sbProject().shots.filter((s) => sbOnMain(s) && (s.src === 'title' || (s.url && s.status === 'ready')));
  if (tl.length) {
    let start = tl.findIndex((s) => s.id === sbSelected);
    if (start < 0) start = 0;
    let i = start;
    const playNext = () => {
      if (i >= tl.length) { sbSegment = null; sbSyncPlayBtn(); return; }
      const s = tl[i++];
      if (!s || !sbProject().shots.includes(s)) { playNext(); return; } // removed mid-play → skip
      sbSelected = s.id; sbRender();
      sbPlayShot(s, playNext);
    };
    playNext();
    return;
  }
  // No clips on the timeline — but there may be a music / voiceover track to hear.
  const proj = sbProject();
  if ((proj.music && proj.music.url) || (proj.voice && proj.voice.url)) { sbPlayAudioOnly(); return; }
  // Nothing on the timeline yet — preview the first clip sitting in the list.
  const { shots } = sbCurIndex(); const first = shots.find((s) => s.url); if (first) sbSelect(first.id);
}
function sbFullscreenPreview() {
  const v = document.querySelector('#previewStage video');
  if (v && v.requestFullscreen) v.requestFullscreen().catch(() => {});
}
// ── Per-clip adjustments: filters · speed · volume (the preview adjust bar) ──
const SB_FILTERS = [
  { k: 'none', label: 'Original' }, { k: 'bw', label: 'B&W' }, { k: 'noir', label: 'Noir' },
  { k: 'sepia', label: 'Sepia' }, { k: 'vintage', label: 'Vintage' },
  { k: 'warm', label: 'Warm' }, { k: 'cool', label: 'Cool' }, { k: 'vivid', label: 'Vivid' },
];
// One string, valid for both CSS `filter` and canvas `ctx.filter`.
const SB_FILTER_CSS = {
  bw: 'grayscale(1)',
  noir: 'grayscale(1) contrast(1.45) brightness(.92)',
  sepia: 'sepia(.7)',
  vintage: 'sepia(.4) contrast(.92) brightness(1.05) saturate(1.25)',
  warm: 'sepia(.32) saturate(1.35) hue-rotate(-12deg)',
  cool: 'saturate(1.12) hue-rotate(16deg) brightness(1.03)',
  vivid: 'saturate(1.65) contrast(1.08)',
};
const SB_SPEED_OPTS = [0.25, 0.5, 1, 1.5, 2, 4];
const SB_MOTION = [
  { k: 'none', label: 'None' }, { k: 'zoomIn', label: 'Zoom In' }, { k: 'zoomOut', label: 'Zoom Out' },
  { k: 'panR', label: 'Pan →' }, { k: 'panL', label: '← Pan' },
];
// Preview-only Ken Burns loops (export is exact, driven by sbSourceRect).
const SB_KB_ANIM = {
  zoomIn: 'kb-zin 5s ease-in-out infinite alternate',
  zoomOut: 'kb-zout 5s ease-in-out infinite alternate',
  panR: 'kb-panr 6s ease-in-out infinite alternate',
  panL: 'kb-panl 6s ease-in-out infinite alternate',
};
function sbHasMotion(s) { return !!(s && ((s.motion && s.motion !== 'none') || s.fill)); }
// The animated source-crop rectangle for fill / Ken Burns, given clip progress p.
function sbSourceRect(s, vW, vH, p, W, H) {
  const frameAR = W / H, vAR = vW / vH;
  let cw = vW, ch = vH;                    // cover-crop to the frame aspect
  if (vAR > frameAR) cw = vH * frameAR; else ch = vW / frameAR;
  let cx = (vW - cw) / 2, cy = (vH - ch) / 2;
  const z = 0.82; // tightest window for zoom/pan
  switch (s.motion) {
    case 'zoomIn': { const k = 1 - (1 - z) * p; cw *= k; ch *= k; cx = (vW - cw) / 2; cy = (vH - ch) / 2; break; }
    case 'zoomOut': { const k = z + (1 - z) * p; cw *= k; ch *= k; cx = (vW - cw) / 2; cy = (vH - ch) / 2; break; }
    case 'panR': case 'panL': {
      cw *= z; ch *= z; cy = (vH - ch) / 2;
      const range = Math.max(0, vW - cw);
      cx = (s.motion === 'panR' ? p : 1 - p) * range;
      break;
    }
    default: break; // plain fill — static cover crop
  }
  return { sx: cx, sy: cy, sw: cw, sh: ch };
}
// Named look + color-correction combined into one string, valid for CSS and canvas.
function sbFilterStr(s) {
  const parts = [];
  if (s && s.filter && SB_FILTER_CSS[s.filter]) parts.push(SB_FILTER_CSS[s.filter]);
  const a = s && s.adj;
  if (a) {
    if (a.br != null && a.br !== 1) parts.push('brightness(' + a.br + ')');
    if (a.con != null && a.con !== 1) parts.push('contrast(' + a.con + ')');
    if (a.sat != null && a.sat !== 1) parts.push('saturate(' + a.sat + ')');
  }
  return parts.join(' ') || 'none';
}
function sbClipVol(s) { return s.muted ? 0 : Math.max(0, Math.min(1, s.volume != null ? s.volume : 1)); }
function sbAdjOn(a) { return !!(a && ((a.br != null && a.br !== 1) || (a.con != null && a.con !== 1) || (a.sat != null && a.sat !== 1))); }
function sbHasOverlay(s) { return !!(s && s.overlay && s.overlay.text && String(s.overlay.text).trim()); }
function sbClipHasAdjust(s) {
  return !!(s && ((s.filter && s.filter !== 'none') || (s.speed && s.speed !== 1) || (s.volume != null && s.volume !== 1) || sbAdjOn(s.adj) || sbHasMotion(s) || sbHasOverlay(s)));
}
// Push the selected clip's look / speed / volume onto the live preview <video>.
function sbApplyPreview(s) {
  if (!s || sbSelected !== s.id) return;
  const v = document.querySelector('#previewStage video');
  if (!v) return;
  v.style.filter = sbFilterStr(s);
  v.playbackRate = s.speed && s.speed > 0 ? s.speed : 1;
  v.volume = sbClipVol(s);
  v.style.objectFit = sbHasMotion(s) ? 'cover' : '';
  v.style.animation = (s.motion && SB_KB_ANIM[s.motion]) ? SB_KB_ANIM[s.motion] : '';
  // live title overlay text drawn over the clip
  const stage = document.getElementById('previewStage');
  if (stage) {
    let cap = stage.querySelector('.preview-caption');
    if (sbHasOverlay(s)) {
      if (!cap) { cap = document.createElement('div'); stage.appendChild(cap); }
      cap.className = 'preview-caption pos-' + (s.overlay.pos || 'lower');
      cap.textContent = s.overlay.text;
    } else if (cap) { cap.remove(); }
  }
}
let sbAdjTool = null; // which adjust popover is open: filter | speed | volume
function sbToggleAdjust(tool) {
  const s = sbShot(sbSelected);
  if (!s || s.src === 'title') { sbStudioNote('Select a video clip on the timeline first, then adjust it.'); return; }
  sbAdjTool = (sbAdjTool === tool) ? null : tool;
  sbRenderAdjust();
}
function sbRenderAdjust() {
  const pop = document.getElementById('sbAdjustPanel');
  const s = sbShot(sbSelected);
  document.querySelectorAll('.preview-toolbar [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === sbAdjTool));
  if (!pop) return;
  if (!sbAdjTool || !s || s.src === 'title') { pop.hidden = true; pop.innerHTML = ''; return; }
  pop.hidden = false;
  let html = '';
  if (sbAdjTool === 'text') {
    html = '<div class="adj-title">Text on this clip</div>' +
      '<input type="text" class="adj-text" maxlength="120" placeholder="Add a caption…" />' +
      '<div class="adj-pos">' + [['upper', 'Top'], ['center', 'Center'], ['lower', 'Bottom']].map(([k, l]) => '<button class="adj-p' + (((s.overlay && s.overlay.pos) || 'lower') === k ? ' on' : '') + '" data-pos="' + k + '">' + l + '</button>').join('') + '</div>';
  } else if (sbAdjTool === 'crop') {
    html = '<div class="adj-title">Crop &amp; Ken Burns</div>' +
      '<button class="adj-fill' + (s.fill ? ' on' : '') + '" data-fill="1">' + (s.fill ? '✓ ' : '') + 'Crop to fill</button>' +
      '<div class="adj-motion">' + SB_MOTION.map((m) => '<button class="adj-m' + ((s.motion || 'none') === m.k ? ' on' : '') + '" data-m="' + m.k + '">' + m.label + '</button>').join('') + '</div>';
  } else if (sbAdjTool === 'filter') {
    html = '<div class="adj-title">Filter</div><div class="adj-filters">' +
      SB_FILTERS.map((f) => '<button class="adj-f' + ((s.filter || 'none') === f.k ? ' on' : '') + '" data-f="' + f.k + '">' +
        '<span class="adj-fp" style="filter:' + (SB_FILTER_CSS[f.k] || 'none') + '"></span><span>' + f.label + '</span></button>').join('') + '</div>';
  } else if (sbAdjTool === 'speed') {
    html = '<div class="adj-title">Speed</div><div class="adj-speeds">' +
      SB_SPEED_OPTS.map((sp) => '<button class="adj-s' + ((s.speed || 1) === sp ? ' on' : '') + '" data-s="' + sp + '">' + sp + '×</button>').join('') + '</div>';
  } else if (sbAdjTool === 'adjust') {
    const a = s.adj || {};
    const row = (key, label, val) => {
      const v = Math.round((val != null ? val : 1) * 100);
      return '<div class="adj-row"><label>' + label + ' · <b>' + v + '%</b></label>' +
        '<input type="range" class="adj-r" data-adj="' + key + '" min="50" max="150" value="' + v + '" /></div>';
    };
    html = '<div class="adj-title">Color <button class="adj-reset" data-reset="1">Reset</button></div>' +
      row('br', 'Brightness', a.br) + row('con', 'Contrast', a.con) + row('sat', 'Saturation', a.sat);
  } else if (sbAdjTool === 'volume') {
    const vol = Math.round(sbClipVol(s) * 100);
    html = '<div class="adj-title">Volume · <b id="adjVolVal">' + vol + '%</b></div><input type="range" class="adj-vol" min="0" max="100" value="' + vol + '" />'
      + '<button class="adj-fill adj-detach" data-detach="1">🎙 Detach audio to its own lane</button>';
  }
  pop.innerHTML = html;
  pop.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => sbSetClipFilter(b.dataset.f); });
  pop.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => sbSetClipSpeed(parseFloat(b.dataset.s)); });
  pop.querySelectorAll('[data-adj]').forEach((r) => { r.oninput = () => sbSetClipAdjust(r.dataset.adj, parseInt(r.value, 10) / 100, r); });
  pop.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => sbSetClipMotion(b.dataset.m); });
  const fb = pop.querySelector('[data-fill]');
  if (fb) fb.onclick = () => sbToggleFill();
  const ti = pop.querySelector('.adj-text');
  if (ti) { ti.value = (s.overlay && s.overlay.text) || ''; ti.oninput = () => sbSetOverlayText(ti.value); }
  pop.querySelectorAll('[data-pos]').forEach((b) => { b.onclick = () => sbSetOverlayPos(b.dataset.pos); });
  const rst = pop.querySelector('[data-reset]');
  if (rst) rst.onclick = () => { const sh = sbShot(sbSelected); if (sh) { sh.adj = null; sbSave(); sbApplyPreview(sh); sbRenderAdjust(); } };
  const vr = pop.querySelector('.adj-vol');
  if (vr) vr.oninput = () => { const val = parseInt(vr.value, 10); const lab = document.getElementById('adjVolVal'); if (lab) lab.textContent = val + '%'; sbSetClipVolume(val / 100); };
  const detach = pop.querySelector('[data-detach]');
  if (detach) detach.onclick = () => sbDetachAudio(sbSelected);
}
function sbSetClipAdjust(key, val, rangeEl) {
  const s = sbShot(sbSelected); if (!s) return;
  s.adj = s.adj || {}; s.adj[key] = val;
  sbSave(); sbApplyPreview(s);
  if (rangeEl) { const lab = rangeEl.parentElement.querySelector('b'); if (lab) lab.textContent = Math.round(val * 100) + '%'; }
}
function sbSetClipMotion(k) { const s = sbShot(sbSelected); if (!s) return; s.motion = k === 'none' ? null : k; if (s.motion) s.fill = true; sbSave(); sbApplyPreview(s); sbRenderAdjust(); }
function sbToggleFill() { const s = sbShot(sbSelected); if (!s) return; s.fill = !s.fill; if (!s.fill) s.motion = null; sbSave(); sbApplyPreview(s); sbRenderAdjust(); }
function sbSetOverlayText(t) {
  const s = sbShot(sbSelected); if (!s) return;
  t = String(t).slice(0, 120);
  if (!t.trim()) s.overlay = null;
  else { s.overlay = s.overlay || { pos: 'lower' }; s.overlay.text = t; }
  sbSave(); sbApplyPreview(s);
}
function sbSetOverlayPos(p) {
  const s = sbShot(sbSelected); if (!s) return;
  s.overlay = s.overlay || {}; s.overlay.pos = p;
  sbSave(); sbApplyPreview(s); sbRenderAdjust();
}
// Draw a clip's overlay caption onto the export canvas (word-wrapped, shadowed).
function sbPaintCaption(ctx, W, H, s) {
  if (!sbHasOverlay(s)) return;
  const txt = String(s.overlay.text).trim();
  const fs = Math.round(H * 0.062);
  ctx.save();
  ctx.font = '700 ' + fs + "px 'Space Grotesk', Inter, sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = txt.split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > W * 0.86 && line) { lines.push(line); line = w; } else line = test; }
  if (line) lines.push(line);
  const lh = fs * 1.25;
  const pos = s.overlay.pos || 'lower';
  const cy = pos === 'upper' ? H * 0.14 : pos === 'center' ? H * 0.5 : H * 0.86;
  const y0 = cy - (lines.length - 1) * lh / 2;
  ctx.shadowColor = 'rgba(0,0,0,.78)'; ctx.shadowBlur = fs * 0.45; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#fff';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * lh));
  ctx.restore();
}
function sbSetClipFilter(k) { const s = sbShot(sbSelected); if (!s) return; s.filter = k === 'none' ? null : k; sbSave(); sbApplyPreview(s); sbRenderAdjust(); }
function sbSetClipSpeed(sp) { const s = sbShot(sbSelected); if (!s) return; s.speed = sp === 1 ? null : sp; sbSave(); sbApplyPreview(s); sbRender(); }
function sbSetClipVolume(vol) { const s = sbShot(sbSelected); if (!s) return; s.volume = vol; if (vol > 0) s.muted = false; sbSave(); sbApplyPreview(s); }

function sbSelect(id) {
  sbSelected = id;
  sbPlaying = null;
  const s = sbShot(id);
  sbRender();
  // Overlays float on top of the film — selecting one just highlights it; it
  // doesn't take over the main preview.
  if (s && sbIsOverlay(s)) { sbPipSync(document.querySelector('#previewStage video')); return; }
  if (s && sbIsStatic(s)) { sbStopTitle(); sbStopAudioOnly(); sbShowStatic(s); sbUpdatePlayhead(null); sbSyncPlayBtn(); return; }
  sbStopTitle();
  sbStopAudioOnly();
  if (s && s.url) sbCueShot(s); // cue (paused) on select — ▶ starts playback
  else if (s && s.status === 'restoring') sbStudioNote('Restoring your imported clip — one sec…');
  else if (s) sbStudioNote(s.status === 'draft'
    ? 'Shot ' + (sbProject().shots.indexOf(s) + 1) + ' isn’t generated yet — say "generate shot ' + (sbProject().shots.indexOf(s) + 1) + '" and I’ll run it.'
    : 'That shot’s clip is gone (imported clips don’t survive a reload) — re-import the video to bring it back.');
}

function sbPlayAll() {
  const shots = sbProject().shots.filter((s) => sbOnMain(s) && (s.src === 'title' || (s.url && s.status === 'ready')));
  if (!shots.length) { sbStudioNote('Nothing on the timeline yet — add clips to your film first (drag them onto the timeline or tap ＋).'); return; }
  let i = 0;
  const playNext = () => {
    if (i >= shots.length) { sbSegment = null; return; }
    const s = shots[i++];
    if (!s || !sbProject().shots.includes(s)) { playNext(); return; } // removed mid-play → skip
    sbSelected = s.id; sbRender();
    sbPlayShot(s, playNext);
  };
  playNext();
}

// ── Import → scene detection → shots ──────────────────────────────────────
// Sample the video on a small canvas and cut where consecutive frames differ
// sharply. Virtual shots: same blob URL, in/out ranges. All on-device.
async function sbImportFile(f) {
  // One import button for everything. Route by type: an audio file becomes the
  // background music track, a photo becomes a still clip, and a video drops in
  // as one clip. No scene detection, no splitting — the file lands as-is.
  const type = f.type || '';
  if (type.indexOf('audio/') === 0) { await sbSetMusic(f); return; }
  if (type.indexOf('image/') === 0) { await sbImportImage(f); return; }
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

// A still photo becomes a fixed-length clip (default 4s, drag its edge to change
// length up to 30s). It's the image itself, letterboxed — no video decode.
async function sbImportImage(f) {
  const url = URL.createObjectURL(f);
  const proj = sbProject();
  const shot = {
    id: sbUid('s'),
    title: '', prompt: '', status: 'ready',
    src: 'import', kind: 'image',
    onTimeline: false,
    url, in: 0, out: 4, srcDur: 30, dur: 4, // trimmable between 0.3s and 30s
    thumb: url, strip: [url],               // the image is its own poster + filmstrip
    stored: false,
  };
  proj.shots.push(shot);
  sbSave(); sbRender();
  // Persist the file so the photo survives a reload, like an imported clip.
  try { await sbMediaPut(shot.id, f); shot.stored = true; sbSave(); }
  catch (e) { console.warn('could not persist photo (kept for this tab only):', e); }
  sbStudioNote('Photo added — drag it onto the timeline. Trim its edge to change how long it shows.');
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
    // If this was a persisted import, overwrite its stored blob so the trim
    // survives a reload — otherwise rehydrate restores the untrimmed original
    // while the timeline still shows the trimmed length (they'd disagree).
    if (s.src === 'import' && s.stored) sbMediaPut(s.id, blob).catch(() => {});
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
  // Persist the edit for stored imports so a reload restores the edited clip,
  // not the original (which would disagree with the timeline's duration/thumb).
  if (s.src === 'import' && s.stored) sbMediaPut(s.id, blob).catch(() => {});
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
  if (s.out == null && !isFinite(v.duration)) { try { await sbSeek(v, 1e9); } catch (e) {} } // resolve webm Infinity
  const end = s.out != null ? s.out : ((isFinite(v.duration) && v.duration > 0) ? v.duration : (v.currentTime || 0));
  const t = end - 0.08;
  await sbSeek(v, Math.max(0, t));
  return sbGrabFrame(v, 1024).toDataURL('image/jpeg', 0.85);
}

async function sbThumb(s) {
  const v = document.createElement('video');
  v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'metadata';
  v.src = s.url;
  await sbMeta(v);
  // Recorded/streamed webm reports Infinity duration until sought past the end —
  // resolve it so an imported clip never lands on the timeline with infinite
  // length (which would break every width/offset the timeline computes).
  if (!isFinite(v.duration) || v.duration <= 0) {
    try { await sbSeek(v, 1e9); } catch (e) {}
  }
  const realDur = (isFinite(v.duration) && v.duration > 0) ? v.duration : (v.currentTime || 0);
  s.dur = s.dur || realDur;
  s.srcDur = realDur || s.dur || 0;
  if (s.in == null) s.in = 0;
  if (s.out == null) s.out = s.srcDur;
  await sbSeek(v, Math.min(0.1, realDur / 2));
  s.thumb = sbGrabFrame(v, 480).toDataURL('image/jpeg', 0.72);
  // Filmstrip: sample frames at a fixed time density (≈one every 0.5s, like
  // iMovie) so a longer clip gets more frames and every frame is the same
  // on-screen width. Capped so a very long clip doesn't trigger a huge number
  // of seeks / bloat storage.
  try {
    const dur = s.dur || realDur || 0;
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
  return sbOnMain(s) && (s.src === 'title' || (s.url && s.status === 'ready'));
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
  const hasImage = shots.some(sbIsImage);
  const hasVoice = !!(proj0.voice && proj0.voice.url);
  // Per-clip filters/speed/volume are painted by the realtime canvas exporter
  // (ffmpeg stream-copy/xfade doesn't apply them), so any adjusted clip routes
  // there for a correct render.
  const hasAdjust = shots.some(sbClipHasAdjust);
  const hasOverlay = proj0.shots.some(sbIsOverlay);
  try {
    if (!hasTitle && !hasImage && !hasVoice && !hasAdjust && !hasOverlay && window.sbFFExport && window.sbFFSupported && window.sbFFSupported()) {
      try {
        const proj = sbProject();
        const descriptors = shots.map((s) => ({ src: s.url, url: s.url, start: s.in || 0, dur: sbShotDur(s) || 0, muted: !!s.muted }));
        const m0 = proj.music;
        const music = (m0 && m0.url)
          ? { src: m0.url, mime: m0.mime || '', volume: (m0.volume != null ? m0.volume : 0.6) * (m0.duck ? 0.4 : 1),
              offset: m0.offset || 0, in: m0.in || 0, dur: sbAClipDur(m0), fadeIn: m0.fadeIn || 0, fadeOut: m0.fadeOut || 0 }
          : null;
        const r = await window.sbFFExport(descriptors, {
          transition: proj.transition || 'none',
          fade: !!proj.fade,
          music,
          onProgress: (p) => sbStudioProgress('Stitching your film… ' + Math.round(p * 100) + '%'),
        });
        await send(r.blob, 'mp4');
        if (!deliver) {
          const trLabel = (SB_TRANSITIONS.find((t) => t.k === proj.transition) || {}).label;
          const styleNote = (proj.transition && proj.transition !== 'none' && trLabel)
            ? ', ' + trLabel.toLowerCase() + ' transitions' : '';
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
  const first = sbProject().shots.find((s) => sbOnMain(s) && s.thumb);
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
      // The film is sent to /api/save as base64, which inflates it ~33%, and the
      // worker caps a video upload at 40 MB of base64 (~30 MB of blob). Cap the
      // blob just under that so a large film downloads directly instead of paying
      // for an encode + upload the server would only reject.
      if (blob.size > 29_000_000) { sbStudioNote('This film is a bit large to save to the gallery — downloading it instead.'); sbDownloadBlob(blob, ext); return; }
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
    // Film-render clock: seconds of FINISHED FILM painted so far, updated by
    // sbExportShot as each frame draws. Audio is driven from THIS, not wall-clock
    // time — so a shot that stalls on load/seek can't let the music run ahead and
    // end early (the old approach pre-scheduled audio on the AudioContext clock).
    const clock = { film: 0 };
    // Each audio track = element + gain, repositioned every frame to match the
    // film clock (honoring offset, trim in/out, fades, volume, duck).
    const tracks = [];
    function tapAudio(tr, kind) {
      if (!tr || !tr.url) return;
      try {
        sbAudioInit(tr);
        const el = new Audio(); el.src = tr.url; el.crossOrigin = 'anonymous'; el.preload = 'auto';
        const node = ac.createMediaElementSource(el);
        const g = ac.createGain(); g.gain.value = 0.0001;
        node.connect(g).connect(dest);
        const base = (tr.volume != null ? tr.volume : (kind === 'music' ? 0.6 : 1)) * (kind === 'music' && tr.duck ? 0.4 : 1);
        el.currentTime = tr.in || 0;
        tracks.push({ el, g, base, offset: tr.offset || 0, tin: tr.in || 0, clipDur: sbAClipDur(tr), fadeIn: tr.fadeIn || 0, fadeOut: tr.fadeOut || 0 });
      } catch (e) { console.warn(kind + ' tap failed (exporting without it):', e); }
    }
    tapAudio(sbProject().music, 'music');
    tapAudio(sbProject().voice, 'voice');
    // Picture-in-picture overlays: build a media element for each and keep it
    // decoded so sbExportShot can composite it per frame. Video overlays are
    // driven off the film clock (like audio); images just get drawn.
    const overlays = sbProject().shots.filter((s) => sbIsOverlay(s) && (s.url || sbIsImage(s))).map((o) => {
      sbOverlayInit(o);
      const isImg = sbIsImage(o);
      const el = document.createElement(isImg ? 'img' : 'video');
      if (!isImg) { el.muted = true; el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.playsInline = true; }
      el.src = o.url;
      return { o, el, isImg, start: o.start || 0, dur: sbShotDur(o) || 4, inT: o.in || 0 };
    });
    // Give the overlay media a beat to load its first frame before the render.
    await Promise.all(overlays.map((ov) => new Promise((res) => {
      if (ov.isImg) { if (ov.el.complete) return res(); ov.el.onload = res; ov.el.onerror = res; }
      else { if (ov.el.readyState >= 1) return res(); ov.el.onloadedmetadata = res; ov.el.onerror = res; }
      setTimeout(res, 4000);
    })));
    // Lock each track to the film clock: play only while the picture advances,
    // pause during load/seek stalls, resync position on real drift, ramp fades.
    let audioRAF = 0, lastFilm = -1, lastAdvance = performance.now();
    function syncAudio() {
      const now = performance.now();
      const fc = clock.film;
      if (fc > lastFilm + 1e-4) { lastFilm = fc; lastAdvance = now; }
      const stalled = (now - lastAdvance) > 90; // film not progressing → hold audio
      for (const t of tracks) {
        const local = fc - t.offset;
        if (local < 0 || local >= t.clipDur) { if (!t.el.paused) { try { t.el.pause(); } catch (e) {} } t.g.gain.value = 0.0001; continue; }
        if (stalled) { if (!t.el.paused) { try { t.el.pause(); } catch (e) {} } }
        else {
          if (t.el.paused) { try { t.el.play().catch(() => {}); } catch (e) {} }
          const want = t.tin + local;
          if (Math.abs((t.el.currentTime || 0) - want) > 0.18) { try { t.el.currentTime = want; } catch (e) {} }
        }
        let gain = t.base;
        if (t.fadeIn > 0 && local < t.fadeIn) gain = t.base * (local / t.fadeIn);
        if (t.fadeOut > 0 && local > t.clipDur - t.fadeOut) gain = Math.min(gain, t.base * (t.clipDur - local) / t.fadeOut);
        t.g.gain.value = Math.max(0.0001, gain);
      }
      // Keep each video overlay decoding at the right source time (muted).
      for (const ov of overlays) {
        if (ov.isImg) continue;
        const local = fc - ov.start;
        if (local < 0 || local >= ov.dur) { if (!ov.el.paused) { try { ov.el.pause(); } catch (e) {} } continue; }
        if (stalled) { if (!ov.el.paused) { try { ov.el.pause(); } catch (e) {} } }
        else {
          if (ov.el.paused) { try { ov.el.play().catch(() => {}); } catch (e) {} }
          const want = ov.inT + local;
          if (Math.abs((ov.el.currentTime || 0) - want) > 0.2) { try { ov.el.currentTime = want; } catch (e) {} }
        }
      }
      audioRAF = requestAnimationFrame(syncAudio);
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
    if (tracks.length || overlays.length) syncAudio(); // drive audio + overlays off the film clock

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
          isFirst: i === 0, isLast: i === shots.length - 1, prevFrame, clock, overlays,
        });
        ok++;
      } catch (e) { console.warn('shot ' + (i + 1) + ' skipped:', e); skipped++; prevFrame = null; }
      filmStart += sdur;
    }
    rec.stop();
    await done;
    cancelAnimationFrame(audioRAF);
    tracks.forEach((t) => { try { t.el.pause(); } catch (e) {} });
    overlays.forEach((ov) => { try { if (ov.el.pause) ov.el.pause(); } catch (e) {} });
    ac.close().catch(() => {});
    if (!ok) { sbStudioNote('Export failed — none of the shots could be read (they may still be uploading, or blocked by the browser).'); return; }
    // Match the file to what the recorder actually produced (webm on Chrome,
    // mp4 on Safari) so the download opens cleanly.
    const outType = ((rec.mimeType || mime || 'video/webm').split(';')[0]) || 'video/webm';
    let outBlob = new Blob(parts, { type: outType });
    // MediaRecorder writes no top-level duration, so players show Infinity / no
    // seek bar until the file fully buffers. Repair it with a fast stream-copy
    // remux (no re-encode) when the on-device editor is available.
    if (outType.indexOf('webm') >= 0 && window.sbFFRemux) {
      try { sbStudioProgress('Finalizing the film…'); outBlob = await window.sbFFRemux(outBlob); } catch (e) {}
    }
    const ext = outType.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    await send(outBlob, ext);
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
  // Wipe: the previous clip's frozen frame is pushed off to the right, revealing
  // this clip from the left over our first T.
  if (o.transition === 'wipe' && !o.isFirst && o.prevFrame && st < T) {
    const p = Math.max(0, Math.min(1, st / T));
    ctx.save();
    ctx.beginPath();
    ctx.rect(p * W, 0, W - p * W, H);
    ctx.clip();
    ctx.drawImage(o.prevFrame, 0, 0, W, H);
    ctx.restore();
  }
  let black = 0, white = 0;
  if (o.fade && o.filmTotal) {
    if (ft < FF) black = Math.max(black, 1 - ft / FF);
    if (ft > o.filmTotal - FF) black = Math.max(black, (ft - (o.filmTotal - FF)) / FF);
  }
  if (o.transition === 'dip' || o.transition === 'dipwhite') {
    const t2 = T / 2;
    let amt = 0;
    if (!o.isFirst && st < t2) amt = Math.max(amt, 1 - st / t2);
    if (!o.isLast && st > dur - t2) amt = Math.max(amt, (st - (dur - t2)) / t2);
    if (o.transition === 'dipwhite') white = Math.max(white, amt); else black = Math.max(black, amt);
  }
  black = Math.max(0, Math.min(1, black));
  white = Math.max(0, Math.min(1, white));
  if (black > 0) { ctx.globalAlpha = black; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (white > 0) { ctx.globalAlpha = white; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// Composite any active picture-in-picture overlays onto the export frame.
function sbDrawExportOverlays(o, within) {
  if (!o.overlays || !o.overlays.length) return;
  const { ctx, W, H } = o;
  const ft = o.filmStart + Math.max(0, within);
  for (const ov of o.overlays) {
    if (ft < ov.start - 0.02 || ft >= ov.start + ov.dur + 0.02) continue;
    const el = ov.el;
    const mw = ov.isImg ? el.naturalWidth : el.videoWidth;
    const mh = ov.isImg ? el.naturalHeight : el.videoHeight;
    if (!mw || !mh) continue;
    const scale = ov.o.pipScale || 0.34;
    const pw = W * scale, ph = pw * (mh / mw);
    const mgx = W * 0.045, mgy = H * 0.045;
    const pip = ov.o.pip || 'br';
    let x = W - pw - mgx, y = H - ph - mgy; // br default
    if (pip === 'tl') { x = mgx; y = mgy; }
    else if (pip === 'tr') { x = W - pw - mgx; y = mgy; }
    else if (pip === 'bl') { x = mgx; y = H - ph - mgy; }
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, pw + 4, ph + 4);
    try { ctx.drawImage(el, x, y, pw, ph); } catch (e) {}
    ctx.lineWidth = Math.max(2, W * 0.0035);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.strokeRect(x, y, pw, ph);
    ctx.restore();
  }
}
// Play one clip onto the shared export canvas; resolves with its last frame.
function sbExportShot(s, o) {
  const { ctx, W, H, ac, dest } = o;
  const shotDur = sbShotDur(s) || (s.src === 'title' ? 3 : 4);
  if (o.clock) o.clock.film = o.filmStart; // hold the audio clock at this shot's start until it renders
  // Static clips have no video: a title/background card is painted, a still
  // photo is drawn (letterboxed). Either way we hold the frame for the clip length.
  if (sbIsStatic(s)) {
    return new Promise((resolve) => {
      const durMs = shotDur * 1000;
      let img = null;
      const filt = sbFilterStr(s);
      const paint = () => {
        if (img && img.naturalWidth) {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
          if (filt !== 'none') ctx.filter = filt;
          const ir = img.naturalWidth / img.naturalHeight, fr = W / H;
          let dw = W, dh = H, dx = 0, dy = 0;
          if (ir > fr) { dh = W / ir; dy = (H - dh) / 2; } else { dw = H * ir; dx = (W - dw) / 2; }
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.filter = 'none';
          try { sbPaintCaption(ctx, W, H, s); } catch (e) {}
        } else {
          sbPaintTitle(ctx, W, H, s);
        }
      };
      const run = () => {
        const t0 = performance.now();
        const draw = () => {
          const within = (performance.now() - t0) / 1000;
          if (o.clock) o.clock.film = o.filmStart + Math.min(shotDur, within);
          paint();
          try { sbDrawExportOverlays(o, within); } catch (e) {}
          try { sbFrameOverlays(ctx, W, H, o, within, shotDur); } catch (e) {}
          if (performance.now() - t0 >= durMs) { resolve(sbSnapshot(ctx, W, H)); return; }
          requestAnimationFrame(draw);
        };
        draw();
      };
      if (sbIsImage(s) && s.url) {
        img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = run; img.onerror = () => { img = null; run(); };
        img.src = s.url;
      } else { run(); }
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
    const sp = s.speed && s.speed > 0 ? s.speed : 1;
    v.onloadedmetadata = () => {
      // Route audio through a gain node for the per-clip volume (muted → 0).
      try { node = ac.createMediaElementSource(v); const g = ac.createGain(); g.gain.value = sbClipVol(s); node.connect(g).connect(dest); } catch {}
      v.playbackRate = sp;
      v.currentTime = start;
      v.play().then(() => {
        const filt = sbFilterStr(s);
        const playRange = (isFinite(stopAt) ? stopAt : (v.duration || start + shotDur * sp)) - start;
        const draw = () => {
          if (o.clock) o.clock.film = o.filmStart + Math.max(0, (v.currentTime - start) / sp);
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
          if (filt !== 'none') ctx.filter = filt;
          if (sbHasMotion(s) && v.videoWidth) {
            // crop-to-fill / Ken Burns: draw an animated source window over the frame
            const p = playRange > 0 ? Math.max(0, Math.min(1, (v.currentTime - start) / playRange)) : 0;
            const r = sbSourceRect(s, v.videoWidth, v.videoHeight, p, W, H);
            ctx.drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
          } else {
            // letterbox into the export frame
            const vr = v.videoWidth / v.videoHeight, fr = W / H;
            let dw = W, dh = H, dx = 0, dy = 0;
            if (vr > fr) { dh = W / vr; dy = (H - dh) / 2; } else { dw = H * vr; dx = (W - dw) / 2; }
            ctx.drawImage(v, dx, dy, dw, dh);
          }
          ctx.filter = 'none';
          try { sbPaintCaption(ctx, W, H, s); } catch (e) {}
          try { sbDrawExportOverlays(o, (v.currentTime - start) / sp); } catch (e) {}
          try { sbFrameOverlays(ctx, W, H, o, (v.currentTime - start) / sp, shotDur); } catch (e) {}
          if (v.currentTime >= stopAt - 0.03 || v.ended) { finish(resolve, sbSnapshot(ctx, W, H)); return; }
          raf = requestAnimationFrame(draw);
        };
        draw();
      }).catch((e) => finish(reject, e));
    };
  });
}

// ── isibi.ai chat panel ──────────────────────────────────────────────────────
// The chat thread is ONLY for the actual conversation (what you type + the
// director's replies). Incidental hints from clicking around (import, save,
// split, export progress…) show as transient toasts instead, so the thread
// stays clean and only fills up when you talk to it.
let sbProgressEl = null;      // updating "agent" bubble in the chat thread
let sbProgToast = null;       // updating progress toast (export/stitch/save %)

function sbToastBox() {
  let b = document.getElementById('sbToasts');
  if (!b) { b = document.createElement('div'); b.id = 'sbToasts'; document.body.appendChild(b); }
  return b;
}
// A transient hint (auto-dismisses). This is what the old sbStudioNote calls
// scattered through the click handlers now do.
function sbStudioNote(text) {
  if (sbProgToast) { try { sbProgToast.remove(); } catch (e) {} sbProgToast = null; }
  const box = sbToastBox();
  const last = box.lastElementChild;
  if (last && !last.classList.contains('prog') && last.dataset.txt === text) return; // no dupes
  const t = document.createElement('div');
  t.className = 'sb-toast'; t.dataset.txt = text; t.textContent = text;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 320); }, 4000);
  while (box.children.length > 4) box.firstChild.remove();
}
// A sticky, self-updating progress toast (export/stitch/save). Each call resets
// its auto-hide, so it stays put while work is streaming updates.
function sbStudioProgress(text) {
  const box = sbToastBox();
  if (!sbProgToast || !sbProgToast.isConnected) {
    sbProgToast = document.createElement('div');
    sbProgToast.className = 'sb-toast prog';
    box.appendChild(sbProgToast);
    requestAnimationFrame(() => sbProgToast && sbProgToast.classList.add('in'));
  }
  sbProgToast.textContent = text;
  clearTimeout(sbProgToast._t);
  sbProgToast._t = setTimeout(() => {
    if (!sbProgToast) return;
    const el = sbProgToast; sbProgToast = null;
    el.classList.remove('in'); setTimeout(() => el.remove(), 320);
  }, 8000);
}
// The conversation itself lives in the chat thread. sbChatSay = the director's
// reply, sbChatProgress = the "thinking…" bubble it replaces.
function sbChatSay(text) {
  sbProgressEl = null;
  const box = document.getElementById('studioMessages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'msg agent';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function sbChatProgress(text) {
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
  sbChatProgress('isibi.ai is thinking…');
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
      sbChatSay('The Video Editor add-on ($19.99/mo) powers this chat editor. Add it to direct your edits by chat — the editing tools themselves stay free.');
      if (typeof window.openVideoEditorUpsell === 'function') window.openVideoEditorUpsell();
      return;
    }
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.reply) sbChatSay(data.reply);
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
          proj.transition = SB_TRANSITION_KEYS.indexOf(t) >= 0 ? t : 'none';
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
    sbChatSay('I couldn’t reach the director — try that again in a moment.');
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
    // Frame-exact stepping: , / . nudge the playhead one frame (1/30s) at a time.
    else if (e.key === ',' || e.key === '.') { e.preventDefault(); if (v) { const d = (e.key === '.' ? 1 : -1) / 30; v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + d)); } }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (sbSelected) { e.preventDefault(); sbRemoveShot(sbSelected); } }
  });
  sbLoad();
  sbRender();
  sbMusicLoad();          // point the audio element at this project's track
  sbVoiceLoad();
  sbRehydrateImports();   // bring persisted imported clips (and music/voice) back after a reload
}
initStudio();
