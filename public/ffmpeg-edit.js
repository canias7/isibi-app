// ── isibi.ai Studio: on-device video editing (ffmpeg.wasm) ───────────────────
// Free, private, in-browser video edits — nothing leaves the tab, no credits.
// ffmpeg is self-hosted under /vendor/ffmpeg (script-src 'self') and the 32 MB
// core wasm ships gzipped (9.75 MB, under Cloudflare's 25 MiB asset cap) and is
// decompressed in the browser via DecompressionStream → a blob URL.
//
// Lazy: nothing downloads until the first edit. A single FFmpeg instance is
// reused; ops are serialized (the wasm core is not reentrant). Every entry
// point degrades gracefully — if the editor can't load (old browser, wasm
// blocked), the caller falls back to its previous behaviour.

let _ffInstance = null;     // loaded FFmpeg, once ready
let _ffLoading = null;      // in-flight load promise (dedupe concurrent callers)
let _ffChain = Promise.resolve(); // serializes exec() calls across the app

// True where the pipeline can run at all: needs the FFmpeg global (self-hosted
// script loaded) and DecompressionStream (gunzip the core). Old Safari (<16.4)
// lacks 'wasm-unsafe-eval' support and will simply fail load → caller falls back.
function sbFFSupported() {
  return typeof window.DecompressionStream === 'function';
}

// Inject the self-hosted ffmpeg.js (exposes window.FFmpegWASM). Resolves once.
function sbFFLoadScript() {
  return new Promise((ok, err) => {
    if (window.FFmpegWASM) return ok();
    const s = document.createElement('script');
    s.src = '/vendor/ffmpeg/ffmpeg.js';
    s.onload = () => ok();
    s.onerror = () => err(new Error('could not load the editor'));
    document.head.appendChild(s);
  });
}

// Gunzip the self-hosted core wasm → an application/wasm blob URL.
async function sbFFWasmURL() {
  const resp = await fetch('/vendor/ffmpeg/ffmpeg-core.wasm.gz');
  if (!resp.ok || !resp.body) throw new Error('editor core unavailable');
  const stream = resp.body.pipeThrough(new DecompressionStream('gzip'));
  const blob = await new Response(stream).blob();
  return URL.createObjectURL(new Blob([blob], { type: 'application/wasm' }));
}

// Load ffmpeg once. `onNote` gets brief human status strings for the chat.
async function sbFFLoad(onNote) {
  if (_ffInstance) return _ffInstance;
  if (_ffLoading) return _ffLoading;
  if (!sbFFSupported()) throw new Error('this browser can’t run the on-device editor');
  _ffLoading = (async () => {
    if (onNote) onNote('Loading the on-device editor (one-time ~10 MB)…');
    await sbFFLoadScript();
    const { FFmpeg } = window.FFmpegWASM;
    const wasmURL = await sbFFWasmURL();
    const ff = new FFmpeg();
    // Surface real ffmpeg progress (0–1) during long ops.
    ff.on('progress', ({ progress }) => {
      if (_ffOnProgress && progress >= 0 && progress <= 1) _ffOnProgress(progress);
    });
    // No classWorkerURL: it auto-resolves 814.ffmpeg.js from /vendor/ffmpeg.
    await ff.load({ coreURL: '/vendor/ffmpeg/ffmpeg-core.js', wasmURL });
    _ffInstance = ff;
    return ff;
  })();
  try { return await _ffLoading; }
  finally { _ffLoading = null; }
}

let _ffOnProgress = null;

// Serialize an ffmpeg job. `job(ff)` runs with the single instance; concurrent
// callers queue. `onProgress(0..1)` fires during exec.
function sbFFJob(job, onProgress) {
  const run = async () => {
    const ff = await sbFFLoad(sbFFNote);
    _ffOnProgress = onProgress || null;
    try { return await job(ff); }
    catch (e) {
      // A wasm-level failure (an abort, or the MEMFS wedging after a long run of
      // heavy ops) can leave the core unusable. Drop it so the NEXT job reloads a
      // fresh instance instead of erroring forever. The gz is HTTP-cached, so the
      // reload is fast (decompress + instantiate, no re-download).
      try { ff.terminate(); } catch (e2) {}
      _ffInstance = null; _ffLoading = null;
      throw e;
    }
    finally { _ffOnProgress = null; }
  };
  // chain regardless of prior success/failure so one bad op can't wedge the queue
  const next = _ffChain.then(run, run);
  _ffChain = next.catch(() => {});
  return next;
}

// Route status text to the Studio chat if those helpers exist (they live in
// studio.js). Kept defensive so this file is usable in isolation/tests.
function sbFFNote(msg) {
  if (typeof sbStudioProgress === 'function') sbStudioProgress(msg);
}

// url/blob/File → Uint8Array (inline replacement for @ffmpeg/util fetchFile,
// whose UMD build calls require() and breaks in-browser).
async function sbFFBytes(src) {
  if (src instanceof Uint8Array) return src;
  const buf = await (await fetch(typeof src === 'string' ? src : URL.createObjectURL(src))).arrayBuffer();
  return new Uint8Array(buf);
}

// Pick an input filename extension ffmpeg's demuxers are happy with.
function sbFFExt(url, mime) {
  const u = (url || '').toLowerCase();
  if (/\.webm(\?|$)/.test(u) || /webm/.test(mime || '')) return 'webm';
  if (/\.mov(\?|$)/.test(u) || /quicktime/.test(mime || '')) return 'mov';
  if (/\.mkv(\?|$)/.test(u) || /matroska/.test(mime || '')) return 'mkv';
  return 'mp4';
}

// Shared H.264 video encode args (universally playable, even dims for yuv420p).
const SB_VENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'];
const SB_AENC = ['-c:a', 'aac', '-b:a', '128k'];
const SB_FAST = ['-movflags', '+faststart', 'out.mp4'];

// ff.exec() resolves to an exit code (it does NOT throw on failure), and a shot
// may or may not carry an audio stream. So: run `args`, then read out.mp4 — if
// it's missing/empty, return null so the caller can try an audio-free variant.
async function sbFFRunRead(ff, args) {
  try { await ff.deleteFile('out.mp4'); } catch (e) {}
  await ff.exec(args);
  try { const d = await ff.readFile('out.mp4'); return d && d.length ? d : null; }
  catch (e) { return null; }
}

// An optional source window from opts.start/opts.dur (an imported shot's slice):
// `-ss start` before -i (fast+accurate seek) and `-t dur` after (limit length).
function sbFFWindow(opts) {
  const pre = [], post = [];
  if (opts && opts.start > 0) pre.push('-ss', String(opts.start));
  if (opts && opts.dur > 0) post.push('-t', String(opts.dur));
  return { pre, post };
}

// atempo only accepts 0.5–2.0 per instance; chain to reach any target tempo.
function sbFFAtempo(speed) {
  let s = speed; const parts = [];
  while (s > 2.0 + 1e-6) { parts.push('atempo=2.0'); s /= 2; }
  while (s < 0.5 - 1e-6) { parts.push('atempo=0.5'); s *= 2; }
  parts.push('atempo=' + s.toFixed(6));
  return parts.join(',');
}

// ── Trim ─────────────────────────────────────────────────────────────────────
// Cut [startSec, startSec+durSec] out of `src` and re-encode to a clean MP4
// (H.264 + AAC): frame-accurate, universally playable. Returns a Blob.
// `-ss` before `-i` with re-encoding is both fast (keyframe seek) and accurate
// (decodes to the exact start) in ffmpeg 5.x.
async function sbFFTrim(src, startSec, durSec, opts = {}) {
  const inName = 'in.' + sbFFExt(opts.url || (typeof src === 'string' ? src : ''), opts.mime);
  const bytes = await sbFFBytes(src);
  return sbFFJob(async (ff) => {
    await ff.writeFile(inName, bytes);
    const seek = ['-ss', String(Math.max(0, startSec)), '-i', inName];
    const dur = (durSec != null && durSec > 0) ? ['-t', String(durSec)] : [];
    let data = await sbFFRunRead(ff, [...seek, ...dur, ...SB_VENC, ...SB_AENC, ...SB_FAST]);
    if (!data) data = await sbFFRunRead(ff, [...seek, ...dur, '-an', ...SB_VENC, ...SB_FAST]);
    try { await ff.deleteFile(inName); await ff.deleteFile('out.mp4'); } catch (e) {}
    if (!data) throw new Error('trim produced no output');
    return new Blob([data.buffer], { type: 'video/mp4' });
  }, opts.onProgress);
}

// ── Speed ─────────────────────────────────────────────────────────────────────
// Retime to `speed`× (2 = twice as fast, 0.5 = slow motion). Video via setpts,
// audio via a chained atempo. New duration = old / speed.
async function sbFFSpeed(src, speed, opts = {}) {
  const s = Math.max(0.25, Math.min(4, Number(speed) || 1));
  const inName = 'in.' + sbFFExt(opts.url || (typeof src === 'string' ? src : ''), opts.mime);
  const bytes = await sbFFBytes(src);
  return sbFFJob(async (ff) => {
    await ff.writeFile(inName, bytes);
    const pts = (1 / s).toFixed(6);
    // Optional source window (an imported slice): seek+limit before -i so the op
    // acts on just that shot's range, not the whole underlying file.
    const win = sbFFWindow(opts);
    const pre = [...win.pre, '-i', inName, ...win.post];
    // fps=30 forces constant frame rate: without it, retiming a variable-frame-
    // rate source (e.g. a browser-recorded clip) explodes into thousands of
    // duplicated frames and an unplayable file.
    const vf = 'setpts=' + pts + '*PTS,fps=30';
    const withAudio = [...pre, '-filter_complex',
      '[0:v]' + vf + '[v];[0:a]' + sbFFAtempo(s) + '[a]',
      '-map', '[v]', '-map', '[a]', ...SB_VENC, ...SB_AENC, ...SB_FAST];
    const videoOnly = [...pre, '-filter:v', vf, '-an', ...SB_VENC, ...SB_FAST];
    let data = await sbFFRunRead(ff, withAudio);
    if (!data) data = await sbFFRunRead(ff, videoOnly);
    try { await ff.deleteFile(inName); await ff.deleteFile('out.mp4'); } catch (e) {}
    if (!data) throw new Error('speed change produced no output');
    return new Blob([data.buffer], { type: 'video/mp4' });
  }, opts.onProgress);
}

// ── Reframe ───────────────────────────────────────────────────────────────────
// Re-crop to a target aspect ratio (centered, no upscale) — e.g. 16:9 → 9:16 for
// vertical TikTok/Reels. Duration unchanged; dimensions become the new aspect.
async function sbFFReframe(src, aspect, opts = {}) {
  const m = String(aspect).split(':').map(Number);
  const ar = (m[0] && m[1]) ? m[0] / m[1] : 9 / 16;
  const inName = 'in.' + sbFFExt(opts.url || (typeof src === 'string' ? src : ''), opts.mime);
  const bytes = await sbFFBytes(src);
  return sbFFJob(async (ff) => {
    await ff.writeFile(inName, bytes);
    const win = sbFFWindow(opts);
    const pre = [...win.pre, '-i', inName, ...win.post];
    // Even crop dims (yuv420p needs them); commas inside min() escaped for the graph.
    const cw = '2*floor(min(iw\\,ih*' + ar.toFixed(6) + ')/2)';
    const ch = '2*floor(min(ih\\,iw/' + ar.toFixed(6) + ')/2)';
    // fps=30 forces constant frame rate so a variable-frame-rate import (e.g. a
    // screen recording) can't balloon into thousands of duplicated frames.
    const vf = 'crop=' + cw + ':' + ch + ',fps=30';
    let data = await sbFFRunRead(ff, [...pre, '-vf', vf, ...SB_VENC, ...SB_AENC, ...SB_FAST]);
    if (!data) data = await sbFFRunRead(ff, [...pre, '-vf', vf, '-an', ...SB_VENC, ...SB_FAST]);
    try { await ff.deleteFile(inName); await ff.deleteFile('out.mp4'); } catch (e) {}
    if (!data) throw new Error('reframe produced no output');
    return new Blob([data.buffer], { type: 'video/mp4' });
  }, opts.onProgress);
}

// ── Text / caption ────────────────────────────────────────────────────────────
// Burn a caption onto a shot with drawtext — white Space Grotesk (the brand
// font, self-hosted) on a subtle box, centered horizontally, at bottom / top /
// center. textfile= sidesteps filtergraph escaping of the user's text.
let _sbFont = null;
async function sbFFFont() {
  if (_sbFont) return _sbFont;
  const r = await fetch('/vendor/ffmpeg/SpaceGrotesk.ttf');
  if (!r.ok) throw new Error('caption font unavailable');
  _sbFont = new Uint8Array(await r.arrayBuffer());
  return _sbFont;
}
async function sbFFText(src, text, opts = {}) {
  const content = String(text || '').slice(0, 200);
  if (!content.trim()) throw new Error('no caption text');
  const inName = 'in.' + sbFFExt(opts.url || (typeof src === 'string' ? src : ''), opts.mime);
  const bytes = await sbFFBytes(src);
  const font = await sbFFFont();
  return sbFFJob(async (ff) => {
    await ff.writeFile(inName, bytes);
    await ff.writeFile('cap_font.ttf', font);
    await ff.writeFile('cap.txt', new TextEncoder().encode(content));
    const y = opts.position === 'top' ? 'h*0.08'
      : opts.position === 'center' ? '(h-text_h)/2'
      : 'h-h*0.16-text_h';
    const draw = 'drawtext=fontfile=cap_font.ttf:textfile=cap.txt:fontcolor=white:fontsize=h/14:' +
      'box=1:boxcolor=black@0.45:boxborderw=16:borderw=2:bordercolor=black@0.8:' +
      'x=(w-text_w)/2:y=' + y + ',fps=30';
    const win = sbFFWindow(opts);
    const pre = [...win.pre, '-i', inName, ...win.post];
    let data = await sbFFRunRead(ff, [...pre, '-vf', draw, ...SB_VENC, ...SB_AENC, ...SB_FAST]);
    if (!data) data = await sbFFRunRead(ff, [...pre, '-vf', draw, '-an', ...SB_VENC, ...SB_FAST]);
    try { await ff.deleteFile(inName); await ff.deleteFile('out.mp4'); await ff.deleteFile('cap.txt'); } catch (e) {}
    if (!data) throw new Error('caption produced no output');
    return new Blob([data.buffer], { type: 'video/mp4' });
  }, opts.onProgress);
}

// Read a media file's duration, video dimensions and audio presence straight
// from ffmpeg's own report (decoder-independent). `logbuf` is a live array the
// caller fills from an ff 'log' listener.
async function sbFFProbe(ff, name, logbuf) {
  logbuf.length = 0;
  await ff.exec(['-i', name]); // no output → prints stream info, exits nonzero
  const text = logbuf.join('\n');
  const dm = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  const sm = text.match(/Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  return {
    dur: dm ? (+dm[1] * 3600 + +dm[2] * 60 + +dm[3]) : null,
    w: sm ? +sm[1] : null, h: sm ? +sm[2] : null,
    hasAudio: /Audio:/.test(text),
  };
}

// ── Export: stitch shots into one MP4 ─────────────────────────────────────────
// Each shot is normalized to a shared frame (scale+pad to WxH, fps=30, setsar=1,
// H.264 + AAC — silent track synthesized when a shot has none) so the segments
// share an identical stream layout, then concatenated with the demuxer (-c copy,
// no second re-encode). Orientation follows the majority of shots (portrait →
// 720x1280, else 1280x720). A shot that fails to normalize is skipped, not fatal.
// `shots`: [{ src, url, start, dur }]. Returns an MP4 Blob.
async function sbFFExport(shots, opts = {}) {
  return sbFFJob(async (ff) => {
    const logbuf = [];
    const onLog = ({ message }) => { logbuf.push(message); if (logbuf.length > 300) logbuf.shift(); };
    ff.on('log', onLog);
    const tmp = [];
    const track = (n) => { tmp.push(n); return n; };
    try {
      // 1. Write + probe every shot.
      const metas = [];
      for (let i = 0; i < shots.length; i++) {
        const sh = shots[i];
        const inName = track('x' + i + '.' + sbFFExt(sh.url || '', sh.mime));
        await ff.writeFile(inName, await sbFFBytes(sh.src));
        let info; try { info = await sbFFProbe(ff, inName, logbuf); } catch (e) { info = {}; }
        metas.push({ inName, info, sh });
      }
      // 2. Target orientation: portrait only if most shots are portrait.
      const known = metas.filter((m) => m.info.w && m.info.h);
      const portraitVotes = known.filter((m) => m.info.h > m.info.w).length;
      const portrait = known.length ? portraitVotes * 2 > known.length : false;
      const W = opts.w || (portrait ? 720 : 1280);
      const H = opts.h || (portrait ? 1280 : 720);
      const vf = 'scale=' + W + ':' + H + ':force_original_aspect_ratio=decrease,' +
        'pad=' + W + ':' + H + ':(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30';
      const anull = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];

      // 3. Normalize each shot to a uniform segment.
      const segs = [];
      for (let i = 0; i < metas.length; i++) {
        if (opts.onProgress) opts.onProgress(i / (metas.length + 1));
        const { inName, info, sh } = metas[i];
        const win = sbFFWindow(sh);
        const seg = 'seg' + i + '.mp4';
        const args = info.hasAudio
          ? [...win.pre, '-i', inName, ...win.post, '-map', '0:v:0', '-map', '0:a:0',
             '-vf', vf, ...SB_VENC, ...SB_AENC, '-movflags', '+faststart', seg]
          : [...win.pre, '-i', inName, ...win.post, ...anull, '-map', '0:v:0', '-map', '1:a:0',
             '-vf', vf, ...SB_VENC, ...SB_AENC, '-shortest', '-movflags', '+faststart', seg];
        try { await ff.deleteFile(seg); } catch (e) {}
        await ff.exec(args);
        let good = false; try { const d = await ff.readFile(seg); good = d && d.length > 0; } catch (e) {}
        if (good) { segs.push(seg); track(seg); }
      }
      if (!segs.length) throw new Error('no shots could be prepared for export');

      // 4. Join the segments. Default: concat demuxer (stream copy — fast,
      //    lossless). With transitions or edge fades: an xfade/acrossfade
      //    filtergraph (a real re-encode of the joins).
      const useXfade = (opts.transition === 'crossfade' || opts.transition === 'dip') && segs.length >= 2;
      const useFade = !!opts.fade;
      try { await ff.deleteFile('out.mp4'); } catch (e) {}
      if (!useXfade && !useFade) {
        const list = track('concat.txt');
        await ff.writeFile(list, new TextEncoder().encode(segs.map((s) => "file '" + s + "'").join('\n') + '\n'));
        await ff.exec(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', 'out.mp4']);
      } else {
        // Actual per-segment durations drive the crossfade offsets.
        const durs = [];
        for (const s of segs) { let inf; try { inf = await sbFFProbe(ff, s, logbuf); } catch (e) { inf = {}; } durs.push(inf.dur || 0); }
        const minDur = Math.min.apply(null, durs.filter((d) => d > 0).concat([999]));
        const T = useXfade ? Math.max(0.1, Math.min(Number(opts.transitionDur) || 0.6, minDur * 0.5)) : 0;
        const xt = opts.transition === 'dip' ? 'fadeblack' : 'fade';
        const inputs = [];
        for (const s of segs) inputs.push('-i', s);
        const fc = [];
        let vlab = '[0:v]', alab = '[0:a]', total = durs[0] || 0;
        if (useXfade) {
          for (let k = 1; k < segs.length; k++) {
            const off = Math.max(0, total - T).toFixed(3);
            fc.push(vlab + '[' + k + ':v]xfade=transition=' + xt + ':duration=' + T + ':offset=' + off + '[vx' + k + ']');
            fc.push(alab + '[' + k + ':a]acrossfade=d=' + T + '[ax' + k + ']');
            vlab = '[vx' + k + ']'; alab = '[ax' + k + ']';
            total = total + (durs[k] || 0) - T;
          }
        } else {
          const parts = [];
          for (let k = 0; k < segs.length; k++) parts.push('[' + k + ':v][' + k + ':a]');
          fc.push(parts.join('') + 'concat=n=' + segs.length + ':v=1:a=1[vc][ac]');
          vlab = '[vc]'; alab = '[ac]';
          total = durs.reduce((a, b) => a + (b || 0), 0);
        }
        if (useFade) {
          const fd = Math.max(0.15, Math.min(0.8, (total || 1) * 0.15));
          const outAt = Math.max(0, total - fd).toFixed(3);
          fc.push(vlab + 'fade=t=in:st=0:d=' + fd + ',fade=t=out:st=' + outAt + ':d=' + fd + '[vout]');
          fc.push(alab + 'afade=t=in:st=0:d=' + fd + ',afade=t=out:st=' + outAt + ':d=' + fd + '[aout]');
          vlab = '[vout]'; alab = '[aout]';
        }
        await ff.exec([...inputs, '-filter_complex', fc.join(';'), '-map', vlab, '-map', alab,
          ...SB_VENC, ...SB_AENC, '-movflags', '+faststart', 'out.mp4']);
      }
      let data; try { data = await ff.readFile('out.mp4'); } catch (e) { data = null; }
      if (!data || !data.length) throw new Error('export produced no output');
      if (opts.onProgress) opts.onProgress(1);
      return { blob: new Blob([data.buffer], { type: 'video/mp4' }), used: segs.length, total: shots.length, w: W, h: H };
    } finally {
      ff.off('log', onLog);
      for (const n of tmp) { try { await ff.deleteFile(n); } catch (e) {} }
      try { await ff.deleteFile('out.mp4'); } catch (e) {}
    }
  }, opts.onProgress);
}

// expose for studio.js + tests
window.sbFFTrim = sbFFTrim;
window.sbFFSpeed = sbFFSpeed;
window.sbFFReframe = sbFFReframe;
window.sbFFText = sbFFText;
window.sbFFExport = sbFFExport;
window.sbFFSupported = sbFFSupported;
window.sbFFLoad = sbFFLoad;
window.sbFFJob = sbFFJob;
window.sbFFBytes = sbFFBytes;
