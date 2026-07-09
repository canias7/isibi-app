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

// expose for studio.js + tests
window.sbFFTrim = sbFFTrim;
window.sbFFSpeed = sbFFSpeed;
window.sbFFReframe = sbFFReframe;
window.sbFFSupported = sbFFSupported;
window.sbFFLoad = sbFFLoad;
window.sbFFJob = sbFFJob;
window.sbFFBytes = sbFFBytes;
