const DEFAULT_MODELS = {
  video: 'bytedance/seedance-2.0/fast/text-to-video',
  image: 'fal-ai/bytedance/seedream/v4/text-to-image',
  audio: 'fal-ai/elevenlabs/tts/eleven-v3',
};

// ElevenLabs preset voices (accepted by name on fal).
const VOICES = ['Rachel', 'Aria', 'Sarah', 'Laura', 'Charlotte', 'Alice', 'Matilda', 'Jessica', 'Lily', 'Roger', 'George', 'Callum', 'Liam', 'Will', 'Brian', 'Daniel'];

// Option ranges verified against fal's OpenAPI schemas.
// caps: which attachments the model actually supports (image = start frame /
// image-to-video, end = end/tail frame, avatar = reference-to-video).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const SEEDANCE_OPTS = {
  durations: range(4, 15), defDur: 5,
  ratios: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'], defRatio: '16:9',
  resolutions: ['480p', '720p'], defRes: '720p',
  caps: { image: true, end: true, avatar: true, audio: true, maxImages: 9 },
};
const KLING_OPTS = {
  durations: range(3, 15), defDur: 5,
  ratios: ['16:9', '9:16', '1:1'], defRatio: '16:9',
  caps: { image: true, end: true, avatar: false },
};
const MODEL_OPTS = {
  'bytedance/seedance-2.0/text-to-video': { ...SEEDANCE_OPTS, resolutions: ['480p', '720p', '1080p', '4k'], defRes: '720p' },
  'bytedance/seedance-2.0/fast/text-to-video': SEEDANCE_OPTS,
  'bytedance/seedance-2.0/mini/text-to-video': SEEDANCE_OPTS,
  'fal-ai/kling-video/v3/pro/text-to-video': KLING_OPTS,
  'fal-ai/kling-video/v3/standard/text-to-video': KLING_OPTS,
  'xai/grok-imagine-video/text-to-video': {
    durations: range(1, 15), defDur: 6,
    ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'], defRatio: '16:9',
    resolutions: ['480p', '720p'], defRes: '720p',
    caps: { image: true, end: false, avatar: false },
  },
  'google/gemini-omni-flash': {
    durations: range(3, 10), defDur: 8,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    caps: { image: false, end: false, avatar: false },
  },
  'fal-ai/veo3.1': {
    durations: [4, 6, 8], defDur: 8,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    resolutions: ['720p', '1080p', '4k'], defRes: '720p',
    // Veo 3.1's three image-input endpoints as separate rows: image-to-video
    // (1), first-&-last frame (2), reference-to-video (≤3).
    caps: { image: true, end: false, avatar: false, flf: true, ref: 3 },
  },
  'fal-ai/sora-2/text-to-video/pro': {
    durations: [4, 8, 12, 16, 20], defDur: 4,
    ratios: ['16:9', '9:16'], defRatio: '16:9',
    resolutions: ['720p', '1080p'], defRes: '1080p',
    caps: { image: true, end: false, avatar: false },
  },
  'fal-ai/kling-video/o3/pro/text-to-video': {
    durations: range(3, 15), defDur: 5,
    ratios: ['16:9', '9:16', '1:1'], defRatio: '16:9',
    caps: { image: true, end: true, avatar: false },
  },
  // Hailuo has no exposed duration/ratio/resolution — a prompt is all it takes.
  'fal-ai/minimax/hailuo-2.3/pro/text-to-video': { caps: {} },
  // Lip-sync (audio-driven) models: no prompt, no duration/ratio/quality —
  // duration comes from the audio. OmniHuman = portrait + voice; Kling
  // LipSync = a source clip + voice.
  'fal-ai/bytedance/omnihuman': {
    noPrompt: true,
    hint: 'Add a portrait image + an audio clip — I’ll lip-sync them',
    caps: { image: true, end: false, avatar: false, audio: true },
  },
  'fal-ai/kling-video/lipsync/audio-to-video': {
    noPrompt: true,
    hint: 'Add a video clip + an audio clip — I’ll lip-sync them',
    caps: { image: false, end: false, avatar: false, audio: true, clip: true },
  },
};
const IMAGE_OPTS = { ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'], defRatio: '1:1' };
// Image models that support editing (attach an image). MULTI ones take more
// than one image (so they also get the +Avatar reference picker).
const IMAGE_EDIT_MODELS = new Set([
  'google/nano-banana-2', 'fal-ai/nano-banana-pro', 'openai/gpt-image-2',
  'fal-ai/flux-2-pro', 'fal-ai/gemini-3-pro-image-preview',
  'fal-ai/bytedance/seedream/v4/text-to-image', 'fal-ai/flux/dev', 'fal-ai/recraft/v3/text-to-image',
]);
const IMAGE_MULTI_MODELS = new Set([
  'google/nano-banana-2', 'fal-ai/nano-banana-pro', 'openai/gpt-image-2',
  'fal-ai/flux-2-pro', 'fal-ai/gemini-3-pro-image-preview', 'fal-ai/bytedance/seedream/v4/text-to-image',
]);
// Models whose fal schema accepts num_images (verified against the OpenAPI docs).
const IMAGE_NUM_MODELS = new Set([
  'fal-ai/flux/dev', 'fal-ai/bytedance/seedream/v4/text-to-image',
  'fal-ai/nano-banana-pro', 'openai/gpt-image-2', 'fal-ai/krea-2/turbo',
  'xai/grok-imagine-image', 'fal-ai/gemini-3-pro-image-preview',
]);
// Audio (voice) generation: no frames/ratio/resolution — a voice + the words to speak.
// audio:true surfaces the "+ Audio" upload picker (e.g. a clip to clone from later).
const AUDIO_OPTS = { voices: VOICES, defVoice: 'Rachel', caps: { image: false, end: false, avatar: false, audio: true } };

let duration = 5;
let ratio = '16:9';
let quality = '720p';
let voice = 'Rachel';
let numImages = 1; // per-image billing — always defaults back to 1
// Each mode remembers its own model, so switching modes doesn't reset the pick.
const selectedModels = { ...DEFAULT_MODELS };
let model = selectedModels.video;
let mode = 'video';


const MODEL_LISTS = {
  video: [
    { id: 'fal-ai/veo3.1', label: 'Veo 3.1', note: 'Google · audio' },
    { id: 'fal-ai/sora-2/text-to-video/pro', label: 'Sora 2 Pro', note: 'OpenAI' },
    { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0', note: 'audio' },
    { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast', note: 'audio' },
    { id: 'bytedance/seedance-2.0/mini/text-to-video', label: 'Seedance 2.0 Mini', note: 'cheapest · audio' },
    { id: 'fal-ai/kling-video/o3/pro/text-to-video', label: 'Kling o3 Pro', note: 'newest' },
    { id: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', note: 'audio' },
    { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling 3.0 Standard', note: 'audio' },
    { id: 'fal-ai/minimax/hailuo-2.3/pro/text-to-video', label: 'Hailuo 2.3 Pro', note: 'MiniMax' },
    { id: 'xai/grok-imagine-video/text-to-video', label: 'Grok Imagine', note: 'audio' },
    { id: 'google/gemini-omni-flash', label: 'Gemini Omni Flash', note: 'audio' },
    { id: 'fal-ai/bytedance/omnihuman', label: 'OmniHuman', note: 'lip-sync' },
    { id: 'fal-ai/kling-video/lipsync/audio-to-video', label: 'Kling LipSync', note: 'lip-sync' },
  ],
  image: [
    { id: 'fal-ai/flux-2-pro', label: 'FLUX 2 Pro', note: 'flagship' },
    { id: 'fal-ai/gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', note: 'Google' },
    { id: 'fal-ai/bytedance/seedream/v4/text-to-image', label: 'Seedream v4', note: 'ByteDance' },
    { id: 'fal-ai/recraft/v3/text-to-image', label: 'Recraft v3', note: 'design' },
    { id: 'google/nano-banana-2', label: 'Nano Banana 2' },
    { id: 'fal-ai/nano-banana-pro', label: 'Nano Banana Pro' },
    { id: 'openai/gpt-image-2', label: 'GPT Image 2', note: 'typography' },
    { id: 'fal-ai/flux/dev', label: 'FLUX.1 Dev' },
    { id: 'fal-ai/krea-2/turbo', label: 'Krea 2 Turbo', note: 'fastest' },
    { id: 'xai/grok-imagine-image', label: 'Grok Imagine' },
  ],
  audio: [
    { id: 'fal-ai/elevenlabs/tts/eleven-v3', label: 'ElevenLabs v3', note: 'expressive' },
    { id: 'fal-ai/elevenlabs/tts/turbo-v2.5', label: 'ElevenLabs Turbo', note: 'fast' },
    { id: 'fal-ai/elevenlabs/tts/multilingual-v2', label: 'ElevenLabs Multilingual', note: '29 langs' },
  ],
};

const modelMenu = document.getElementById('modelMenu');

const attachments = { image: null, avatar: null, end: null, audio: null, clip: null, ffirst: null, flast: null };
// Extra reference images beyond the first (multi-image models only).
const extraImages = [];
// Veo reference-to-video images (its own row, capped per model at caps.ref).
const refList = [];
const ATTACH_LABELS = {
  image: '<span class="plus-big">+</span>',
  avatar: '<span class="plus-big">+</span>',
  audio: '+ Audio',
  clip: '+ Video clip',
  end: '<span class="plus-big">+</span>',
  ffirst: '<span class="plus-big">+</span><span class="slot-lab">First frame</span>',
  flast: '<span class="plus-big">+</span><span class="slot-lab">Last frame</span>',
};

function attachBtn(kind) {
  return document.getElementById('btn' + kind[0].toUpperCase() + kind.slice(1));
}

function onAttach(kind, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  // Caps must stay under the Worker's base64 ceilings (data URI ≈ size × 1.34).
  const cap = kind === 'clip' ? 20 : kind === 'audio' ? 20 : 8;
  if (file.size > cap * 1024 * 1024) {
    alert('File too big — max ' + cap + ' MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    attachments[kind] = reader.result;
    if (kind === 'audio') {
      awName = (file.name || 'audio').replace(/[<>&"]/g, '');
      if (awPlayer) { try { awPlayer.pause(); } catch (e) {} awPlayer = null; } // re-pick: drop the old clip's player
      awDecode(reader.result);
    }
    renderAttach(kind);
  };
  reader.readAsDataURL(file);
}

// ── Audio slot: waveform bars (Wispr-Flow style, design B) ──
const AW_N = 40;
let awPeaks = null, awDur = 0, awName = '', awPlayer = null;

// Decorative envelope for the empty slot; replaced by the real waveform once decoded.
function awPlaceholder(lo) {
  return Array.from({ length: AW_N }, (_, i) =>
    lo + (1 - lo) * Math.abs(Math.sin(i * 1.7)) * Math.sin((i / AW_N) * Math.PI));
}

function awBarsHtml(peaks, lit) {
  let s = '<span class="aw-bars' + (lit ? ' lit' : '') + '">';
  peaks.forEach((p) => { s += '<i style="height:' + Math.max(6, Math.round(p * 64)) + 'px"></i>'; });
  return s + '</span>';
}

// Decode the attached clip and reduce it to AW_N peak buckets.
async function awDecode(dataUrl) {
  try {
    const buf = await (await fetch(dataUrl)).arrayBuffer();
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await actx.decodeAudioData(buf);
    const ch = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / AW_N));
    const peaks = [];
    for (let i = 0; i < AW_N; i++) {
      let m = 0;
      for (let j = i * step; j < (i + 1) * step && j < ch.length; j += 40) m = Math.max(m, Math.abs(ch[j]));
      peaks.push(m);
    }
    const top = Math.max(...peaks, 0.01);
    awPeaks = peaks.map((p) => Math.pow(p / top, 0.7));
    awDur = audio.duration;
    actx.close();
  } catch { awPeaks = null; awDur = 0; }
  renderAttach('audio');
  updateSendPrice(); // lip-sync models bill by clip length — re-quote now that awDur is known
}

// Live visualization: while playing, an analyser drives the bars with the
// actual audio; on pause/end they settle back to the decoded waveform.
let awCtx = null, awAnalyser = null, awRaf = 0, awWired = false;

function awStartViz() {
  if (!awPlayer) return;
  if (!awWired) {
    if (!awCtx) awCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = awCtx.createMediaElementSource(awPlayer);
    awAnalyser = awCtx.createAnalyser();
    awAnalyser.fftSize = 128;
    src.connect(awAnalyser);
    awAnalyser.connect(awCtx.destination);
    awWired = true;
  }
  awCtx.resume();
  const data = new Uint8Array(awAnalyser.frequencyBinCount);
  const loop = () => {
    if (!awPlayer || awPlayer.paused) return;
    awAnalyser.getByteFrequencyData(data);
    const bars = document.querySelectorAll('#rowAudio .aw-bars i');
    bars.forEach((b, i) => {
      const v = data[Math.floor((i / bars.length) * data.length * 0.75)] / 255;
      b.style.height = Math.max(6, Math.round(6 + Math.pow(v, 1.4) * 58)) + 'px';
    });
    awRaf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(awRaf);
  awRaf = requestAnimationFrame(loop);
}

function awStopViz() {
  cancelAnimationFrame(awRaf);
  const peaks = awPeaks || awPlaceholder(0.25);
  document.querySelectorAll('#rowAudio .aw-bars i').forEach((b, i) => {
    b.style.height = Math.max(6, Math.round(peaks[i] * 64)) + 'px';
  });
}

function awIcon() {
  const b = document.querySelector('.aw-play');
  if (b) b.textContent = awPlayer && !awPlayer.paused ? '❚❚' : '▶';
}

function awToggle(ev) {
  ev.stopPropagation();
  if (!attachments.audio) return;
  if (awPlayer && !awPlayer.paused) awPlayer.pause();
  else {
    if (!awPlayer) {
      awPlayer = new Audio(attachments.audio);
      awPlayer.onplay = () => { awStartViz(); awIcon(); };
      awPlayer.onpause = () => { awStopViz(); awIcon(); };
      awPlayer.onended = () => { awStopViz(); awIcon(); };
    }
    awPlayer.play().catch(() => {}); // a clip the browser can't decode shouldn't throw
  }
  awIcon();
}

function renderAudioSlot(btn) {
  if (attachments.audio) {
    btn.classList.add('has');
    const dur = Math.round(awDur || 0);
    const meta = (awName || 'audio') + (dur ? ' · ' + Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0') : '');
    btn.innerHTML = awBarsHtml(awPeaks || awPlaceholder(0.25), true)
      + '<span class="aw-play">▶</span>'
      + '<span class="aw-meta">' + meta + '</span>'
      + '<span class="x">×</span>';
    const play = btn.querySelector('.aw-play'); if (play) play.onclick = awToggle;
    const clr = btn.querySelector('.x'); if (clr) clr.onclick = (e) => clearAttach(e, 'audio');
  } else {
    btn.classList.remove('has');
    cancelAnimationFrame(awRaf);
    if (awPlayer) { awPlayer.pause(); awPlayer = null; }
    awWired = false; awAnalyser = null;
    awPeaks = null; awDur = 0; awName = '';
    btn.innerHTML = awBarsHtml(awPlaceholder(0.15), false) + '<span class="plus-big">+</span>';
  }
}

function renderAttach(kind) {
  const btn = attachBtn(kind);
  if (!btn) return;
  if (kind === 'audio') {
    renderAudioSlot(btn);
  } else if (attachments[kind]) {
    btn.classList.add('has');
    const preview = kind === 'clip'
      ? '<span class="audio-chip">🎬 clip</span>'
      : '<img src="' + esc(attachments[kind]) + '" alt="" />';
    btn.innerHTML = preview + '<span class="x">×</span>';
    const clr = btn.querySelector('.x'); if (clr) clr.onclick = (e) => clearAttach(e, kind);
  } else {
    btn.classList.remove('has');
    btn.innerHTML = ATTACH_LABELS[kind];
  }
  const cnt = document.getElementById('cnt' + kind[0].toUpperCase() + kind.slice(1));
  if (cnt) {
    const n = kind === 'image'
      ? (attachments.image ? 1 : 0) + extraImages.length
      : (attachments[kind] ? 1 : 0);
    cnt.textContent = n ? '· ' + n : '';
  }
  // The first-&-last row shares one counter across its two frame slots.
  if (kind === 'ffirst' || kind === 'flast') {
    const c = document.getElementById('cntFlf');
    if (c) { const n = (attachments.ffirst ? 1 : 0) + (attachments.flast ? 1 : 0); c.textContent = n ? '· ' + n : ''; }
  }
}

function clearAttach(ev, kind) {
  ev.stopPropagation();
  attachments[kind] = null;
  // Removing the main image promotes the first extra ref so none orphan,
  // and the add-more slot re-renders (it keys off the main image).
  if (kind === 'image') {
    if (extraImages.length) attachments.image = extraImages.shift();
    renderExtraImages();
  }
  if (kind === 'audio') { awDur = 0; awPeaks = null; updateSendPrice(); } // reset lip-sync price
  renderAttach(kind);
}

// Show only the panel rows the current model actually supports (same rules
// as the old inline pickers), and clear anything a model can't use.
function updateAttachVisibility() {
  const caps = (currentOpts() && currentOpts().caps) || {};
  // No slots for this model → hide the whole panel, don't leave an empty box.
  const anySlot = !!(caps.image || caps.avatar || caps.audio || caps.clip || caps.end || caps.flf || caps.ref);
  const panel = document.getElementById('attachPanel');
  if (panel) panel.style.display = anySlot ? '' : 'none';
  [['image', caps.image], ['avatar', caps.avatar], ['audio', caps.audio], ['clip', caps.clip], ['end', caps.end]].forEach(([kind, ok]) => {
    const btn = attachBtn(kind);
    if (!btn) return;
    btn.style.display = ok ? '' : 'none';
    const row = document.getElementById('row' + kind[0].toUpperCase() + kind.slice(1));
    if (row) row.style.display = ok ? '' : 'none';
    if (!ok && attachments[kind]) { attachments[kind] = null; renderAttach(kind); }
  });
  // First-&-last-frame row (two dedicated slots) — Veo's 2-frame input.
  const rowFlf = document.getElementById('rowFlf');
  if (rowFlf) rowFlf.style.display = caps.flf ? '' : 'none';
  if (!caps.flf) {
    ['ffirst', 'flast'].forEach((k) => { if (attachments[k]) { attachments[k] = null; renderAttach(k); } });
  }
  // Reference-to-video row (its own image list, capped at caps.ref).
  const rowRef = document.getElementById('rowRef');
  if (rowRef) rowRef.style.display = caps.ref ? '' : 'none';
  if (!caps.ref) refList.length = 0;
  else if (refList.length > caps.ref) refList.length = caps.ref;
  renderRefList();
  // Multi-image slots follow the model's cap (Seedance refs take up to 9).
  const cap = caps.maxImages || 1;
  if (!caps.image) extraImages.length = 0;
  else if (extraImages.length > cap - 1) extraImages.length = Math.max(0, cap - 1);
  renderExtraImages();
}

// ── Attach panel (left of the thread): accordion rows ──
function toggleApRow(kind) {
  const row = document.getElementById('row' + kind[0].toUpperCase() + kind.slice(1));
  if (row) row.classList.toggle('open');
}

// One-line explainer for each input row's ⓘ. Keyed to the row's data-info.
const AP_INFO = {
  image: 'Image-to-video: your image becomes the first frame, then animates forward from your prompt.',
  flf: 'First & last frame: pin the opening and closing frames — the model fills in the motion between them.',
  ref: 'Reference to video: up to 3 images that keep a character or subject looking consistent in a new scene you describe.',
};
function showApInfo(kind, ev, el) {
  ev.stopPropagation(); // don't let the click toggle the row open/closed
  const pop = document.getElementById('apInfoPop');
  if (!pop) return;
  if (pop.classList.contains('open') && pop.dataset.for === kind) { pop.classList.remove('open'); return; }
  pop.textContent = AP_INFO[kind] || '';
  pop.dataset.for = kind;
  const r = el.getBoundingClientRect();
  const w = 244;
  pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
  pop.style.top = (r.bottom + 6) + 'px';
  pop.classList.add('open');
}
// Any click that isn't on an ⓘ or inside the popover dismisses it.
document.addEventListener('click', (e) => {
  const pop = document.getElementById('apInfoPop');
  if (pop && pop.classList.contains('open') && !e.target.closest('.ap-info') && !e.target.closest('#apInfoPop')) {
    pop.classList.remove('open');
  }
});

// ── Image source chooser: device files or the isibi gallery ──
let imgPickTarget = 'main'; // which slot the chosen image lands in

function openImgSrc(target, ev) {
  ev.stopPropagation();
  imgPickTarget = target;
  const menu = document.getElementById('imgSrcMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}

function imgSrcPick(src, ev) {
  ev.stopPropagation();
  document.getElementById('imgSrcMenu').classList.remove('open');
  if (src === 'device') {
    document.getElementById(imgPickTarget === 'extra' ? 'fileExtra' : 'fileImage').click();
  } else {
    openGalleryPicker();
  }
}

// Every image generated in any chat (media messages hold permanent URLs).
function galleryImages() {
  const seen = new Set();
  const out = [];
  (chatStore.chats || []).forEach((c) => (c.msgs || []).forEach((m) => {
    if (m.t === 'media' && m.kind === 'image' && m.url && !seen.has(m.url)) {
      seen.add(m.url);
      out.push({ url: m.url, at: m.at || 0 });
    }
  }));
  // Sort by capture time so the genuinely newest image is first, regardless of
  // which chat it came from.
  return out.sort((a, b) => b.at - a.at).map((x) => x.url);
}

function openGalleryPicker() {
  const old = document.querySelector('.gal-overlay');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'gal-overlay';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const urls = galleryImages();
  ov.innerHTML = '<div class="gal-box"><div class="gal-head"><span class="gal-title">Pick from your gallery</span>'
    + '<span class="gal-sub">' + (urls.length ? urls.length + (urls.length === 1 ? ' image' : ' images') : '') + '</span>'
    + '<button class="gal-close">×</button></div>'
    + (urls.length ? '<div class="gal-grid"></div>' : '<div class="gal-empty">Nothing in your gallery yet — images you generate will show up here.</div>') + '</div>';
  const closeBtn = ov.querySelector('.gal-close');
  if (closeBtn) closeBtn.onclick = () => ov.remove();
  // Build thumbnails with DOM APIs (never innerHTML) so a stored URL can't
  // break out of the src attribute and inject markup.
  const gridEl = ov.querySelector('.gal-grid');
  if (gridEl) urls.forEach((u) => {
    const img = document.createElement('img');
    img.alt = '';
    img.src = u;
    img.onclick = () => { useGalleryImage(u); ov.remove(); };
    gridEl.appendChild(img);
  });
  document.body.appendChild(ov);
}

// Fetch the stored image and attach it like a picked file (the API wants data URIs).
async function useGalleryImage(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
    if (imgPickTarget === 'extra' && attachments.image) {
      if (extraImages.length < cap - 1) extraImages.push(dataUrl);
    } else {
      attachments.image = dataUrl;
    }
    renderAttach('image');
    renderExtraImages();
  } catch {
    alert("Couldn't load that image — try saving it to your device instead.");
  }
}

// Extra images beyond the first, for models that take several references.
function onAttachExtra(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
  files.forEach((file) => {
    if (file.size > 8 * 1024 * 1024) { alert('File too big — max 8 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (!attachments.image) attachments.image = reader.result;
      else if (extraImages.length < cap - 1) extraImages.push(reader.result);
      renderAttach('image');
      renderExtraImages();
    };
    reader.readAsDataURL(file);
  });
}

function removeExtraImage(i) {
  extraImages.splice(i, 1);
  renderExtraImages();
  renderAttach('image');
}

function renderExtraImages() {
  const host = document.getElementById('extraImages');
  if (!host) return;
  host.innerHTML = '';
  extraImages.forEach((src, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<img src="' + esc(src) + '" alt="" /><span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeExtraImage(i);
    host.appendChild(d);
  });
  const more = document.getElementById('btnMoreImages');
  if (more) {
    const cap = ((currentOpts() || {}).caps || {}).maxImages || 1;
    const total = (attachments.image ? 1 : 0) + extraImages.length;
    more.style.display = (cap > 1 && attachments.image) ? '' : 'none';
    more.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + total + '/' + cap + '</span>';
  }
}

// Reference-to-video images (Veo): its own row, capped at caps.ref (≤3).
function refCap() { return ((currentOpts() || {}).caps || {}).ref || 0; }
function onAttachRef(inputEl) {
  const files = Array.from(inputEl.files || []);
  inputEl.value = '';
  const cap = refCap();
  files.forEach((file) => {
    if (refList.length >= cap) return;
    if (file.size > 8 * 1024 * 1024) { alert('File too big — max 8 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (refList.length < cap) { refList.push(reader.result); renderRefList(); } };
    reader.readAsDataURL(file);
  });
}
function removeRef(i) { refList.splice(i, 1); renderRefList(); }
function renderRefList() {
  const host = document.getElementById('refImages');
  if (!host) return;
  host.innerHTML = '';
  refList.forEach((src, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<img src="' + esc(src) + '" alt="" /><span class="x">×</span>';
    d.querySelector('.x').onclick = () => removeRef(i);
    host.appendChild(d);
  });
  const add = document.getElementById('btnRef');
  const cap = refCap();
  if (add) {
    add.style.display = refList.length < cap ? '' : 'none';
    add.innerHTML = '<span class="plus-big">+</span><span class="slot-count">' + refList.length + '/' + cap + '</span>';
  }
  const cnt = document.getElementById('cntRef');
  if (cnt) cnt.textContent = refList.length ? '· ' + refList.length : '';
}

// Provider identity per model id: real logo where we have one, monogram otherwise.
function providerOf(id) {
  if (/veo|gemini|nano-banana|^google\//.test(id)) return { logo: '/logos/google.svg', name: 'Google' };
  if (/sora|gpt-image|^openai\//.test(id)) return { mono: 'O', name: 'OpenAI' };
  if (/seedance|seedream|bytedance/.test(id)) return { logo: '/logos/bytedance.svg', name: 'ByteDance' };
  if (/kling/.test(id)) return { logo: '/logos/kuaishou.svg', name: 'Kling' };
  if (/hailuo|minimax/.test(id)) return { logo: '/logos/minimax.svg', name: 'MiniMax' };
  if (/grok|^xai\//.test(id)) return { logo: '/logos/x.svg', name: 'xAI' };
  if (/elevenlabs/.test(id)) return { logo: '/logos/elevenlabs.svg', name: 'ElevenLabs' };
  if (/flux/.test(id)) return { mono: 'F', name: 'Black Forest Labs' };
  if (/recraft/.test(id)) return { mono: 'R', name: 'Recraft' };
  if (/krea/.test(id)) return { mono: 'K', name: 'Krea' };
  return { mono: '·', name: '' };
}

function modelChips(id) {
  const chips = [];
  const o = MODEL_OPTS[id];
  if (o && o.resolutions) {
    const top = o.resolutions[o.resolutions.length - 1];
    chips.push('🏷 ' + (top === '4k' ? '4K' : top));
  }
  if (o && o.durations) chips.push('⏱ ' + o.durations[0] + 's–' + o.durations[o.durations.length - 1] + 's');
  if (o && o.noPrompt) chips.push('⏱ from audio');
  return chips;
}

function buildMenu() {
  if (!modelMenu) return;
  modelMenu.innerHTML = '';
  model = selectedModels[mode] || DEFAULT_MODELS[mode];

  const search = document.createElement('input');
  search.className = 'm-search';
  search.placeholder = 'Search…';
  search.onclick = (e) => e.stopPropagation();
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    modelMenu.querySelectorAll('.m-row').forEach((r) => {
      r.style.display = !q || r.dataset.search.includes(q) ? '' : 'none';
    });
  };
  modelMenu.appendChild(search);

  const section = document.createElement('div');
  section.className = 'm-section';
  section.textContent = '✦ Featured models';
  modelMenu.appendChild(section);

  MODEL_LISTS[mode].forEach((m) => {
    const prov = providerOf(m.id);
    const d = document.createElement('div');
    d.className = 'model-item m-row' + (m.id === model ? ' selected' : '');
    d.dataset.model = m.id;
    d.dataset.label = m.label;
    d.dataset.search = (m.label + ' ' + prov.name + ' ' + (m.note || '')).toLowerCase();

    const notes = (m.note || '').split('·').map((t) => t.trim()).filter(Boolean);
    const hasAudio = notes.includes('audio');
    const badges = notes
      .filter((t) => !['audio', 'Google', 'OpenAI', 'ByteDance', 'MiniMax'].includes(t))
      .map((t) => t === 'newest'
        ? '<span class="m-badge">NEW</span>'
        : '<span class="m-tag">' + t.toUpperCase() + '</span>')
      .join('');
    const chips = modelChips(m.id).map((c) => '<span class="m-chip">' + c + '</span>').join('');

    d.innerHTML =
      '<span class="m-ico">' + (prov.logo ? '<img src="' + prov.logo + '" alt="" />' : '<b>' + (prov.mono || '·') + '</b>') + '</span>'
      + '<span class="m-main">'
      +   '<span class="m-title">' + m.label + (hasAudio ? ' <span class="spk">🔊</span>' : '') + badges + '</span>'
      +   (chips ? '<span class="m-chips">' + chips + '</span>' : '')
      + '</span>'
      + '<span class="check">✓</span>';
    d.onclick = () => pickModel(d);
    modelMenu.appendChild(d);
  });
  // Guard against a selected id that isn't in this mode's list (e.g. a persisted
  // pick from another mode) — fall back to the default rather than throwing.
  const cur = MODEL_LISTS[mode].find((m) => m.id === model) || MODEL_LISTS[mode].find((m) => m.id === DEFAULT_MODELS[mode]) || MODEL_LISTS[mode][0];
  document.getElementById('modelLabel').textContent = cur ? cur.label : 'Auto';
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === m));
  buildMenu();
  document.getElementById('input').placeholder =
    m === 'image' ? 'Describe your image…' :
    m === 'audio' ? 'Type what you want the voice to say…' :
    'Describe your scene…';
  buildOptMenus();
}

// Effort picker (top-left of the main chat) — how detailed the director's
// written prompt gets. Persisted per browser.
const EFFORT_KEY = 'zephyr_effort';
const EFFORT_LABELS = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra High', max: 'Max' };
let effort = EFFORT_LABELS[localStorage.getItem(EFFORT_KEY)] ? localStorage.getItem(EFFORT_KEY) : 'medium';
function setEffort(level) {
  effort = level;
  localStorage.setItem(EFFORT_KEY, level);
  document.querySelectorAll('.effort-item').forEach((i) =>
    i.classList.toggle('selected', i.dataset.effort === level));
  document.getElementById('effortLabel').textContent = EFFORT_LABELS[level];
  document.getElementById('effortMenu').classList.remove('open');
  updateSendPrice(); // High+ runs the Sonnet director → +1 credit on the tag
}
// Web search (Settings toggle). When on, a request the director judges to
// need current real-world facts triggers a billed web-search step before the
// prompt is written. Default on; users can switch it off in Settings.
// Shown in Settings → About.
const APP_VERSION = '1.0.0';
// Prompt-help mode chip (top-right of the composer). Three modes:
//   auto — isibi.ai composes and makes every creative call, never asks
//   plan — isibi.ai interviews first (the question popup), then composes
//   off  — raw prompting: the text goes to the model exactly as typed,
//          and the director surcharge disappears from the price
const DIR_MODE_KEY = 'zephyr_director_mode';
const DIR_MODES = {
  auto: { icon: '', label: 'Auto', desc: 'isibi.ai writes the prompt and generates right away' },
  plan: { icon: '', label: 'Plan', desc: 'isibi.ai shows you the plan to approve before generating' },
  off:  { icon: '</>', label: 'Raw', desc: 'No prompt help — your words go to the model exactly as typed' },
};
let directorMode = DIR_MODES[localStorage.getItem(DIR_MODE_KEY)] ? localStorage.getItem(DIR_MODE_KEY) : 'auto';
function renderDirChip() {
  const el = document.getElementById('dirModeChip');
  if (!el) return;
  const m = DIR_MODES[directorMode];
  el.innerHTML = (m.icon ? '<span class="ae-icon">' + esc(m.icon) + '</span>' : '') +
    '<span class="ae-label">' + m.label + '</span>';
  document.querySelectorAll('#dirMenu .dir-item').forEach((i) =>
    i.classList.toggle('selected', i.dataset.mode === directorMode));
}
function setDirectorMode(m) {
  directorMode = m;
  localStorage.setItem(DIR_MODE_KEY, m);
  renderDirChip();
  renderEffortLock();
  document.getElementById('dirMenu').classList.remove('open');
  updateSendPrice(); // raw mode drops the director surcharge from the tag
}
function toggleDirMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('dirMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
(function buildDirMenu() {
  const menu = document.getElementById('dirMenu');
  if (!menu) return;
  for (const key of ['auto', 'plan', 'off']) {
    const m = DIR_MODES[key];
    const it = document.createElement('div');
    it.className = 'model-item dir-item';
    it.dataset.mode = key;
    it.innerHTML = '<span class="txt"><b>' + (m.icon ? esc(m.icon) + ' ' : '') + m.label + '</b><small>' + m.desc + '</small></span><span class="check">✓</span>';
    it.onclick = () => setDirectorMode(key);
    menu.appendChild(it);
  }
  renderDirChip();
  renderEffortLock();
})();

// Arrow under the chatbox — slides the whole view down to the Presets screen
// (and back up from its own arrow).
function togglePresets(open) {
  if (open) renderPresets();
  document.getElementById('homeSlide').classList.toggle('show-presets', open);
  document.getElementById('drawerArrow').setAttribute('aria-expanded', open);
}

// Preset categories shown as top tabs on the Presets screen. Each card drops a
// ready-to-edit starter prompt into the composer (and sets the mode).
const PRESET_CATS = [
  { key: 'marketing', label: 'Marketing', items: [
    { label: 'Product hero ad', kind: 'video', desc: 'Slick 360° commercial of your product.', prompt: 'Cinematic product commercial of [your product] on a clean seamless backdrop, slow 360° turntable, dramatic key light with soft rim, glossy reflections, shallow depth of field, premium tech-ad aesthetic, 4K.' },
    { label: 'UGC testimonial', kind: 'video', desc: 'Authentic selfie-style hype.', prompt: 'Handheld selfie-style UGC video of a person enthusiastically showing [your product] to the camera in natural daylight, casual and authentic, talking to camera, vertical 9:16.' },
    { label: 'Sale announcement', kind: 'image', desc: 'Bold promo graphic with a headline.', prompt: 'Bold promotional graphic announcing a sale for [your product], big punchy headline reading "50% OFF", vibrant brand colors, clean modern layout, high contrast, social-ready.' },
    { label: 'Lifestyle shot', kind: 'image', desc: 'Aspirational product-in-use photo.', prompt: 'Lifestyle photograph of [your product] in use in a bright, aspirational setting, natural light, editorial styling, soft shadows, magazine quality.' },
  ] },
  { key: 'cinematic', label: 'Cinematic', items: [
    { label: 'Epic establishing shot', kind: 'video', desc: 'Sweeping golden-hour drone.', prompt: 'Sweeping cinematic drone shot over [location] at golden hour, volumetric light, anamorphic lens flares, epic scale, filmic color grade, 24fps.' },
    { label: 'Slow-mo hero', kind: 'video', desc: 'Dramatic slow-motion close-up.', prompt: 'Ultra slow-motion cinematic close-up of [subject], dramatic side lighting, shallow depth of field, dust particles drifting in the air, moody film grain.' },
    { label: 'Noir scene', kind: 'image', desc: 'Neon rain-slicked film noir.', prompt: 'Film-noir cinematic still, [subject] in a rain-slicked neon alley at night, high-contrast chiaroscuro lighting, teal and amber palette, atmospheric haze.' },
  ] },
  { key: 'product', label: 'Product', items: [
    { label: 'Studio pack shot', kind: 'image', desc: 'Clean e-commerce white-bg shot.', prompt: 'Clean studio product photograph of [your product] on white seamless, soft even lighting, crisp reflections, centered composition, e-commerce ready.' },
    { label: 'Floating product', kind: 'video', desc: 'Product rotating in a dark void.', prompt: '[Your product] floating and slowly rotating in a dark studio void, dramatic rim lighting, soft reflections gliding across the surface, premium look.' },
    { label: 'Macro detail', kind: 'image', desc: 'Extreme close-up of texture.', prompt: 'Extreme macro photograph of [your product] showing fine texture and material detail, razor-thin depth of field, controlled specular highlights.' },
  ] },
  { key: 'social', label: 'Social', items: [
    { label: 'Reel intro', kind: 'video', desc: 'Fast vertical hook with text.', prompt: 'Fast-paced vertical 9:16 social intro, punchy text animation reading "NEW DROP", energetic camera moves, trendy quick transitions, bold brand colors.' },
    { label: 'Story background', kind: 'image', desc: '9:16 background with text room.', prompt: 'Eye-catching 9:16 story background with abstract gradient shapes and space for text, on-brand pink and amber palette, modern and clean.' },
    { label: 'Carousel cover', kind: 'image', desc: 'Scroll-stopping post cover.', prompt: 'Scroll-stopping square social post cover for [topic], bold headline text, high-contrast layout, clean modern design.' },
  ] },
  { key: 'portrait', label: 'Portrait', items: [
    { label: 'Studio headshot', kind: 'image', desc: 'Corporate-clean headshot.', prompt: 'Professional studio headshot portrait, soft key light with subtle rim, neutral background, sharp eyes, natural skin tones, corporate-clean.' },
    { label: 'Cinematic portrait', kind: 'image', desc: 'Moody single-light portrait.', prompt: 'Cinematic character portrait, dramatic single-source lighting, shallow depth of field, moody color grade, subtle film grain.' },
    { label: 'Fashion editorial', kind: 'image', desc: 'Magazine-cover styling.', prompt: 'High-fashion editorial portrait, bold styling, studio strobe lighting, striking pose, magazine cover quality.' },
  ] },
  { key: 'anime', label: 'Anime', items: [
    { label: 'Anime key art', kind: 'image', desc: 'Vibrant cel-shaded hero art.', prompt: 'Vibrant anime illustration of [character], dynamic pose, cel-shaded, detailed background, studio-quality key art.' },
    { label: 'Chibi sticker', kind: 'image', desc: 'Cute flat-color sticker.', prompt: 'Cute chibi anime sticker of [character], thick outline, flat colors, expressive face, simple background.' },
    { label: 'Anime scene', kind: 'video', desc: 'Gently animated anime shot.', prompt: 'Anime-style animated scene of [subject] with gentle ambient motion, hair and clothes swaying, soft parallax background; preserve the art style exactly, no smoothing.' },
  ] },
];
let presetCat = 'marketing';
function renderPresets() {
  const body = document.getElementById('presetsBody');
  if (!body) return;
  const tabs = PRESET_CATS.map((c) =>
    '<button type="button" class="pt-tab' + (c.key === presetCat ? ' active' : '') + '" data-cat="' + c.key + '">' + esc(c.label) + '</button>').join('');
  const cat = PRESET_CATS.find((c) => c.key === presetCat) || PRESET_CATS[0];
  const kindIco = (k) => (k === 'image' ? '🖼' : k === 'audio' ? '🎙' : '🎬');
  const cards = cat.items.map((it, i) => {
    const prev = (Array.isArray(it.previews) && it.previews.length ? it.previews.slice(0, 3) : [null, null, null])
      .map((p, k) => p
        ? '<span class="pt-prev"><img src="' + esc(p) + '" alt="" loading="lazy" /></span>'
        : '<span class="pt-prev pt-prev-ph pt-ph' + (k % 3) + '"></span>').join('');
    return '<button type="button" class="pt-card" data-i="' + i + '">' +
      '<span class="pt-previews">' + prev + '</span>' +
      '<span class="pt-foot">' +
        '<span class="pt-ico">' + kindIco(it.kind) + '</span>' +
        '<span class="pt-meta"><span class="pt-card-t">' + esc(it.label) + '</span>' +
        '<span class="pt-card-s">' + esc(it.desc || '') + '</span></span>' +
        '<span class="pt-try">Try</span>' +
      '</span>' +
    '</button>';
  }).join('');
  body.innerHTML = '<div class="pt-tabs">' + tabs + '</div><div class="pt-grid">' + cards + '</div>';
  body.querySelectorAll('.pt-tab').forEach((t) => { t.onclick = () => { presetCat = t.dataset.cat; renderPresets(); }; });
  body.querySelectorAll('.pt-card').forEach((card) => { card.onclick = () => usePreset(cat.items[+card.dataset.i]); });
}
function usePreset(it) {
  if (!it) return;
  if (it.kind && it.kind !== mode && typeof setMode === 'function') setMode(it.kind);
  togglePresets(false);
  const input = document.getElementById('input');
  if (input) { input.value = it.prompt; if (typeof autoGrow === 'function') autoGrow(input); input.focus(); }
}

function toggleEffortMenu(e) {
  e.stopPropagation();
  if (directorMode === 'off') return; // raw mode: effort has nothing to control
  const menu = document.getElementById('effortMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
// Raw mode greys the effort picker out — the knob only shapes the prompt
// isibi.ai writes, and in raw mode isibi.ai isn't writing one.
function renderEffortLock() {
  const pick = document.querySelector('.effort-pick');
  if (!pick) return;
  const off = directorMode === 'off';
  pick.classList.toggle('locked', off);
  pick.querySelector('.opt-btn').title = off
    ? 'Effort applies when isibi.ai writes the prompt — turn prompt help back on to use it'
    : 'How detailed the written prompt gets';
  if (off) document.getElementById('effortMenu').classList.remove('open');
}
setEffort(effort);

function currentOpts() {
  if (mode === 'audio') return AUDIO_OPTS;
  if (mode === 'image') {
    return {
      ratios: IMAGE_OPTS.ratios, defRatio: IMAGE_OPTS.defRatio,
      nums: IMAGE_NUM_MODELS.has(model) ? [1, 2, 3, 4] : null,
      caps: {
        image: IMAGE_EDIT_MODELS.has(model), end: false, avatar: IMAGE_MULTI_MODELS.has(model),
        maxImages: IMAGE_MULTI_MODELS.has(model) ? 4 : 1,
      },
    };
  }
  return MODEL_OPTS[model];
}

// Voice preview: generate a short line in the chosen voice once, then cache
// it (keyed by model+voice) so replays and re-tests are instant and free.
const voicePreviewCache = {};
let previewAudio = null;

function stopPreview() {
  if (previewAudio) { previewAudio.pause(); previewAudio.currentTime = 0; }
  document.querySelectorAll('.voice-test.playing, .set-voicebtn.playing').forEach((b) => {
    b.classList.remove('playing'); b.textContent = '▶';
  });
}

async function previewVoice(name, btn) {
  stopPreview();
  const key = model + '|' + name;
  if (voicePreviewCache[key]) { playPreview(voicePreviewCache[key], btn); return; }

  btn.disabled = true;
  btn.textContent = '…';
  try {
    // Committed static previews (/voices/<name>.mp3) are free — prefer them
    // over spending a live TTS call.
    try {
      const staticUrl = '/voices/' + name.toLowerCase() + '.mp3';
      const head = await fetch(staticUrl, { method: 'HEAD' });
      if (head.ok && (head.headers.get('content-type') || '').startsWith('audio')) {
        voicePreviewCache[key] = staticUrl;
        playPreview(staticUrl, btn);
        return;
      }
    } catch {}
    const res = await apiFetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // director:'off' — a preview runs no prompt writer, so it must not pay the
      // director surcharge on top of the TTS credit.
      body: JSON.stringify({ model, prompt: "Hi, I'm " + name + ". This is how I sound.", voice: name, director: 'off' }),
    });
    const job = await res.json();
    if (!res.ok || !job.status_url) throw new Error('start');

    const started = Date.now();
    let out = null;
    while (Date.now() - started < 90 * 1000) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
      const st = await sr.json();
      if (st.status === 'COMPLETED') {
        const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
        out = await rr.json();
        break;
      }
      if (['FAILED', 'ERROR', 'CANCELED', 'CANCELLED'].includes(st.status)) break; // don't spin the full 90s on a dead job
      await new Promise((r) => setTimeout(r, 1500));
    }
    const url = out && (out.audio?.url || out.audio_url || out.audio_file?.url || out.data?.audio?.url);
    if (!url) throw new Error('no audio');
    voicePreviewCache[key] = url;
    playPreview(url, btn);
  } catch {
    btn.textContent = '⚠';
    setTimeout(() => { btn.textContent = '▶'; }, 1600);
  } finally {
    btn.disabled = false;
  }
}

function playPreview(url, btn) {
  if (!previewAudio) previewAudio = new Audio();
  previewAudio.src = url;
  btn.classList.add('playing');
  btn.textContent = '♪';
  previewAudio.onended = () => { btn.classList.remove('playing'); btn.textContent = '▶'; };
  previewAudio.play().catch(() => { btn.classList.remove('playing'); btn.textContent = '▶'; });
}

// One "Settings" panel groups every option (aspect ratio / resolution /
// duration / images / voice) into sections, filtered to what the current model
// supports. Values reset to this model's defaults on each rebuild.
function buildOptMenus() {
  const panel = document.getElementById('settingsMenu');
  const wrap = document.getElementById('settingsWrap');
  if (!panel || !wrap) return;
  const opts = currentOpts();

  // reset to this model's defaults
  if (opts.durations) duration = opts.defDur;
  if (opts.resolutions) quality = opts.defRes;
  if (opts.ratios) ratio = opts.defRatio;
  if (opts.nums) numImages = 1;
  if (opts.voices) voice = opts.defVoice;

  const sections = [];
  if (opts.ratios) sections.push(settingSection('Aspect ratio', 'ratio', opts.ratios.map((r) => ({ value: r, label: r }))));
  if (opts.resolutions) sections.push(settingSection('Resolution', 'quality', opts.resolutions.map((q) => ({ value: q, label: q }))));
  if (opts.durations) sections.push(settingSection('Duration', 'duration', opts.durations.map((d) => ({ value: d, label: d + 's' }))));
  if (opts.nums) sections.push(settingSection('Images', 'num', opts.nums.map((n) => ({ value: n, label: n === 1 ? '1 image' : n + ' images' }))));
  if (opts.voices) sections.push(settingSection('Voice', 'voice', opts.voices.map((v) => ({ value: v, label: v })), true));

  wrap.style.display = sections.length ? '' : 'none';
  panel.innerHTML = sections.join('');
  if (!sections.length) panel.classList.remove('open');

  // Keep the panel open while adjusting — stop clicks from reaching the
  // document-level "close menus" handler.
  panel.querySelectorAll('.set-chip').forEach((chip) => {
    chip.onclick = (e) => { e.stopPropagation(); pickSetting(chip); };
  });
  panel.querySelectorAll('.set-voicebtn').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); previewVoice(btn.dataset.voice, btn); };
  });
  panel.querySelectorAll('.set-viewall').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const open = btn.closest('.set-section').classList.toggle('expanded');
      btn.textContent = open ? 'View less' : 'View all';
    };
  });
  updateSettingsSummary();

  document.getElementById('input').placeholder = opts.hint ||
    (mode === 'image' ? 'Describe your image…' :
     mode === 'audio' ? 'Type what you want the voice to say…' :
     'Describe your scene…');
  updateAttachVisibility();
  updateSendPrice();
}

// A settings section: a label + selectable chips. Long lists (>6) collapse
// behind a "View all" toggle.
function settingSection(label, kind, items, isVoice) {
  const cur = { ratio: ratio, quality: quality, duration: duration, num: numImages, voice: voice }[kind];
  const collapsible = items.length > 6;
  const chips = items.map((it) => {
    const active = String(it.value) === String(cur) ? ' active' : '';
    if (isVoice) {
      return '<button type="button" class="set-chip' + active + '" data-kind="voice" data-value="' + esc(it.value) + '">' +
        '<span>' + esc(it.label) + '</span>' +
        '<span class="set-voicebtn" data-voice="' + esc(it.value) + '" title="Hear voice">▶</span></button>';
    }
    return '<button type="button" class="set-chip' + active + '" data-kind="' + kind + '" data-value="' + esc(it.value) + '">' + esc(it.label) + '</button>';
  }).join('');
  return '<div class="set-section' + (collapsible ? ' collapsible' : '') + '">' +
    '<div class="set-label">' + label + '</div>' +
    '<div class="set-chips">' + chips + '</div>' +
    (collapsible ? '<button type="button" class="set-viewall">View all</button>' : '') +
    '</div>';
}

function pickSetting(chip) {
  const kind = chip.dataset.kind, val = chip.dataset.value;
  if (kind === 'ratio') ratio = val;
  else if (kind === 'quality') quality = val;
  else if (kind === 'duration') duration = Number(val);
  else if (kind === 'num') numImages = Number(val);
  else if (kind === 'voice') voice = val;
  chip.parentElement.querySelectorAll('.set-chip').forEach((c) => c.classList.toggle('active', c === chip));
  updateSettingsSummary();
  updateSendPrice();
}

// The Settings button shows the current picks at a glance (e.g. "16:9 · 720p · 5s").
function updateSettingsSummary() {
  const el = document.getElementById('settingsSummary');
  if (!el) return;
  const opts = currentOpts();
  const parts = [];
  if (opts.ratios) parts.push(ratio);
  if (opts.resolutions) parts.push(quality);
  if (opts.durations) parts.push(duration + 's');
  if (opts.nums && numImages > 1) parts.push('×' + numImages);
  if (opts.voices) parts.push(voice);
  el.textContent = parts.length ? parts.join(' · ') : 'Settings';
}

function toggleOpt(e, which) {
  e.stopPropagation();
  const menu = document.getElementById(which + 'Menu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}

function toggleModelMenu(e) {
  e.stopPropagation();
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== modelMenu) m.classList.remove('open'); });
  modelMenu.classList.toggle('open');
}

function pickModel(el) {
  if (el.classList.contains('disabled')) return;
  model = el.dataset.model;
  selectedModels[mode] = model;
  document.querySelectorAll('.model-item').forEach(i => i.classList.toggle('selected', i === el));
  document.getElementById('modelLabel').textContent = el.dataset.label;
  modelMenu.classList.remove('open');
  buildOptMenus();
}

if (modelMenu) {
  document.addEventListener('click', () =>
    document.querySelectorAll('.model-menu.open').forEach((m) => m.classList.remove('open')));
}

function newChat() {
  // A fresh chat wouldn't match an active search filter and would be
  // invisible in the list — clear the filter first.
  const search = document.getElementById('chatSearch');
  if (search) search.value = '';
  // Always start a fresh chat — even if the current one is still empty.
  const fresh = newChatEntry();
  chatStore.chats.unshift(fresh);
  chatStore.active = fresh.id;
  persistStore();
  touchSync(fresh.id);
  renderChatList();
  renderThread();
  document.getElementById('input').focus();
}

// Wall-clock caption under a bubble, e.g. "11:03 PM" (user) / "isibi.ai · 11:03 PM" (agent).
function fmtTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
}
function msgStamp(kind, ts) {
  const t = document.createElement('div');
  t.className = 'msg-time ' + kind;
  t.textContent = kind === 'agent' ? 'isibi.ai · ' + fmtTime(ts) : fmtTime(ts);
  return t;
}

function addMsg(kind, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + kind;
  if (kind.includes('typing')) {
    // Build with DOM so `text` is never interpreted as HTML (defense-in-depth,
    // even though callers only pass internal literals today).
    div.textContent = text + ' ';
    const dots = document.createElement('span');
    dots.className = 'dots';
    div.appendChild(dots);
  } else {
    div.textContent = text;
  }
  toggleHomeHero(false);
  const box = document.getElementById('messages');
  box.appendChild(div);
  if (kind === 'user' || kind === 'agent') {
    const ts = Date.now();
    box.appendChild(msgStamp(kind, ts));
    addCopyBtn(div, text);
    pushSaved({ t: kind, text, ts });
  }
  box.parentElement.scrollTop = box.parentElement.scrollHeight;
  return div;
}

// Hover chip that copies a message's text to the clipboard.
function addCopyBtn(div, text) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn'; btn.type = 'button'; btn.title = 'Copy';
  btn.textContent = '⧉';
  btn.onclick = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓';
    } catch {
      const ta = document.createElement('textarea'); // older-browser fallback
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); btn.textContent = '✓'; } catch { btn.textContent = '✗'; }
      ta.remove();
    }
    setTimeout(() => { btn.textContent = '⧉'; }, 1200);
  };
  div.appendChild(btn);
}

function ratioAspect(r) {
  const m = typeof r === 'string' && r.match(/^(\d{1,2}):(\d{1,2})$/);
  return m ? m[1] + ' / ' + m[2] : '16 / 9';
}

// ── Persistence: every chat is kept; New chat starts another ──
const STORE_KEY = 'zephyr_chats_v1';
const OLD_STORE_KEY = 'zephyr_thread_v1';
let chatStore = { active: null, chats: [] };

function newChatEntry() {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: 'New chat', msgs: [], updatedAt: Date.now() };
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s && Array.isArray(s.chats)) {
      // Drop any corrupted entries (null / missing fields) so one bad row can't
      // throw later and take the whole app boot down with it.
      const chats = s.chats.filter((c) => c && typeof c === 'object' && c.id).map((c) => ({
        ...c,
        title: typeof c.title === 'string' ? c.title : 'New chat',
        msgs: Array.isArray(c.msgs) ? c.msgs : [],
      }));
      if (chats.length) chatStore = { active: s.active, chats };
    }
  } catch {}
  // Migrate the old single-thread format into chat #1.
  if (!chatStore.chats.length) {
    let old = [];
    try { old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || '[]'); } catch {}
    const first = newChatEntry();
    if (old.length) {
      first.msgs = old;
      const firstUser = old.find((m) => m.t === 'user');
      if (firstUser) first.title = firstUser.text.slice(0, 30);
    }
    chatStore = { active: first.id, chats: [first] };
    try { localStorage.removeItem(OLD_STORE_KEY); } catch {}
    persistStore();
  }
  if (!chatStore.chats.some((c) => c.id === chatStore.active)) chatStore.active = chatStore.chats[0].id;
}

function persistStore() {
  try {
    const slim = {
      active: chatStore.active,
      chats: chatStore.chats.slice(0, 30).map((c) => ({ ...c, msgs: c.msgs.slice(-80) })),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(slim));
  } catch {}
}

// ── Cross-device chat sync ─────────────────────────────────────────────
// One row per chat in Supabase (RLS: owner only), last-write-wins by the
// client-stamped updatedAt. localStorage stays the instant-boot cache; the
// server is the durable copy that follows the account.
const SYNC_ENDPOINT = SUPABASE_URL + '/rest/v1/chats';
const syncDirty = new Set();
const syncDeleted = new Set();
let syncTimer = null;

// Deletion tombstones: without them a chat deleted on one device gets re-pushed
// by another (it's still local there but gone from the server) and resurrects.
// A locally-recorded tombstone stops this device from re-adding a chat it just
// deleted during a pull race; the per-chat `synced` flag stops the OTHER device
// from re-uploading a chat the server no longer has. Pruned after 45 days.
const CHAT_TOMB_KEY = 'zephyr_chat_tombstones_v1';
function tombLoad() { try { const m = JSON.parse(localStorage.getItem(CHAT_TOMB_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } }
function tombAdd(id) {
  const now = Date.now(); const map = tombLoad(); map[id] = now;
  for (const k of Object.keys(map)) if (now - map[k] > 45 * 24 * 3600e3) delete map[k];
  try { localStorage.setItem(CHAT_TOMB_KEY, JSON.stringify(map)); } catch {}
}
function tombHas(id) { return Object.prototype.hasOwnProperty.call(tombLoad(), id); }
let lastPull = 0;
let pendingFirstMsg = null; // a ?q= prompt held until a signed-out visitor logs in

// Reschedule a push (used when a flush rejects and the dirty set was requeued),
// so those edits get another try instead of waiting for the next manual touch.
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChats, 5000);
}

function touchSync(chatId) {
  const c = chatStore.chats.find((x) => x.id === chatId);
  if (c) c.updatedAt = Date.now();
  syncDeleted.delete(chatId);
  syncDirty.add(chatId);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChats, 1500);
}

function deleteSync(chatId) {
  syncDirty.delete(chatId);
  syncDeleted.add(chatId);
  tombAdd(chatId); // remember it's deleted so a pull can't resurrect it
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChats, 800);
}

async function syncHeaders() {
  if (!window.Auth || !Auth.isSignedIn()) return null;
  const token = await Auth.accessToken();
  if (!token) return null;
  return { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token };
}

async function pushChats() {
  const h = await syncHeaders();
  if (!h) return;
  const ids = [...syncDirty]; syncDirty.clear();
  const dels = [...syncDeleted]; syncDeleted.clear();
  const rows = ids.map((id) => chatStore.chats.find((c) => c.id === id)).filter(Boolean).map((c) => ({
    id: c.id,
    title: (c.title || 'New chat').slice(0, 120),
    brief: c.brief || null,
    last_prompt: c.lastPrompt || null,
    msgs: c.msgs.slice(-80),
    updated_at: new Date(c.updatedAt || Date.now()).toISOString(),
  }));
  try {
    if (rows.length) {
      const up = await fetch(SYNC_ENDPOINT + '?on_conflict=user_id,id', {
        method: 'POST',
        headers: Object.assign({}, h, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(rows),
      });
      // A rejected upsert (expired token, 4xx) must requeue — the dirty set was
      // already cleared, so without this those edits would never sync.
      if (!up.ok) { ids.forEach((id) => syncDirty.add(id)); scheduleSync(); }
      // Confirmed on the server: mark synced so a later pull won't mistake a
      // server-side deletion (chat absent from rows) for a never-synced chat
      // and re-upload it.
      else ids.forEach((id) => { const c = chatStore.chats.find((x) => x.id === id); if (c) c.synced = true; });
    }
    for (const id of dels) {
      const dr = await fetch(SYNC_ENDPOINT + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: h });
      if (!dr.ok) { syncDeleted.add(id); scheduleSync(); }
    }
  } catch {
    // Network hiccup — requeue everything for the next flush.
    ids.forEach((id) => syncDirty.add(id));
    dels.forEach((id) => syncDeleted.add(id));
    scheduleSync();
  }
}

// Union two message arrays by content: keep the winner's order, append any
// messages the loser had that the winner lacks. Stops a clock-skewed
// last-write-wins from silently dropping messages. Capped to the 80-msg window.
function mergeMsgs(winner, loser) {
  const key = (m) => (m.t || '') + '|' + (m.url || m.text || m.prompt || '') + '|' + (m.ts || m.at || '');
  const have = new Set((winner || []).map(key));
  const extra = (loser || []).filter((m) => m && !have.has(key(m)));
  return extra.length ? [...winner, ...extra].slice(-80) : (winner || []);
}

async function pullChats() {
  const h = await syncHeaders();
  if (!h) return;
  lastPull = Date.now();
  let rows;
  try {
    const res = await fetch(SYNC_ENDPOINT + '?select=id,title,brief,last_prompt,msgs,updated_at&order=updated_at.desc&limit=30', { headers: h });
    if (!res.ok) return;
    rows = await res.json();
  } catch { return; }
  if (!Array.isArray(rows)) return;
  let changed = false;
  rows.forEach((r) => {
    // A row we deleted locally but whose DELETE hasn't landed yet: don't re-add.
    if (tombHas(r.id)) return;
    const remoteAt = Date.parse(r.updated_at) || 0;
    const local = chatStore.chats.find((c) => c.id === r.id);
    if (!local) {
      chatStore.chats.push({
        id: r.id, title: r.title || 'New chat', brief: r.brief || undefined,
        lastPrompt: r.last_prompt || undefined,
        msgs: Array.isArray(r.msgs) ? r.msgs : [], updatedAt: remoteAt, synced: true,
      });
      changed = true;
    } else if (remoteAt > (local.updatedAt || 0)) {
      local.title = r.title || local.title;
      local.brief = r.brief || undefined;
      local.lastPrompt = r.last_prompt || undefined;
      // Merge, don't wholesale-replace: a remote that "wins" only by a skewed
      // clock must not drop messages this device has and the remote lacks.
      let gainedLocal = false;
      if (Array.isArray(r.msgs)) {
        const merged = mergeMsgs(r.msgs, local.msgs);
        gainedLocal = merged.length > r.msgs.length; // we hold messages the server lacked
        local.msgs = merged;
      }
      // If we merged in local-only messages, advance the timestamp so the union
      // actually propagates — reusing remoteAt would look "in sync" everywhere
      // else and the merge would never reach other devices.
      if (gainedLocal) { local.updatedAt = Date.now(); syncDirty.add(local.id); }
      else local.updatedAt = remoteAt;
      local.synced = true;
      changed = true;
    } else if ((local.updatedAt || 0) > remoteAt) {
      local.synced = true;
      syncDirty.add(local.id); // local is ahead — push it back up
    } else {
      local.synced = true; // in sync — confirmed present on the server
    }
  });
  // Push up only chats the server has NEVER acknowledged: a previously-synced
  // chat that's absent from rows was deleted elsewhere (or is beyond the 30-row
  // window) — re-pushing it would resurrect a deletion, so leave it be.
  chatStore.chats.forEach((c) => {
    if (c.msgs.length && !c.synced && !tombHas(c.id) && !rows.some((r) => r.id === c.id)) syncDirty.add(c.id);
  });
  if (syncDirty.size) { clearTimeout(syncTimer); syncTimer = setTimeout(pushChats, 1200); }
  if (changed) {
    chatStore.chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!chatStore.chats.find((c) => c.id === chatStore.active)) {
      chatStore.active = (chatStore.chats[0] || {}).id || null;
    }
    persistStore();
    renderChatList();
    // Don't rebuild the active thread out from under a live generation, a
    // streaming director reply, or a pending review card — that would detach
    // DOM-only UI mid-flight and throw. The list still reflects the sync.
    const busy = activeGens.has(chatStore.active) ||
      document.querySelector('#messages .typing, #messages .review-card, #genLoader');
    if (!busy) renderThread();
  }
}

// Freshen when returning to the tab; flush pending writes when leaving it.
window.addEventListener('focus', () => { if (Date.now() - lastPull > 30000) pullChats(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushChats(); });

function activeChat() {
  return chatStore.chats.find((c) => c.id === chatStore.active);
}

function pushSaved(item) {
  const chat = activeChat();
  if (!chat) return;
  chat.msgs.push(item);
  if (chat.title === 'New chat' && item.t === 'user') {
    chat.title = item.text.slice(0, 30);
    renderChatList();
  }
  persistStore();
  touchSync(chat.id);
}

function renderSaved(item) {
  if (item.t === 'media') { threadAppend(buildMedia(item.kind, item.url, item.prompt)); return; }
  if (item.t === 'review') { threadAppend(buildReviewCard(item.prompt, item.mode)); return; }
  const div = document.createElement('div');
  div.className = 'msg ' + item.t;
  div.textContent = item.text;
  addCopyBtn(div, item.text);
  threadAppend(div);
  if (item.t === 'user' || item.t === 'agent') threadAppend(msgStamp(item.t, item.ts));
}

function renderThread() {
  const box = document.getElementById('messages');
  box.innerHTML = '';
  clearQDock(); // the dock card belongs to the flow that opened it, not the next chat
  const chat = activeChat();
  if (chat && chat.msgs.length) chat.msgs.forEach(renderSaved);
  // If this chat has a generation in flight, bring its loader back and keep
  // its send button locked; other chats stay free to send.
  mountGenLoader();
  updateSendLock();
  toggleHomeHero(!(chat && chat.msgs.length));
}

// Empty-state hero: greeting + starter chips, shown only while the active
// chat has no messages yet.
function toggleHomeHero(show) {
  const hero = document.getElementById('homeHero');
  if (hero) hero.classList.toggle('gone', !show);
}

function renderChatList() {
  const list = document.getElementById('chatList');
  if (!list) return;
  list.innerHTML = '';
  // Filter by the sidebar search box — matches titles and message text.
  const q = (document.getElementById('chatSearch')?.value || '').trim().toLowerCase();
  const shown = !q ? chatStore.chats : chatStore.chats.filter((c) =>
    c.title.toLowerCase().includes(q) ||
    c.msgs.some((m) => (m.t === 'user' || m.t === 'agent') && String(m.text || '').toLowerCase().includes(q)));
  if (q && !shown.length) {
    const none = document.createElement('div');
    none.className = 'chat-empty';
    none.textContent = 'No chats found';
    list.appendChild(none);
    return;
  }
  shown.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === chatStore.active ? ' active' : '');
    const title = document.createElement('span');
    title.className = 'chat-title';
    title.textContent = c.title;
    const del = document.createElement('button');
    del.className = 'chat-del'; del.type = 'button'; del.title = 'Delete chat'; del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); deleteChat(c.id); };
    item.onclick = () => switchChat(c.id);
    item.appendChild(title); item.appendChild(del);
    list.appendChild(item);
  });
}

function switchChat(id) {
  if (id === chatStore.active) return;
  chatStore.active = id;
  persistStore();
  renderChatList();
  renderThread();
  document.getElementById('input').focus();
}

function deleteChat(id) {
  // Cancel any in-flight generation for this chat first — otherwise its output
  // would land in storage with no chat to show it (unreachable forever).
  if (activeGens.has(id)) cancelGen(id);
  chatStore.chats = chatStore.chats.filter((c) => c.id !== id);
  if (!chatStore.chats.length) chatStore.chats = [newChatEntry()];
  if (chatStore.active === id) chatStore.active = chatStore.chats[0].id;
  persistStore();
  deleteSync(id);
  renderChatList();
  renderThread();
}

// A generation can finish after the user has moved to another chat — deliver
// its output to the chat that started it, and only render if still there.
function saveToChat(chatId, item) {
  const chat = chatStore.chats.find((c) => c.id === chatId);
  if (!chat) return;
  chat.msgs.push(item);
  persistStore();
  touchSync(chat.id);
}
function deliverAgent(chatId, text) {
  if (chatStore.active === chatId) addMsg('agent', text);
  else saveToChat(chatId, { t: 'agent', text, ts: Date.now() }); // stamp so re-render/merge keys are unique
}
function deliverMedia(chatId, kind, url, prompt) {
  saveToChat(chatId, { t: 'media', kind, url, at: Date.now(), prompt: prompt ? String(prompt).slice(0, 300) : undefined });
  if (chatStore.active === chatId) {
    // Fresh generations land with a soft gradient pulse (live only — saved
    // media re-renders without it).
    const el = buildMedia(kind, url, prompt);
    el.classList.add('landed');
    el.addEventListener('animationend', () => el.classList.remove('landed'), { once: true });
    threadAppend(el);
  }
}

// ── Generated media: element + download + full-screen actions ──
function buildMedia(kind, url, prompt) {
  const div = document.createElement('div');
  div.className = 'msg agent ' + kind;
  let el;
  if (kind === 'image') {
    el = document.createElement('img');
    el.src = url; el.alt = '';
    el.addEventListener('click', () => openLightbox('image', url));
  } else if (kind === 'audio') {
    el = document.createElement('audio');
    el.controls = true; el.src = url;
  } else {
    el = document.createElement('video');
    el.controls = true; el.src = url; el.playsInline = true;
  }
  div.appendChild(el);
  // Free accounts: on-screen mark over the video player. Only when we KNOW the
  // account is free — otherwise refreshVideoBadges() adds it once credits load,
  // so a paid user never flashes a watermark at boot.
  if (kind === 'video' && paidKnown && !isPaid) div.appendChild(wmBadge());

  const actions = document.createElement('div');
  actions.className = 'media-actions';
  if (kind !== 'audio') {
    const exp = document.createElement('button');
    exp.className = 'media-btn'; exp.type = 'button'; exp.title = 'Full screen'; exp.textContent = '⛶';
    exp.onclick = (e) => { e.stopPropagation(); openLightbox(kind, url); };
    actions.appendChild(exp);
  }
  const dl = document.createElement('button');
  dl.className = 'media-btn'; dl.type = 'button'; dl.title = 'Download'; dl.textContent = '⤓';
  dl.onclick = (e) => { e.stopPropagation(); downloadMedia(url, kind); };
  actions.appendChild(dl);
  const del = document.createElement('button');
  del.className = 'media-btn'; del.type = 'button'; del.title = 'Delete'; del.textContent = '🗑';
  del.onclick = (e) => { e.stopPropagation(); deleteMedia(div, url); };
  actions.appendChild(del);
  div.appendChild(actions);
  return div;
}

// Remove a generation from the chat and (if it lives in our storage) from
// the gallery bucket too — RLS only lets users delete their own files.
async function deleteMedia(el, url) {
  if (!confirm('Delete this from your chat and gallery?')) return;
  el.remove();
  const chat = activeChat();
  if (chat) {
    const i = chat.msgs.findIndex((m) => m.t === 'media' && m.url === url);
    if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
  }
  const m = url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  if (m && window.Auth) { try { await Auth.storageDelete(m[1]); } catch {} }
}

async function downloadMedia(url, kind) {
  const known = url.split('?')[0].match(/\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav|ogg|m4a)$/i);
  const ext = known ? known[1].toLowerCase() : (kind === 'image' ? 'png' : kind === 'audio' ? 'mp3' : 'mp4');
  const name = 'zephyr-' + Date.now() + '.' + ext;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 5000);
  } catch {
    window.open(url, '_blank', 'noopener'); // cross-origin fallback
  }
}

// ── Full-screen lightbox (images & videos) ──
let lightboxEl = null;
function openLightbox(kind, url) {
  if (!lightboxEl) {
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox';
    lightboxEl.innerHTML =
      '<button class="lb-dl" type="button" title="Download">⤓</button>' +
      '<button class="lb-close" type="button" title="Close" aria-label="Close">×</button>' +
      '<div class="lb-stage"></div>';
    lightboxEl.addEventListener('click', (e) => { if (e.target === lightboxEl) closeLightbox(); });
    lightboxEl.querySelector('.lb-close').onclick = closeLightbox;
    document.body.appendChild(lightboxEl);
  }
  const stage = lightboxEl.querySelector('.lb-stage');
  stage.innerHTML = '';
  // Spinner until the media has actually loaded (big videos buffer slowly).
  const spin = document.createElement('div');
  spin.className = 'lb-loading';
  stage.appendChild(spin);
  const ready = () => spin.remove();
  let el;
  if (kind === 'image') { el = document.createElement('img'); el.onload = ready; el.onerror = ready; el.src = url; }
  else {
    el = document.createElement('video');
    el.controls = true; el.autoplay = true; el.playsInline = true;
    el.onloadeddata = ready; el.onerror = ready;
    el.src = url;
  }
  stage.appendChild(el);
  // Free accounts: keep the mark on full-screen playback too (images carry
  // theirs in the pixels, so only video needs the overlay).
  stage.classList.toggle('wm-spot', kind !== 'image');
  if (kind !== 'image' && paidKnown && !isPaid) stage.appendChild(wmBadge());
  lightboxEl.querySelector('.lb-dl').onclick = () => downloadMedia(url, kind);
  lightboxEl.classList.add('open');
}
function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.classList.remove('open');
  lightboxEl.querySelector('.lb-stage').innerHTML = ''; // stop playback
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
// Escape closes any open overlay via its own close control (so the welcome
// modal still records its dismiss, etc.).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ov = document.querySelector('.credits-overlay, .gal-overlay');
  if (!ov) return;
  const close = ov.querySelector('.up-close, .cp-close, .wm-x, .gal-close');
  if (close) close.click(); else ov.remove();
});
// The sidebar nav + wordmark are divs acting as buttons — make them focusable
// and operable by keyboard (Enter/Space), with a delegated activator.
document.querySelectorAll('.side-item, .side-logo').forEach((el) => {
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el && el.classList && (el.classList.contains('side-item') || el.classList.contains('side-logo'))) {
    e.preventDefault(); el.click();
  }
});

// Progress theater: while fal renders, the status line plays out a film set —
// one director beat per poll tick (~4s), cycling until the take is done.
const THEATER = {
  video: ['Scouting the location…', 'Setting up the lights…', 'Blocking the shot…', 'Rolling camera…', 'Directing the take…', 'Watching the monitor…', 'Color grading the frames…', 'Cutting the final take…'],
  image: ['Sketching the composition…', 'Mixing the palette…', 'Setting the lighting…', 'Painting in the details…', 'Sharpening the focus…', 'Adding final touches…'],
  audio: ['Warming up the voice…', 'Finding the right tone…', 'Recording the take…', 'Listening back…', 'Mastering the sound…'],
};
function theaterLine(gen, kind) {
  const lines = THEATER[kind] || THEATER.video;
  gen.li = gen.li == null ? 0 : gen.li + 1;
  return lines[gen.li % lines.length];
}

// Animated placeholder shown while a generation runs: a shimmering skeleton
// (or bouncing bars for audio) + a spinning ring and the live status text.
function makeLoader(kind, aspect) {
  const wrap = document.createElement('div');
  wrap.className = 'msg agent gen-loading';

  let visual;
  if (kind === 'audio') {
    visual = document.createElement('div');
    visual.className = 'gen-bars';
    for (let i = 0; i < 13; i++) {
      const b = document.createElement('span');
      b.style.animationDelay = (i * 0.07) + 's';
      visual.appendChild(b);
    }
  } else {
    visual = document.createElement('div');
    visual.className = 'gen-shimmer';
    const ar = aspect || ratioAspect(ratio);
    visual.style.aspectRatio = ar;
    // A single scan line sweeps a coordinate grid — the frame being "scanned in".
    const arLabel = String(ar || '').replace(/\s*\/\s*/, ':');
    visual.innerHTML = '<i class="gen-scanline"></i>'
      + '<span class="gen-scan-tag tl">SCAN</span>'
      + (arLabel ? '<span class="gen-scan-tag br">' + arLabel + '</span>' : '');
  }

  const prog = document.createElement('div');
  prog.className = 'gen-prog';
  prog.innerHTML = '<i></i>';

  const status = document.createElement('div');
  status.className = 'gen-status';
  status.innerHTML = '<span class="gen-spinner"></span><span class="gen-status-text"></span><span class="gen-model"></span>';

  wrap.appendChild(visual);
  wrap.appendChild(prog);
  wrap.appendChild(status);
  const box = document.getElementById('messages');
  box.appendChild(wrap);
  box.parentElement.scrollTop = box.parentElement.scrollHeight;
  return { el: wrap, setText: (t) => { wrap.querySelector('.gen-status-text').textContent = t; } };
}

// One generation may run per chat; each chat locks its own send button and
// shows its own loader, which is re-mounted when you switch back to it.
const activeGens = new Map(); // chatId → { kind, aspect, text }

function mountGenLoader() {
  const gen = activeGens.get(chatStore.active);
  if (!gen || document.getElementById('genLoader')) return;
  const l = makeLoader(gen.kind, gen.aspect);
  l.el.id = 'genLoader';
  l.setText(gen.text);
  const gm = l.el.querySelector('.gen-model');
  if (gm) gm.textContent = gen.model || '';
}
function setGenText(chatId, t) {
  const gen = activeGens.get(chatId);
  if (gen) gen.text = t;
  if (chatStore.active === chatId) {
    const el = document.querySelector('#genLoader .gen-status-text');
    if (el && el.textContent !== t) {
      el.textContent = t;
      // retrigger the little rise-in so each new beat visibly lands
      el.classList.remove('flip');
      void el.offsetWidth;
      el.classList.add('flip');
    }
    const gm = document.querySelector('#genLoader .gen-model');
    if (gm) gm.textContent = (gen && gen.model) || '';
  }
}
function endGen(chatId) {
  activeGens.delete(chatId);
  jobClear(chatId);
  if (chatStore.active === chatId) {
    const el = document.getElementById('genLoader');
    if (el) el.remove();
  }
  updateSendLock();
}
// Soft stop: drop the in-memory run + loader but KEEP the refresh-proof job
// record, so a run interrupted by a network drop (not a terminal state) is
// resumed at the next app boot instead of being lost after it was charged.
function pauseGen(chatId) {
  activeGens.delete(chatId);
  if (chatStore.active === chatId) {
    const el = document.getElementById('genLoader');
    if (el) el.remove();
  }
  updateSendLock();
}

// ── Refresh-proof generations & gallery saves ──────────────────────────────
// Every submitted fal job stays on record until it ends, so a closed or
// refreshed tab resumes polling at the next boot instead of losing a paid
// render. Gallery copies that fail queue here too and retry at boot,
// swapping the temporary fal URL for the permanent one wherever it landed.
const JOBS_KEY = 'zephyr_jobs_v1';
const SAVES_KEY = 'zephyr_pending_saves_v1';

function jobsLoad() { try { return JSON.parse(localStorage.getItem(JOBS_KEY) || '[]'); } catch { return []; } }
function jobsWrite(list) { try { localStorage.setItem(JOBS_KEY, JSON.stringify(list.slice(-8))); } catch {} }
function jobRecord(chatId, rec) { jobsWrite([...jobsLoad().filter((j) => j.chatId !== chatId), { chatId, ...rec }]); }
function jobClear(chatId) { jobsWrite(jobsLoad().filter((j) => j.chatId !== chatId)); }
// Count a failed-to-complete resume so a permanently-dead job is eventually
// abandoned instead of re-polled every boot forever.
function jobBumpTries(chatId) { jobsWrite(jobsLoad().map((j) => j.chatId === chatId ? { ...j, tries: (j.tries || 0) + 1 } : j)); }

function savesLoad() { try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch { return []; } }
function savesWrite(list) { try { localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(-20))); } catch {} }
function queuePendingSave(url, kind) { savesWrite([...savesLoad().filter((p) => p.url !== url), { url, kind, at: Date.now() }]); }

// Cross-tab delivery claim: two tabs of the same account can each resume the
// same job record and both poll it. The first to reach COMPLETED claims the
// result key (the fal status URL) in shared localStorage; the other sees the
// claim and skips save+deliver, so a job is copied and shown exactly once.
const DELIVERED_KEY = 'zephyr_delivered_v1';
function claimDelivery(key) {
  try {
    const now = Date.now();
    const map = JSON.parse(localStorage.getItem(DELIVERED_KEY) || '{}');
    if (map[key] && now - map[key] < 3600e3) return false; // already claimed recently
    map[key] = now;
    // Keep the map small — drop entries older than a day.
    for (const k of Object.keys(map)) if (now - map[k] > 86400e3) delete map[k];
    localStorage.setItem(DELIVERED_KEY, JSON.stringify(map));
    return true;
  } catch { return true; } // storage broken → don't block delivery
}

// Copy a fal output into permanent Supabase Storage, with bounded retries —
// a failed copy must never silently become the permanent record.
// Set by trySave when a save is refused for a non-transient reason (402):
// 'free' = gallery saving is a paid benefit, 'full' = tier storage cap hit.
// Callers read it to show the right message and skip the retry queue.
let lastSaveBlock = null;
async function trySave(url, kind, attempts, payload) {
  lastSaveBlock = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const sv = await apiFetch('/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || { url, kind }),
      });
      if (sv.ok) { const d = await sv.json(); if (d.url) return d.url; }
      if (sv.status === 401) return null; // signed out — retrying now won't help
      if (sv.status === 402) { // over cap / not entitled — retrying won't help
        try { lastSaveBlock = { reason: (await sv.json()).reason || 'full' }; }
        catch { lastSaveBlock = { reason: 'full' }; }
        return null;
      }
    } catch {}
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

// Save one output: free-account images are watermarked server-side by /api/save
// (see worker.js). The client hands over the fal URL and the returned permanent
// copy — the one the app then displays — already carries the mark.
async function saveOutput(u, kind) {
  // Free-account images are watermarked server-side by /api/save now (the mark
  // is burned into the stored copy the app then displays), so the client just
  // hands over the URL — no canvas burn, no client-trust to bypass.
  return trySave(u, kind, 3);
}

// Swap a temporary fal URL for its permanent copy wherever it was stored.
function replaceMediaUrl(oldUrl, newUrl) {
  let hit = false;
  chatStore.chats.forEach((c) => c.msgs.forEach((m) => {
    if (m.url === oldUrl) { m.url = newUrl; hit = true; touchSync(c.id); }
  }));
  if (hit) {
    persistStore();
    const dock = document.getElementById('qDock');
    if (!dock || !dock.children.length) renderThread();
  }
  try { // Studio shots too (sb / sbSave are studio.js globals on this page)
    if (typeof sb !== 'undefined' && sb && Array.isArray(sb.projects)) {
      let sHit = false;
      sb.projects.forEach((p) => (p.shots || []).forEach((s) => {
        if (s.url === oldUrl) { s.url = newUrl; sHit = true; }
      }));
      if (sHit && typeof sbSave === 'function') sbSave();
    }
  } catch {}
}

// Boot: retry gallery copies that failed, while their fal URL is still alive.
async function retryPendingSaves() {
  const list = savesLoad();
  if (!list.length) return;
  const keep = [];
  for (const p of list) {
    if (Date.now() - (p.at || 0) > 6 * 24 * 3600e3) continue; // fal URL long dead
    // saveOutput just posts the URL; the server watermarks free-account images.
    const perm = await saveOutput(p.url, p.kind);
    if (perm) replaceMediaUrl(p.url, perm);
    else if (lastSaveBlock) { /* paid gate (free/full) — retrying won't help, drop it */ }
    else keep.push(p);
  }
  savesWrite(keep);
}

// Boot: pick up any generation that was in flight when the tab last died.
function resumeJobs() {
  const jobs = jobsLoad().filter((j) => j.chatId && j.statusUrl && j.responseUrl);
  // Give up on a record that has been paused (network-dead) several boots
  // running — its fal URL is almost certainly gone, so stop re-polling forever.
  const live = jobs.filter((j) => (j.tries || 0) < 4);
  jobsWrite(live);
  live.forEach((j) => {
    if (activeGens.has(j.chatId)) return;
    const kind = j.kind || 'video';
    const myGen = { kind, aspect: j.aspect, text: 'Checking on your ' + kind + '…', statusUrl: j.statusUrl };
    activeGens.set(j.chatId, myGen);
    updateSendLock();
    mountGenLoader();
    // Give even a stale job a real chance — fal keeps results around for days,
    // and a 4K render may still be going, so floor the resumed window at 5 min.
    const deadline = Math.max(Date.now() + 5 * 60000, j.deadline || 0);
    const mins = Math.max(5, Math.round((deadline - Date.now()) / 60000));
    pollAndDeliver(j.chatId, kind, j.statusUrl, j.responseUrl, j.text || '', j.label || 'the model', deadline, mins, myGen, false);
  });
}

// While the active chat is generating, the send arrow becomes a stop square.
const ARROW_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const STOP_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>';
function updateSendLock() {
  const btn = document.getElementById('sendBtn');
  const busy = activeGens.has(chatStore.active);
  btn.disabled = false;
  btn.title = busy ? 'Stop generating' : 'Send';
  btn.innerHTML = busy ? STOP_SVG : ARROW_SVG + '<span class="send-price" id="sendPrice"></span>';
  if (!busy) updateSendPrice();
}

// ── Send-button price tag — estimates from fal's published pricing ────────
// Video: $/sec by resolution (audio-on rates where the model does audio).
const VIDEO_PRICE = {
  'fal-ai/veo3.1':                                { s: { '720p': 0.40, '1080p': 0.40, '4k': 0.60 } },
  'fal-ai/sora-2/text-to-video/pro':              { s: { '720p': 0.30, '1080p': 0.50 } },
  'bytedance/seedance-2.0/text-to-video':         { s: { '480p': 0.14, '720p': 0.30, '1080p': 0.68, '4k': 1.59 } },
  'bytedance/seedance-2.0/fast/text-to-video':    { s: { '480p': 0.11, '720p': 0.24, '1080p': 0.55 } },
  'bytedance/seedance-2.0/mini/text-to-video':    { s: { '480p': 0.07, '720p': 0.155 } },
  'fal-ai/kling-video/o3/pro/text-to-video':      { s: { def: 0.14 } },
  'fal-ai/kling-video/v3/pro/text-to-video':      { s: { def: 0.168 } },
  'fal-ai/kling-video/v3/standard/text-to-video': { s: { def: 0.126 } },
  'fal-ai/minimax/hailuo-2.3/pro/text-to-video':  { flat: 0.49 },
  'xai/grok-imagine-video/text-to-video':         { s: { '480p': 0.05, '720p': 0.07, def: 0.07 } },
  'google/gemini-omni-flash':                     { s: { def: 0.13 } },
  'fal-ai/bytedance/omnihuman':                   { audioPerSec: 0.14 },  // fal bills by driving-audio length
  'fal-ai/kling-video/lipsync/audio-to-video':    { audioPer5s: 0.014 },  // fal bills per 5-second increment
};
const IMAGE_PRICE = { // $ per image
  'fal-ai/flux-2-pro': 0.03,
  'fal-ai/gemini-3-pro-image-preview': 0.15,
  'fal-ai/bytedance/seedream/v4/text-to-image': 0.03,
  'fal-ai/recraft/v3/text-to-image': 0.04,
  'google/nano-banana-2': 0.08,
  'fal-ai/nano-banana-pro': 0.15,
  'openai/gpt-image-2': 0.12, // token-billed; high quality 1024² lands about here
  'fal-ai/flux/dev': 0.025,
  'fal-ai/krea-2/turbo': 0.008,
  'xai/grok-imagine-image': 0.022,
};
const AUDIO_PRICE = { // $ per 1,000 characters spoken
  'fal-ai/elevenlabs/tts/eleven-v3': 0.10,
  'fal-ai/elevenlabs/tts/turbo-v2.5': 0.05,
  'fal-ai/elevenlabs/tts/multilingual-v2': 0.10,
};

// 1 credit = $0.008 — same conversion the worker charges with.
// Director surcharge at cost (must match worker directorCr): +1 credit on
// the Haiku levels (Low/Medium), +2 on the Sonnet levels (High/Ultra/Max).
const CREDIT_USD = 0.008;
function directorCr() {
  if (directorMode === 'off') return 0; // raw prompting — no Claude in the loop
  return effort === 'high' || effort === 'ultra' || effort === 'max' ? 2 : 1;
}
function fmtPrice(usd) {
  return '✦ ' + (directorCr() + Math.max(1, Math.ceil(usd / CREDIT_USD))).toLocaleString();
}
function estimatePrice(textForAudio) {
  if (mode === 'image') {
    const per = IMAGE_PRICE[model];
    return per == null ? '' : fmtPrice(per * (numImages || 1));
  }
  if (mode === 'audio') {
    const per = AUDIO_PRICE[model];
    if (per == null) return '';
    // Price on the exact text being quoted (the review card passes the script;
    // the send button falls back to the live input). Match the server's cap.
    const raw = textForAudio != null ? textForAudio : (document.getElementById('input').value || '');
    const chars = Math.min(2000, raw.trim().length);
    return fmtPrice(Math.max(chars, 40) / 1000 * per);
  }
  const p = VIDEO_PRICE[model];
  if (!p) return '';
  // Audio-driven models bill by the attached clip's length (awDur, seconds).
  if (p.audioPerSec != null || p.audioPer5s != null) {
    const secs = Math.max(1, Math.min(60, Math.round(awDur || 0)));
    const usd = p.audioPerSec != null ? p.audioPerSec * secs : p.audioPer5s * Math.ceil(secs / 5);
    return fmtPrice(usd);
  }
  if (p.flat != null) return fmtPrice(p.flat);
  const rate = p.s[quality] != null ? p.s[quality] : p.s.def != null ? p.s.def : p.s['720p'];
  return rate == null ? '' : fmtPrice(rate * (duration || 5));
}
function updateSendPrice() {
  const el = document.getElementById('sendPrice');
  if (el) el.textContent = estimatePrice();
}

// ── Credit balance (server-owned; the chip is display only) ───────────────
// The arc gauge shows the balance against the highest balance this browser
// has seen (plan size / last top-up) — a fuel gauge that drains as you spend.
const CRED_MAX_KEY = 'zephyr_cred_max_v1';
const CRED_ARC_LEN = 37.7; // half-circle path length (π × r12)
// The on-screen VIDEO badge is tri-state: shown only when the account is KNOWN
// free. Until /api/credits resolves, `paidKnown` is false and we fail toward
// "paid" (no badge) so a slow/failed credits call never defaces a paying user.
// (Image watermarks don't depend on this — the server burns them on /api/save.)
let isPaid = false;
let paidKnown = false;
// The on-screen "✦ isibi.ai" mark free accounts see over video players —
// chat thread, gallery cards and the lightbox all carry it (class wm-spot
// marks the non-chat containers).
function wmBadge() {
  const wm = document.createElement('span');
  wm.className = 'wm-badge';
  wm.textContent = '✦ isibi.ai';
  return wm;
}
// Toggle the on-screen video badge on already-rendered clips once we learn the
// account's paid state (buildMedia renders none while `paidKnown` is false).
function refreshVideoBadges() {
  document.querySelectorAll('.msg.video, .wm-spot').forEach((div) => {
    const has = div.querySelector('.wm-badge');
    if (paidKnown && !isPaid && !has) {
      div.appendChild(wmBadge());
    } else if ((isPaid || !paidKnown) && has) {
      has.remove();
    }
  });
}
function setArcFill(el, frac) {
  if (el) el.style.strokeDashoffset = (CRED_ARC_LEN * (1 - frac)).toFixed(2);
}
function setCredits(n) {
  if (typeof n !== 'number') return;
  const txt = '✦ ' + n.toLocaleString();
  const el = document.getElementById('creditChip');
  if (el) el.textContent = txt;
  const pn = document.getElementById('credPillN');
  if (pn) pn.textContent = txt;
  let max = n;
  try {
    max = Math.max(n, parseInt(localStorage.getItem(CRED_MAX_KEY) || '0', 10) || 0);
    localStorage.setItem(CRED_MAX_KEY, String(max));
  } catch {}
  const frac = max > 0 ? Math.max(0, Math.min(1, n / max)) : 0;
  setArcFill(document.getElementById('credArc'), frac);
  setArcFill(document.getElementById('credArcMenu'), frac);
  const pill = document.getElementById('credPill');
  if (pill) pill.classList.add('show');
}
async function fetchCredits(attempt) {
  try {
    const r = await apiFetch('/api/credits');
    if (!r.ok) throw 0;
    const d = await r.json();
    if (typeof d.paid === 'boolean') {
      isPaid = d.paid; paidKnown = true; refreshVideoBadges();
      const pt = document.getElementById('planTag');
      if (pt) pt.textContent = isPaid ? 'Member' : 'Free plan';
    }
    if (typeof d.balance === 'number') { setCredits(d.balance); maybeShowWelcome(d.balance); }
  } catch {
    // Keep trying a few times so the paid flag (and balance) resolve — a
    // transient failure must not leave a paid user in the "unknown" state.
    const n = (attempt || 0) + 1;
    if (n <= 4) setTimeout(() => fetchCredits(n), 1500 * n);
  }
}

// One-time welcome banner for fresh accounts: makes the signup grant feel
// intentional and points at the plans. Shows only while the account still
// looks new (grant-sized balance, no chat history), until dismissed.
const WELCOME_KEY = 'zephyr_welcome_v1';
function maybeShowWelcome(balance) {
  try {
    if (localStorage.getItem(WELCOME_KEY)) return;
    if (isPaid) return; // never greet a paying member with the free-credits modal
    if (typeof balance !== 'number' || balance <= 0 || balance > 20) return;
    if ((chatStore.chats || []).some((c) => c.msgs && c.msgs.length)) return;
    if (document.querySelector('.credits-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'credits-overlay welcome-ov';
    ov.innerHTML = '<div class="wm-box">' +
      '<button type="button" class="wm-x" aria-label="Close">✕</button>' +
      '<div class="wm-star">✦</div>' +
      '<h2 class="wm-title">Welcome to isibi</h2>' +
      '<div class="wm-grant">' + balance + ' free credits, on us</div>' +
      '<p class="wm-sub">Enough for a few images or a voice line — every model, one balance. Ready for video? Plans start at $24.99/mo.</p>' +
      '<button type="button" class="wm-cta">Start generating</button>' +
    '</div>';
    const dismiss = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} ov.remove(); };
    ov.onclick = (e) => { if (e.target === ov) dismiss(); };
    ov.querySelector('.wm-x').onclick = dismiss;
    ov.querySelector('.wm-cta').onclick = () => {
      dismiss();
      showView('home');
      const inp = document.getElementById('input');
      if (inp) inp.focus();
    };
    document.body.appendChild(ov);
  } catch {}
}

// ── Membership panel: monthly credits, three tiers ─────────────────────────
// Feature matrix is a capacity ladder (all models on every tier; higher tiers
// buy room for more output). Strike prices are the launch-offer framing —
// the charged price is always `usd`.
// Output equivalences are DERIVED from the live price tables so they can never
// drift from what a generation actually costs: a Nano Banana 2 image and a
// 5-second Kling 3.0 Standard video, each with the default director surcharge.
const IMG_CR = Math.max(1, Math.ceil(0.08 / CREDIT_USD)) + 1;          // Nano Banana 2 + director
const VID_CR = Math.max(1, Math.ceil((0.126 * 5) / CREDIT_USD)) + 1;   // Kling 3.0 Std 5s + director
const roundTo = (n, step) => Math.round(n / step) * step;
const estImages = (cr) => roundTo(cr / IMG_CR, 10).toLocaleString();
const estVideos = (cr) => roundTo(cr / VID_CR, 5);
const MEMBERSHIPS = [
  { plan: '25', usd: 24.99, credits: 2000, name: 'Plus', klass: 't-plus', off: '10% OFF', strike: 28,
    desc: 'For getting started with AI creation',
    save: 'Save $3/mo while the launch offer lasts',
    feats: [1, 1, 1, 1, 0, 0] },
  { plan: '50', usd: 49.99, credits: 4000, name: 'Pro', klass: 't-pro best', off: '20% OFF', strike: 63, pop: 1,
    desc: 'For consistent, everyday creation',
    save: 'Save $13/mo while the launch offer lasts',
    feats: [1, 1, 1, 1, 1, 0] },
  { plan: '100', usd: 99.99, credits: 8000, name: 'Max', klass: 't-max', off: '25% OFF', val: 'Best value', strike: 133,
    desc: 'For creators building big projects',
    save: 'Save $33/mo while the launch offer lasts',
    feats: [1, 1, 1, 1, 1, 1] },
];
// Launch offer is a rolling window: it always ends N days out, computed at open
// time, so the countdown can never freeze into "Ends in soon".
const OFFER_WINDOW_DAYS = 5;
const MEMBER_ROWS = [
  'All video, image &amp; voice models',
  'No watermark on your files',
  'Unused credits roll over',
  'Cancel anytime',
  'Room for ~' + estVideos(4000) + ' videos a month',
  'Studio-scale — ~' + estVideos(8000) + ' videos a month',
];
const TOPUPS = [
  { topup: '15', usd: 15, credits: 1070 },
  { topup: '30', usd: 30, credits: 2140 },
  { topup: '50', usd: 50, credits: 3570 },
  { topup: '75', usd: 75, credits: 5350 },
  { topup: '100', usd: 100, credits: 7140 },
];
function openCredits(topupsOnly) {
  if (document.querySelector('.credits-overlay')) return;
  document.getElementById('profilePop')?.classList.remove('open'); // don't leave the menu open behind the overlay
  const ov = document.createElement('div');
  ov.className = 'credits-overlay' + (topupsOnly ? '' : ' up-overlay');
  // Full "Upgrade your plan" page: promo hero + three plan cards with feature
  // lists, modelled on the pricing mockup and kept in the isibi theme.
  const cards = MEMBERSHIPS.map((p) =>
    '<button type="button" class="up-card ' + p.klass + '" data-plan="' + p.plan + '">' +
      (p.pop ? '<div class="up-badge">★ Most popular</div>' : '') +
      '<div class="up-namerow">' +
        '<span class="up-pname">' + p.name + '</span>' +
        (p.off ? '<span class="up-chip off">' + p.off + '</span>' : '') +
        (p.val ? '<span class="up-chip val">✦ ' + p.val + '</span>' : '') +
      '</div>' +
      '<div class="up-desc">' + p.desc + '</div>' +
      '<div class="up-credbox">' +
        '<div class="up-credmain"><span class="up-star">✦</span> ' + p.credits.toLocaleString() + ' credits/mo.</div>' +
        '<div class="up-credroll">✓ Unused credits roll over</div>' +
      '</div>' +
      '<div class="up-priceline">' +
        (p.strike ? '<span class="up-strike">$' + p.strike + '</span>' : '') +
        '<span class="up-pprice">$' + p.usd + '</span>' +
        '<span class="up-permo">per month, cancel anytime</span>' +
      '</div>' +
      '<span class="up-buy">Get ' + p.name + '</span>' +
      '<div class="up-save">' + p.save + '</div>' +
      '<ul class="up-feat">' + MEMBER_ROWS.map((row, i) =>
        '<li class="' + (p.feats[i] ? 'ok' : 'no') + '">' + row + '</li>').join('') + '</ul>' +
    '</button>').join('');
  // Top-ups-only view (from the profile menu) is a quiet list — credits left,
  // price right, hairline separators.
  const rows = TOPUPS.map((p) =>
    '<button type="button" class="cp-lrow" data-topup="' + p.topup + '">' +
      '<span class="cp-lcr">✦ ' + p.credits.toLocaleString() + '</span>' +
      '<span class="cp-lusd">$' + p.usd + '</span>' +
    '</button>').join('');
  const inner = topupsOnly
    ? '<div class="cp-head"><div class="cp-title">Top-up credits</div><button type="button" class="cp-close">✕</button></div>' +
      '<div class="cp-list">' + rows + '</div>' +
      '<div class="cp-note" id="cpNote"></div>'
    : '<button type="button" class="cp-close up-close">✕</button>' +
      '<div class="up-promo">' +
        '<span class="up-spark s1">✦</span><span class="up-spark s2">✦</span>' +
        '<div class="up-tagrow">' +
          '<span class="up-tag">✦ Launch offer — up to 25% off</span>' +
          '<span class="up-count"><i></i>Ends in <b id="upCountT">—</b></span>' +
        '</div>' +
        '<h2 class="up-promo-h">Every model, <span class="up-grad">one balance.</span></h2>' +
        '<p class="up-promo-p">Video, image and voice from a single credit balance — unused credits roll over every month.</p>' +
        '<div class="up-models">' + ['Veo 3.1', 'Sora 2', 'Kling 3.0', 'Seedance 2.0', 'Nano Banana', 'ElevenLabs', '+ more'].map((m) => '<span class="up-mchip">' + m + '</span>').join('') + '</div>' +
        '<button type="button" class="up-hero-cta">Start with Pro →</button>' +
      '</div>' +
      '<div class="up-headwrap">' +
        '<div class="up-eyebrow">Membership</div>' +
        '<h1 class="up-h1">Upgrade your plan</h1>' +
        '<p class="up-sub">Fresh credits every month at a better rate than one-time top-ups — unused credits roll over, and you can cancel anytime.</p>' +
      '</div>' +
      '<div class="up-grid">' + cards + '</div>' +
      '<div class="cp-note up-note" id="cpNote"></div>' +
      '<div class="up-trust"><span>Secure checkout</span><span>Cancel anytime</span><span>Every model included</span><span>Credits roll over</span></div>' +
      '<div class="up-topnote">Just need a one-off? <button type="button" class="up-topup-link">Grab a one-time top-up →</button></div>';
  ov.innerHTML = '<div class="cp-box' + (topupsOnly ? ' cp-narrow' : ' cp-wide') + '">' + inner + '</div>';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.querySelector('.cp-close').onclick = () => ov.remove();
  const topupLink = ov.querySelector('.up-topup-link');
  if (topupLink) topupLink.onclick = () => { ov.remove(); openCredits(true); };
  const heroCta = ov.querySelector('.up-hero-cta');
  if (heroCta) heroCta.onclick = () => { const pro = ov.querySelector('.up-card.best'); if (pro) pro.click(); };
  // Live launch-offer countdown; the interval dies with the overlay.
  const cEl = ov.querySelector('#upCountT');
  if (cEl) {
    // Rolling per-browser window: anchor to a stored end date; if it's missing
    // or already elapsed, start a fresh N-day window. The clock always shows a
    // real, consistent countdown and never freezes into a broken "soon".
    const OFFER_KEY = 'zephyr_offer_end_v1';
    let end = parseInt(localStorage.getItem(OFFER_KEY) || '0', 10) || 0;
    if (!end || end - Date.now() <= 0) {
      end = Date.now() + OFFER_WINDOW_DAYS * 86400000;
      try { localStorage.setItem(OFFER_KEY, String(end)); } catch {}
    }
    const two = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      cEl.textContent = (d ? d + 'd ' : '') + two(h) + ':' + two(m) + ':' + two(s);
    };
    tick();
    const tid = setInterval(() => {
      if (!document.body.contains(ov)) { clearInterval(tid); return; }
      tick();
    }, 1000);
  }
  ov.querySelectorAll('.cp-card, .cp-lrow, .up-card').forEach((c) => {
    c.onclick = async () => {
      const note = document.getElementById('cpNote');
      note.textContent = 'Opening secure checkout…';
      try {
        const r = await apiFetch('/api/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c.dataset.plan ? { plan: c.dataset.plan } : { topup: c.dataset.topup }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 501) { note.textContent = 'Payments are switching on very soon — this is where you\'ll buy them.'; return; }
        if (r.ok && d.url) { note.textContent = 'Taking you to checkout…'; location.href = d.url; return; }
        note.textContent = 'Checkout hit a snag — try again in a moment.';
      } catch {
        note.textContent = 'Checkout hit a snag — try again in a moment.';
      }
    };
  });
  document.body.appendChild(ov);
}

// Stop a chat's generation: kill the fal job too (queued jobs never bill),
// drop the loader, and free the chat.
function cancelGen(chatId) {
  const gen = activeGens.get(chatId);
  if (!gen) return;
  if (gen.statusUrl) {
    apiFetch('/api/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: gen.statusUrl.replace(/\/status\b.*$/, '/cancel') }),
    }).catch(() => {});
  }
  endGen(chatId);
  // Credits are charged the moment fal accepts the job, so a run that already
  // reached the generator was charged; only a stop during the brief submit
  // window (before it was sent) escapes the charge.
  deliverAgent(chatId, '⏹ Cancelled — credits for a run are used once it reaches the generator.');
}

// Failures become a conversation: isibi.ai explains what went wrong in plain
// words and, when a rewording could fix it, offers a corrected prompt.
// Returns false if the director can't help so the generic message shows.
async function explainFailure(origin, kind, genPrompt, job) {
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'error', kind, prompt: genPrompt || '(no prompt)',
        error: JSON.stringify(job || {}).slice(0, 700),
        ...directorContext(),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (!data.reply) throw 0;
    deliverAgent(origin, data.reply);
    if (data.prompt && chatStore.active === origin) reviewPrompt(data.prompt);
    return true;
  } catch { return false; }
}

// Turn fal/worker failures into human messages; the raw detail goes to the console.
function friendlyFail(job) {
  console.error('generation failed:', job);
  const raw = JSON.stringify(job || {});
  if (/daily limit/i.test(raw)) return "⚠️ You've hit today's generation limit — it resets within 24 hours.";
  if (/exhausted balance|user is locked/i.test(raw)) return '⚠️ Generation is paused — the fal.ai balance ran out. Top it up and try again.';
  if (/content|safety|nsfw|moderation/i.test(raw)) return '⚠️ That prompt was blocked by the model’s content filter — rephrase it and try again.';
  if (/validation|invalid|must be|unprocessable/i.test(raw)) return '⚠️ Those settings didn’t work for this model — tweak duration, ratio or quality and try again.';
  if (job && job.error === 'unknown model') return '⚠️ That model isn’t available right now — pick another from the menu.';
  return '⚠️ Couldn’t start the generation — give it another try in a moment.';
}

async function generateMedia(text, opts = {}) {
  const origin = chatStore.active; // deliver results here even if the user switches chats
  if (activeGens.has(origin)) {
    addMsg('agent', '⚠️ Hold on — this chat is already generating. Start a new chat to run another.');
    return;
  }
  if (opts.announce !== false) addMsg('user', text || '🎬 Lip-sync from the attached media');
  // Remember what we generated with, so "make it slower" can revise it later.
  const originChat = activeChat();
  if (originChat && text && mode !== 'audio') { originChat.lastPrompt = text; persistStore(); touchSync(originChat.id); }

  const kind = mode;
  const label = document.getElementById('modelLabel').textContent;
  // Identity token: cancel deletes it, and a fresh generation in this chat
  // replaces it — either way this run notices and quietly stops.
  const myGen = { kind, aspect: ratioAspect(ratio), text: 'Sending to ' + label, statusUrl: null };
  const alive = () => activeGens.get(origin) === myGen;
  activeGens.set(origin, myGen);
  updateSendLock();
  mountGenLoader();

  const apiPath = kind === 'image' ? '/api/image' : kind === 'audio' ? '/api/audio' : '/api/video';
  try {
    const res = await apiFetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text,
        image: attachments.image || undefined,
        images: extraImages.length ? extraImages.slice() : undefined,
        avatar: attachments.avatar || undefined,
        end: attachments.end || undefined,
        first: attachments.ffirst || undefined, // Veo first-&-last-frame
        last: attachments.flast || undefined,
        refs: refList.length ? refList.slice() : undefined, // Veo reference-to-video
        audio: attachments.audio || undefined,
        audioDuration: attachments.audio && awDur ? awDur : undefined, // lip-sync models bill by clip length
        clip: attachments.clip || undefined,
        duration: kind === 'video' && currentOpts().durations ? duration : undefined,
        ratio: currentOpts().ratios ? ratio : undefined,
        quality: kind === 'video' && currentOpts().resolutions ? quality : undefined,
        voice: kind === 'audio' ? voice : undefined,
        num: kind === 'image' && currentOpts().nums && numImages > 1 ? numImages : undefined,
        effort: effort, // sets the director surcharge (+1 Haiku / +2 Sonnet tiers)
        director: directorMode === 'off' ? 'off' : 'on', // off waives the surcharge
      }),
    });
    if (res.status === 401) { // session died — stop cleanly, the gate is up
      endGen(origin);
      deliverAgent(origin, '⚠️ Your session expired — sign in and try again.');
      return;
    }
    const job = await res.json();
    if (!alive()) return; // cancelled while submitting
    if (res.status === 402) { // out of credits — nothing was spent
      endGen(origin);
      deliverAgent(origin, '⚡ Not enough credits — this run needs ' + (job.cost ? job.cost + ' credits' : 'more than you have') + '. Tap your ✦ balance up top to get more.');
      return;
    }
    if (!res.ok || !job.status_url) {
      endGen(origin);
      if (!(await explainFailure(origin, kind, text, job))) deliverAgent(origin, friendlyFail(job));
      return;
    }
    if (typeof job.balance === 'number') setCredits(job.balance);
    myGen.statusUrl = job.status_url; // lets Stop cancel the job on fal too

    // 4K renders can legitimately outrun ten minutes — give them twenty.
    const maxWaitMin = kind === 'video' && quality === '4k' ? 20 : 10;
    const deadline = Date.now() + maxWaitMin * 60 * 1000;
    // On record until endGen clears it — a refreshed tab resumes this at boot.
    jobRecord(origin, {
      kind, statusUrl: job.status_url, responseUrl: job.response_url,
      text: text ? String(text).slice(0, 400) : '', label, aspect: myGen.aspect, deadline,
    });
    await pollAndDeliver(origin, kind, job.status_url, job.response_url, text, label, deadline, maxWaitMin, myGen, true);
  } catch {
    if (alive()) deliverAgent(origin, '⚠️ Network hiccup — try again.');
  } finally {
    if (alive()) endGen(origin);
    if (chatStore.active === origin) document.getElementById('input').focus();
  }
}

// The wait-save-deliver half of a generation, shared by a live submit and a
// boot-time resume: poll fal until done, copy outputs to permanent storage,
// deliver into the origin chat.
async function pollAndDeliver(origin, kind, statusUrl, responseUrl, text, label, deadline, maxWaitMin, myGen, clearInputs) {
  const alive = () => activeGens.get(origin) === myGen;
  let softErrors = 0; // consecutive transient poll failures
  try {
    let state = '';
    while (Date.now() < deadline) {
      let sr, st;
      try {
        sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(statusUrl));
        if (sr.status === 401) {
          // Session expired mid-render — KEEP the record so boot-resume (after
          // re-sign-in) finishes the paid render instead of dropping it.
          if (alive()) { jobBumpTries(origin); pauseGen(origin); deliverAgent(origin, '⚠️ Your session expired mid-generation — sign back in and the app will pick this up.'); }
          return;
        }
        if (!sr.ok) {
          // 404/410 = fal no longer has this job (expired/cancelled) → terminal.
          if (sr.status === 404 || sr.status === 410) {
            if (alive()) { endGen(origin); deliverAgent(origin, '⚠️ This render is no longer available on fal — please try again.'); }
            return;
          }
          // Any other non-OK (proxy 502, upstream 5xx) is a transient tick, like
          // a network drop — count it so a JSON error body can't spin the loader
          // to the deadline.
          if (!alive()) return;
          if (++softErrors >= 15) { jobBumpTries(origin); pauseGen(origin); deliverAgent(origin, '⚠️ Lost the connection while this was rendering — it keeps going on fal, and the app will pick it back up automatically.'); return; }
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        st = await sr.json();
        softErrors = 0; // a good tick resets the streak
      } catch {
        // Transient network drop: don't kill the run — the record survives, so
        // the poll simply retries next tick (or resumes at boot). Give up the
        // in-memory loader only after a sustained outage (~1 min).
        if (!alive()) return;
        if (++softErrors >= 15) {
          jobBumpTries(origin);
          pauseGen(origin);
          deliverAgent(origin, '⚠️ Lost the connection while this was rendering — it keeps going on fal, and the app will pick it back up automatically.');
          return;
        }
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      if (!alive()) return; // cancelled while polling
      state = st.status;
      if (state === 'COMPLETED') break;
      // fal reached a terminal failure — stop now instead of spinning the
      // loader until the deadline. The job is dead; clear the record so it
      // isn't re-polled at boot.
      if (state === 'FAILED' || state === 'ERROR' || state === 'CANCELED' || state === 'CANCELLED') {
        endGen(origin);
        deliverAgent(origin, '⚠️ The model couldn\'t finish this generation — please try again' + (kind === 'video' ? ', or tweak the prompt' : '') + '.');
        return;
      }
      myGen.model = label;
      setGenText(origin,
        state === 'IN_PROGRESS'
          ? theaterLine(myGen, kind)
          : 'In the render queue' + (st.queue_position != null ? ' — #' + st.queue_position : '') + '…');
      await new Promise((r) => setTimeout(r, 4000));
      if (!alive()) return;
    }

    if (state !== 'COMPLETED') {
      // Ran past the deadline but the job is still live on fal (and already
      // charged). Keep the refresh-proof record — bounded by tries — so
      // boot-resume gets it, rather than clearing a paid render here.
      jobBumpTries(origin);
      pauseGen(origin);
      deliverAgent(origin, '⚠️ Timed out after ' + maxWaitMin + ' minutes — the job may still finish on fal.ai; the app will pick it back up automatically.');
      return;
    }

    const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(responseUrl));
    const out = await rr.json();
    if (!alive()) return;
    // Images may come back as several variations; video/audio is a single URL.
    let urls = [];
    if (kind === 'image') {
      urls = (out.images || out.data?.images || []).map((i) => i && i.url).filter(Boolean);
      if (!urls.length && out.image?.url) urls = [out.image.url];
    } else {
      const single = kind === 'audio'
        ? (out.audio?.url || out.audio_url || out.audio_file?.url || out.audio?.[0]?.url || out.data?.audio?.url)
        : (out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url);
      if (single) urls = [single];
    }
    // Claim delivery only now that the result is in hand: claiming earlier meant
    // a failed result-fetch burned the claim and the paid render was dropped on
    // boot-resume. Another tab that already delivered this job wins the claim;
    // we stop without clearing so the winner's record management stands.
    if (!claimDelivery(statusUrl)) { jobBumpTries(origin); pauseGen(origin); return; } // bump so a dead claim doesn't re-poll forever
    if (urls.length) {
      // Copy to permanent storage — fal URLs expire after a few days.
      setGenText(origin, urls.length > 1 ? 'Saving ' + urls.length + ' images…' : 'Saving to your gallery…');
      const finals = [];
      let saveFailed = false;
      let blocked = null;
      for (const u of urls) {
        const perm = await saveOutput(u, kind);
        if (perm) finals.push(perm);
        else if (lastSaveBlock) { finals.push(u); blocked = lastSaveBlock.reason; } // paid gate — don't queue a doomed retry
        else { finals.push(u); saveFailed = true; queuePendingSave(u, kind); }
      }
      if (!alive()) return;
      endGen(origin);
      finals.forEach((f) => deliverMedia(origin, kind, f, text));
      if (blocked === 'free') deliverAgent(origin, 'ℹ️ Saving to your gallery is a paid feature — this one is a temporary link. Upgrade to keep your generations in the gallery.');
      else if (blocked === 'full') deliverAgent(origin, '⚠️ Your gallery storage is full, so this is a temporary link. Free up space in the gallery or move up a tier to keep saving.');
      else if (saveFailed) deliverAgent(origin, '⚠️ Delivered with a temporary link — the gallery copy failed, so I queued a retry for the next time the app opens.');
      // The inputs were consumed — clear them so they don't ride the next
      // prompt. Only when the user is still on this chat: a background finish
      // must not wipe attachments they've since staged in another chat.
      if (clearInputs && chatStore.active === origin) {
        Object.keys(attachments).forEach((k) => {
          if (attachments[k]) { attachments[k] = null; renderAttach(k); }
        });
        extraImages.length = 0;
        renderExtraImages();
        refList.length = 0;
        renderRefList();
      }
    } else {
      endGen(origin);
      console.error('generation finished without media:', out);
      deliverAgent(origin, '⚠️ The model finished but returned no ' + kind + ' — try again.');
    }
  } catch {
    // Completed-but-couldn't-fetch-the-result, or any other late failure: the
    // job is (or was) live on fal and already charged, so keep the record and
    // let boot-resume finish the delivery rather than dropping a paid render.
    if (alive()) { jobBumpTries(origin); pauseGen(origin); deliverAgent(origin, '⚠️ Hit a snag fetching the result — the app will pick it back up automatically.'); }
  } finally {
    if (alive()) pauseGen(origin); // never jobClear here — only terminal paths clear
    if (chatStore.active === origin) document.getElementById('input').focus();
  }
}

// ── Director flow (isibi.ai) ───────────────────────────────────────────────
// Sonnet 5 drives the director via /api/direct. If the key isn't set (501)
// or the call fails, we fall back to these local placeholders so the flow
// still works.
// The last few chat turns, so the director remembers the conversation.
function directorHistory() {
  const chat = activeChat();
  return (chat ? chat.msgs : [])
    .filter((m) => m.t === 'user' || m.t === 'agent' || m.t === 'media')
    .slice(-8)
    .map((m) => m.t === 'media'
      // The director can't see media — give it a text marker so "another one
      // like the last one" means something.
      ? { role: 'assistant', text: '[generated a ' + (m.kind || 'media') + (m.prompt ? ' with prompt: "' + String(m.prompt).slice(0, 200) + '"' : '') + ']' }
      : { role: m.t === 'user' ? 'user' : 'assistant', text: String(m.text || '').slice(0, 400) });
}

// Generation context, so the director writes prompts for the actual target
// (model family, attachments, clip length) instead of guessing blind.
// ── Universal memory: one auto-learned taste list, applied to EVERY
// generation across all chats (not per-chat). Local (zephyr_memory_v1) plus a
// per-user Supabase row so it follows the account across devices. The composer
// evolves it on each approved generation; the Memory space shows/edits it. ──
const MEMORY_KEY = 'zephyr_memory_v1';
const MEMORY_ENDPOINT = SUPABASE_URL + '/rest/v1/user_memory';
let memoryState = { items: [], enabled: true, updatedAt: 0 };
function normMemItems(a) {
  return Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 140)).slice(0, 15) : [];
}
function loadMemory() {
  try {
    const s = JSON.parse(localStorage.getItem(MEMORY_KEY) || 'null');
    if (s && typeof s === 'object') memoryState = { items: normMemItems(s.items), enabled: s.enabled !== false, updatedAt: s.updatedAt || 0 };
  } catch {}
}
function persistMemory(touch) {
  if (touch) memoryState.updatedAt = Date.now();
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memoryState)); } catch {}
}
function memoryEnabled() { return memoryState.enabled !== false; }
function memoryItems() { return normMemItems(memoryState.items); }
// Replace the learned taste with the composer's evolved list (on approval).
function commitMemory(items) {
  const clean = normMemItems(items);
  if (JSON.stringify(clean) === JSON.stringify(memoryState.items)) return; // no real change
  memoryState.items = clean;
  persistMemory(true);
  pushMemory();
}
async function pushMemory() {
  const h = await syncHeaders();
  const uid = window.Auth && Auth.userId ? Auth.userId() : '';
  if (!h || !uid) return;
  try {
    await fetch(MEMORY_ENDPOINT + '?on_conflict=user_id', {
      method: 'POST',
      headers: Object.assign({}, h, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_id: uid, items: memoryState.items, enabled: memoryState.enabled, updated_at: new Date(memoryState.updatedAt || Date.now()).toISOString() }),
    });
  } catch {}
}
async function pullMemory() {
  const h = await syncHeaders();
  if (!h) return;
  try {
    const res = await fetch(MEMORY_ENDPOINT + '?select=items,enabled,updated_at&limit=1', { headers: h });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;
    const r = rows[0];
    const remoteAt = Date.parse(r.updated_at) || 0;
    if (remoteAt > (memoryState.updatedAt || 0)) { // last-writer-wins on the whole object
      memoryState = { items: normMemItems(r.items), enabled: r.enabled !== false, updatedAt: remoteAt };
      persistMemory(false);
    }
  } catch {}
}

function directorContext() {
  return {
    model: model,
    duration: mode === 'video' ? duration : undefined,
    ratio: mode !== 'audio' ? ratio : undefined,
    hasImage: !!attachments.image,
    hasEnd: !!attachments.end,
    brief: (activeChat() || {}).brief || undefined,
    // Universal taste — only when enabled and there's something to apply.
    memory: memoryEnabled() && mode !== 'audio' && memoryItems().length ? memoryItems() : undefined,
    effort: effort,
  };
}

// The composer returns an updated per-chat creative brief AND an evolved
// universal taste list with each prompt; both only commit when the user
// APPROVES that prompt (so abandoned drafts never teach isibi anything).
let pendingBrief = null;
let pendingMemory = null;

// The director gets to SEE the attached image (downscaled — it only needs to
// understand the picture, not generate from it).
async function directorImage() {
  if (!attachments.image || mode === 'audio') return {};
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = attachments.image; });
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    if (scale === 1 && attachments.image.length < 1500000) return { image: attachments.image };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { image: canvas.toDataURL('image/jpeg', 0.85) };
  } catch { return {}; }
}

async function directorAsk(text, history, onDelta) {
  // Voice mode goes through the director too — it decides whether this is
  // chat ("hey", "how are you") or words to speak. Composing stays literal.
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'ask', kind: mode, prompt: text, history: history || [], stream: true,
        qmode: directorMode, // tells the worker which prompt-help mode is active
        prevPrompt: (activeChat() || {}).lastPrompt || undefined,
        ...directorContext(), ...(await directorImage()),
      }),
    });
    if (!res.ok) throw 0;
    // Streamed reply: render deltas live, then return the final payload.
    if ((res.headers.get('content-type') || '').includes('text/event-stream') && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', final = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: '));
          buf = buf.slice(i + 2);
          if (!line) continue;
          let ev;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.d && onDelta) onDelta(ev.d);
          if (ev.done) final = ev.done;
          if (ev.error) throw 0;
        }
      }
      if (!final) throw 0;
      // Taste learned from the conversation commits immediately — chat has no
      // approval gate (unlike compose, which waits for the user to run it).
      if (Array.isArray(final.memory)) commitMemory(final.memory);
      return {
        reply: final.reply || '',
        ready: !!final.ready,
        rerun: !!final.rerun,
        revise: !!final.revise,
        needsWeb: !!final.needsWeb,
      };
    }
    const data = await res.json();
    if (Array.isArray(data.memory)) commitMemory(data.memory);
    return {
      reply: data.reply || '',
      ready: !!data.ready,
      rerun: !!data.rerun,
      revise: !!data.revise,
      needsWeb: !!data.needsWeb,
    };
  } catch { return localAsk(text); }
}

// Surgical prompt revision: previous prompt + plain-words feedback → edited prompt.
async function directorRevise(feedback) {
  const prev = (activeChat() || {}).lastPrompt || '';
  pendingBrief = null; pendingMemory = null;
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'revise', kind: mode, prompt: feedback, prevPrompt: prev,
        history: directorHistory(), ...directorContext(), ...(await directorImage()),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.brief) pendingBrief = String(data.brief).slice(0, 600);
    if (Array.isArray(data.memory)) pendingMemory = data.memory;
    if (data.prompt) return data.prompt;
    throw 0;
  } catch { return prev ? prev + ' ' + feedback : feedback; }
}

async function directorCompose(text, answers, webFacts) {
  if (mode === 'audio') return text; // voice: speak the words as given
  pendingBrief = null; pendingMemory = null;
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'compose', kind: mode, prompt: text, answers: answers.filter(Boolean),
        webFacts: webFacts || undefined,
        history: directorHistory(), ...directorContext(), ...(await directorImage()),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.brief) pendingBrief = String(data.brief).slice(0, 600);
    if (Array.isArray(data.memory)) pendingMemory = data.memory;
    if (data.prompt) return data.prompt;
    throw 0;
  } catch { return localCompose(text, answers); }
}

function localAsk(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Greeting / small talk — just chat.
  if (words < 3) {
    return {
      reply: mode === 'audio'
        ? 'Hey! Type the words you want the voice to say and I’ll voice them.'
        : "Hey! Tell me what you'd like to create and I'll help you shape it.",
      ready: false,
    };
  }
  return { reply: '', ready: true };
}

function localCompose(text, answers) {
  const extra = answers.filter(Boolean).join(', ');
  return extra ? text + ' — ' + extra + '; highly detailed, professional quality.' : text;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function threadAppend(el) {
  const box = document.getElementById('messages');
  box.appendChild(el);
  box.parentElement.scrollTop = box.parentElement.scrollHeight;
}

async function startDirector(text) {
  const origin = chatStore.active;
  const history = directorHistory(); // prior turns only — capture before adding this one
  clearQDock(); // a fresh message supersedes any question still waiting
  addMsg('user', text);
  const thinking = addMsg('agent typing', 'isibi.ai is thinking');
  // isibi.ai's reply streams into a live bubble; the final text is re-delivered
  // through the normal path (persisted, stamped) when the stream ends.
  let live = null;
  const onDelta = (d) => {
    if (chatStore.active !== origin) return;
    if (!live) {
      thinking.remove();
      live = document.createElement('div');
      live.className = 'msg agent live';
      document.getElementById('messages').appendChild(live);
    }
    live.textContent += d;
    live.parentElement.parentElement.scrollTop = live.parentElement.parentElement.scrollHeight;
  };
  let res;
  try { res = await directorAsk(text, history, onDelta); } finally { thinking.remove(); if (live) live.remove(); }
  // isibi.ai's conversational reply (greetings, small talk, or a lead-in).
  if (res.reply) deliverAgent(origin, res.reply);
  // If the user moved to another chat while isibi.ai was thinking, stop here —
  // don't pop question cards into the wrong thread.
  if (chatStore.active !== origin) return;
  // The director read the message as "run that again": the last prompt was
  // already approved once — straight back into generation, no re-interview.
  if (res.rerun && (activeChat() || {}).lastPrompt) {
    // Plan mode still gets the approval card (settings may have changed since
    // the last run) — deliverPrompt handles the mode split; Auto runs straight.
    if (!res.reply && directorMode !== 'plan') deliverAgent(origin, '🔁 Running it again.');
    deliverPrompt(activeChat().lastPrompt);
    return;
  }
  // Feedback on the previous generation — revise that prompt surgically.
  if (res.revise && (activeChat() || {}).lastPrompt) {
    const thinking2 = addMsg('agent typing', 'Revising the prompt');
    let prompt;
    try { prompt = await directorRevise(text); } finally { thinking2.remove(); }
    if (chatStore.active !== origin) return;
    deliverPrompt(prompt);
    return;
  }
  // A creative request — compose the prompt for review. If the director
  // flagged it as needing current real-world facts, research the web first.
  if (res.ready) composeAndReview(text, [], res.needsWeb);
  // Otherwise (greeting / small talk): the reply alone is the whole turn.
}

async function composeAndReview(text, answers, needsWeb) {
  const origin = chatStore.active;
  // Web-search first when the request depends on current real-world facts
  // (latest products, real specs) — the director's needsWeb judgment alone
  // decides; there's no user toggle. Failures degrade to no facts.
  let webFacts = '';
  if (needsWeb) {
    const looking = addMsg('agent typing', 'Looking it up on the web');
    let research = { facts: '', sources: [] };
    try { research = await directorResearch(text); } finally { looking.remove(); }
    if (chatStore.active !== origin) return;
    webFacts = research.facts || '';
    if (research.sources && research.sources.length) {
      const names = [...new Set(research.sources
        .map((s) => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return s.title || 'source'; } }))]
        .slice(0, 3);
      deliverAgent(origin, '🔎 Checked the web — ' + names.join(', '));
      if (chatStore.active !== origin) return;
    }
  }
  const thinking = addMsg('agent typing', 'Writing the prompt');
  let prompt;
  try { prompt = await directorCompose(text, answers, webFacts); } finally { thinking.remove(); }
  // The user moved to another chat while the prompt was being written —
  // don't pop the review card into the wrong thread.
  if (chatStore.active !== origin) return;
  deliverPrompt(prompt);
}

// Live web search: gathers current real-world facts for the prompt writer.
// Returns { facts, sources }; on any failure returns empties so compose runs.
async function directorResearch(text) {
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'research', kind: mode, prompt: text,
        history: directorHistory(), ...directorContext(),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    return {
      facts: String(data.facts || '').slice(0, 2000),
      sources: Array.isArray(data.sources) ? data.sources.slice(0, 5) : [],
    };
  } catch { return { facts: '', sources: [] }; }
}

// Mode split: Plan pops the finished paragraph into the chat for approval;
// Auto commits the brief and generates without stopping.
function deliverPrompt(prompt) {
  if (directorMode === 'plan') { reviewPrompt(prompt); return; }
  const c = activeChat();
  if (pendingBrief && c) { c.brief = pendingBrief; pendingBrief = null; persistStore(); touchSync(c.id); }
  if (pendingMemory) { commitMemory(pendingMemory); pendingMemory = null; }
  generateMedia(prompt, { announce: false });
}

// The floating dock above the composer (was the question cards; the Plan
// mode card renders here next).
function clearQDock() {
  const dock = document.getElementById('qDock');
  if (dock) dock.innerHTML = '';
}

// Build the Plan-mode review card (approve to run). Extracted so it can be
// re-rendered from a persisted {t:'review'} message — otherwise switching
// chats, a background sync-renderThread, or a reload lost the composed prompt.
function buildReviewCard(prompt, cardMode) {
  const m = cardMode || mode;
  const box = document.createElement('div');
  box.className = 'review-card';
  const label = document.createElement('div');
  label.className = 'review-label';
  label.textContent = m === 'audio'
    ? "I'll voice exactly these words — approve to hear it:"
    : "Here's the plan — approve to run it:";
  const body = document.createElement('div');
  body.className = 'review-prompt'; body.textContent = prompt;
  const actions = document.createElement('div'); actions.className = 'review-actions';
  const deny = document.createElement('button'); deny.className = 'review-deny'; deny.textContent = '✕ Deny';
  const allow = document.createElement('button'); allow.className = 'review-allow';
  // Price the card on the actual prompt/script, not the (now-cleared) input.
  allow.textContent = 'Generate ' + (estimatePrice(m === 'audio' ? prompt : undefined) || '✦');
  deny.onclick = () => { clearReviews(); actions.remove(); label.textContent = 'Denied — tweak it and send again.'; document.getElementById('input').focus(); };
  allow.onclick = () => {
    // One generation per chat — if the previous run is still going, keep the
    // card live so the prompt isn't silently swallowed by the busy guard.
    if (activeGens.has(chatStore.active)) {
      label.textContent = "Still finishing the last one — approve again in a moment.";
      return;
    }
    clearReviews();
    actions.remove(); label.textContent = 'Approved ✦';
    // Generate with the KIND this card was composed for, not whatever mode the
    // composer happens to be in now (mode resets to 'video' on reload) — else an
    // approved voice line would run as a video and bill at video rates.
    if (m !== mode) setMode(m);
    // Approval is the signal that this direction is right — commit the brief
    // and let the composer's evolved taste settle into universal memory.
    const c = activeChat();
    if (pendingBrief && c) { c.brief = pendingBrief; pendingBrief = null; persistStore(); touchSync(c.id); }
    if (pendingMemory) { commitMemory(pendingMemory); pendingMemory = null; }
    generateMedia(prompt, { announce: false });
  };
  actions.appendChild(deny); actions.appendChild(allow);
  box.appendChild(label); box.appendChild(body); box.appendChild(actions);
  return box;
}
// Drop any pending review card from the active chat once approved/denied so a
// later re-render doesn't resurrect it.
function clearReviews() {
  const c = activeChat(); if (!c) return;
  const before = c.msgs.length;
  c.msgs = c.msgs.filter((mm) => mm.t !== 'review');
  if (c.msgs.length !== before) { persistStore(); touchSync(c.id); }
}
function reviewPrompt(prompt) {
  pushSaved({ t: 'review', prompt: String(prompt), mode, at: Date.now() });
  threadAppend(buildReviewCard(prompt, mode));
}

// Grow the message box downward as the user types; cap it, then scroll.
function autoGrow(el) {
  if (mode === 'audio') updateSendPrice(); // voice bills per character — live re-quote
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.38)) + 'px';
}

function send(fromButton) {
  // While this chat is generating, the BUTTON doubles as Stop — but Enter
  // must never cancel a run mid-typing.
  if (activeGens.has(chatStore.active)) {
    if (fromButton) cancelGen(chatStore.active);
    return;
  }
  const input = document.getElementById('input');
  const text = input.value.trim();
  // Lip-sync models are prompt-less — they run off the attachments, not text.
  const promptless = mode === 'video' && currentOpts() && currentOpts().noPrompt;
  if (!text && !promptless) return;
  // Voice is capped at 2,000 characters server-side; block over-length scripts
  // here (keeping the text) instead of letting the tail get silently cut off.
  if (mode === 'audio' && text.length > 2000) {
    addMsg('agent', "That's a long one — voice scripts are capped at 2,000 characters (this is " + text.length.toLocaleString() + "). Trim it a little and send again.");
    return;
  }
  input.value = '';
  input.style.height = 'auto'; // collapse back to one line after sending
  if (promptless) { generateMedia(text); return; }
  // Raw mode: no director — the words go to the model exactly as typed.
  if (directorMode === 'off') { generateMedia(text); return; }
  startDirector(text);
}

// ── Auth gate ────────────────────────────────────────
// Every /api/* call carries the Supabase access token; a 401 sends the user
// back to the sign-in screen.
async function apiFetch(path, opts = {}) {
  const token = window.Auth ? await Auth.accessToken() : null;
  const headers = Object.assign({}, opts.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  if (res.status === 401) showAuthGate();
  return res;
}

function showAuthGate() {
  const gate = document.getElementById('authGate');
  if (!gate) return;
  gate.style.display = 'flex';
  // Take the app behind the gate out of the tab order so focus can't leak onto
  // invisible controls behind the sign-in screen.
  const shell = document.querySelector('.shell');
  if (shell) shell.inert = true;
  const email = document.getElementById('authEmail');
  if (email) email.focus();
}
function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.style.display = 'none';
  const shell = document.querySelector('.shell');
  if (shell) shell.inert = false;
}

// One flow: email + password → emailed code → in.
// Modes: 'in' (sign in) · 'up' (create account) · 'reset' (forgot password).
// Steps: 'creds' → 'code' → ('newpass' for reset).
function authEl(id) { return document.getElementById(id); }
let authMode = 'in';
let authStep = 'creds';
let pendingEmail = '';
let pendingType = 'email'; // verify type for the code step

function showAuthError(msg) {
  const e = authEl('authError');
  if (e) { e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }
}

function friendlyAuthErr(e) {
  const m = (e && e.message) || '';
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already been registered/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/rate limit|too many|429/i.test(m)) return 'Too many attempts — wait a minute and try again.';
  if (/(expired|invalid)[^]*(code|token|otp)|(code|token|otp)[^]*(expired|invalid)/i.test(m)) return "That code didn't work — request a new one.";
  if (/should be at least|at least 6/i.test(m)) return 'Password must be at least 6 characters.';
  return m || 'Something went wrong.';
}

const AUTH_TITLES = {
  in:    { creds: 'Sign in to isibi.ai',   code: 'Check your email' },
  up:    { creds: 'Create your account', code: 'Check your email' },
  reset: { creds: 'Reset your password', code: 'Check your email', newpass: 'Set a new password' },
};
const AUTH_BTNS = {
  in:    { creds: 'Sign in',         code: 'Verify & sign in' },
  up:    { creds: 'Create account',  code: 'Verify & finish' },
  reset: { creds: 'Send reset code', code: 'Verify code', newpass: 'Update password' },
};
function authSubmitLabel() { return AUTH_BTNS[authMode][authStep]; }

function renderAuthStep() {
  const inCreds = authStep === 'creds';
  const show = (id, on) => { authEl(id).style.display = on ? '' : 'none'; };
  show('authPass', inCreds && (authMode === 'in' || authMode === 'up'));
  show('authCode', authStep === 'code');
  show('authNewPass', authStep === 'newpass');
  authEl('authEmail').disabled = !inCreds;
  show('authResend', authStep === 'code');

  const showSwitch = inCreds && authMode !== 'reset';
  const showBack = authStep === 'code' || (inCreds && authMode !== 'up');
  show('authForgot', showBack);
  authEl('authSwitch').style.display = showSwitch ? '' : 'none';
  authEl('authLinks').style.display = (showSwitch || showBack) ? '' : 'none';
  authEl('authForgot').textContent =
    authStep === 'code' ? '← Start over' :
    authMode === 'reset' ? '← Back to sign in' : 'Forgot password?';

  authEl('authTitle').textContent = AUTH_TITLES[authMode][authStep];
  authEl('authSubmit').textContent = authSubmitLabel();
  authEl('authSub').textContent =
    authStep === 'code' ? 'Enter the code we emailed to ' + pendingEmail + '.' :
    authStep === 'newpass' ? 'Choose a new password for ' + pendingEmail + '.' :
    authMode === 'reset' ? 'We’ll email you a reset code.' :
    'Create AI video, images, and voice.';
  authEl('authSwitchText').textContent = authMode === 'up' ? 'Already have an account?' : 'New here?';
  authEl('authToggle').textContent = authMode === 'up' ? 'Sign in' : 'Create an account';
  authEl('authPass').setAttribute('autocomplete', authMode === 'up' ? 'new-password' : 'current-password');
}

function setAuthMode(mode) {
  authMode = mode;
  authStep = 'creds';
  authEl('authEmail').disabled = false;
  authEl('authCode').value = '';
  authEl('authNewPass').value = '';
  showAuthError('');
  renderAuthStep();
  authEl('authEmail').focus();
}

// The bottom-left link: Forgot ↔ back to sign in, or start over from a code step.
function onAuthBack() {
  if (authStep === 'code') setAuthMode(authMode);
  else setAuthMode(authMode === 'reset' ? 'in' : 'reset');
}

function goCodeStep(email, type) {
  pendingEmail = email; pendingType = type;
  authStep = 'code';
  renderAuthStep();
  authEl('authCode').value = '';
  authEl('authCode').focus();
}

async function submitAuth() {
  const btn = authEl('authSubmit');
  btn.disabled = true; btn.textContent = '…'; showAuthError('');
  const email = authEl('authEmail').value.trim();
  try {
    // Enter the emailed code.
    if (authStep === 'code') {
      const code = authEl('authCode').value.trim();
      if (!/^\d{6,10}$/.test(code)) { showAuthError('Enter the code from your email.'); return; }
      await Auth.verifyCode(pendingEmail, code, pendingType);
      if (authMode === 'reset') { authStep = 'newpass'; renderAuthStep(); authEl('authNewPass').focus(); }
      else enterApp();
      return;
    }
    // Set a new password (end of the reset flow).
    if (authStep === 'newpass') {
      const np = authEl('authNewPass').value;
      if (np.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
      await Auth.updatePassword(np);
      enterApp();
      return;
    }
    // Credentials step.
    if (!email) { showAuthError('Enter your email.'); return; }

    if (authMode === 'reset') {
      await Auth.recover(email);
      goCodeStep(email, 'recovery');
      return;
    }

    const pass = authEl('authPass').value;
    if (!pass) { showAuthError('Enter your password.'); return; }
    if (authMode === 'up' && pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }

    if (authMode === 'up') {
      const r = await Auth.signUp(email, pass);
      if (r.session) { enterApp(); return; }   // confirm-email OFF → straight in
      goCodeStep(email, 'signup');             // confirm-email ON → verify code
      return;
    }

    // Sign in: check the password (no session kept), then email a code.
    try {
      await Auth.checkPassword(email, pass);
    } catch (e) {
      // An unconfirmed account can't password-grant — let them finish via the code.
      if (!/not confirmed/i.test((e && e.message) || '')) throw e;
    }
    await Auth.sendCode(email, false);
    goCodeStep(email, 'email');
  } catch (e) {
    showAuthError(friendlyAuthErr(e));
  } finally {
    btn.disabled = false; btn.textContent = authSubmitLabel();
  }
}

async function resendAuthCode() {
  showAuthError('');
  const t = authEl('authResend');
  try {
    if (pendingType === 'recovery') await Auth.recover(pendingEmail);
    else await Auth.sendCode(pendingEmail, pendingType === 'signup');
    const orig = t.textContent;
    t.textContent = 'Code re-sent ✓';
    setTimeout(() => { t.textContent = orig; }, 1600);
  } catch (e) { showAuthError(friendlyAuthErr(e)); }
}

function enterApp() {
  hideAuthGate();
  const email = Auth.email();
  const badge = document.getElementById('authEmailBadge');
  if (badge) badge.textContent = email;
  // Derive a friendly display name + avatar initial from the email local part.
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
  const nameEl = document.getElementById('sideName');
  if (nameEl) nameEl.textContent = name;
  // Hero greeting follows the clock — late night / morning / day / evening.
  const ht = document.getElementById('heroTitle');
  if (ht) {
    const h = new Date().getHours();
    const [pre, post] =
      h < 5 ? ['Late night session, ', '?'] :
      h < 12 ? ['Morning, ', ' — what are we making?'] :
      h < 18 ? ['What are we making, ', '?'] :
      ['Evening, ', ' — what are we making?'];
    ht.textContent = '';
    ht.append(pre);
    const span = document.createElement('span');
    span.className = 'hh-name';
    span.textContent = name;
    ht.appendChild(span);
    ht.append(post);
  }
  const initial = (name[0] || '·').toUpperCase();
  const av = document.getElementById('sideAvatar');
  if (av) av.textContent = initial;
  const btnAv = document.getElementById('profileBtnAv');
  if (btnAv) btnAv.textContent = initial;
  const so = document.getElementById('signOutRow');
  if (so) so.style.display = '';
  document.getElementById('input').focus();
  // A different account signed in on this browser: drop the previous user's
  // local cache so their chats are never shown to — or re-uploaded under —
  // this account. (Sign-out clears it too; this covers expired-session swaps.)
  const uid = Auth.userId ? Auth.userId() : '';
  if (uid) {
    const prevOwner = localStorage.getItem('zephyr_owner_v1');
    if (prevOwner && prevOwner !== uid) {
      try {
        [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, CHAT_TOMB_KEY, MEMORY_KEY, 'zephyr_studio_v1', 'zephyr_avatars_v1', 'zephyr_products_v1', CRED_MAX_KEY, WELCOME_KEY]
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      chatStore = { active: null, chats: [] };
      memoryState = { items: [], enabled: true, updatedAt: 0 };
      syncDirty.clear(); syncDeleted.clear();
      loadStore();
      renderChatList(); renderThread();
      // Studio holds its projects in memory too — reset it from the wiped store.
      if (typeof sbResetForAccountSwitch === 'function') sbResetForAccountSwitch();
    }
    try { localStorage.setItem('zephyr_owner_v1', uid); } catch {}
  }
  // Run a ?q= prompt only AFTER the account-switch wipe above — otherwise it
  // would land in the outgoing account's chat and be discarded by the reset.
  const ranFirstMsg = !!pendingFirstMsg;
  if (pendingFirstMsg) { const q = pendingFirstMsg; pendingFirstMsg = null; startDirector(q); }
  // Signed in — pull the account's chats and universal memory, merge both.
  pullChats();
  pullMemory();
  fetchCredits();
  // Pick up any generation that was mid-flight when the tab last closed,
  // and re-copy any media whose gallery save failed.
  resumeJobs();
  retryPendingSaves();
  // Open on the Builder when a ?q= prompt is running (so its reply/loader is
  // visible), otherwise on the Home landing.
  showView(ranFirstMsg ? 'home' : 'landing');
}

async function doSignOut(everywhere) {
  // Flush any unsynced edits first, then wipe this browser's local copy so
  // the next account on this machine never sees — or re-uploads — these chats.
  try { await pushChats(); } catch {}
  try {
    [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, CHAT_TOMB_KEY, MEMORY_KEY, 'zephyr_owner_v1', 'zephyr_studio_v1', 'zephyr_avatars_v1', 'zephyr_products_v1', CRED_MAX_KEY, WELCOME_KEY]
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  if (everywhere) await Auth.signOutEverywhere();
  else await Auth.signOut();
  location.reload();
}

// Settings page — a plain, conventional settings view (grouped list rows),
// rebuilt each time it opens so account/credits/prefs are current.
function renderSettings() {
  const view = document.getElementById('viewSettings');
  if (!view) return;
  const email = Auth.email();
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
  const planTxt = paidKnown ? (isPaid ? 'Member' : 'Free') : '';
  const balTxt = (document.getElementById('creditChip') || {}).textContent || '✦ —';

  view.innerHTML =
    '<div class="settings-page">' +
      '<div class="sp-title">Settings</div>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">Account</div>' +
        '<div class="sp-list">' +
          '<div class="sp-item">' +
            '<span class="sp-acct-l"><span class="st-av">' + esc((name[0] || '·').toUpperCase()) + '</span>' +
              '<span class="sp-item-l"><span class="sp-item-t">' + esc(name) + '</span>' +
              '<span class="sp-item-s">' + esc(email) + '</span></span></span>' +
            (planTxt ? '<span class="st-plan' + (isPaid ? ' paid' : '') + '">' + planTxt + '</span>' : '') +
          '</div>' +
          '<button type="button" class="sp-item sp-tap" id="spCredits">' +
            '<span class="sp-item-l"><span class="sp-item-t">Credits &amp; plan</span></span>' +
            '<span class="sp-item-r">' + esc(balTxt) + ' <span class="st-chev">›</span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">Password</div>' +
        '<div class="sp-list">' +
          '<button type="button" class="sp-item sp-tap" id="spPwRow" aria-expanded="false">' +
            '<span class="sp-item-l"><span class="sp-item-t">Change password</span></span>' +
            '<span class="sp-item-r"><span class="st-chev sp-chev">›</span></span>' +
          '</button>' +
          '<form class="sp-item sp-form" id="spForm" hidden>' +
            '<input type="password" class="st-in" id="spPw" placeholder="New password (min 6 characters)" autocomplete="new-password" />' +
            '<button type="submit" class="st-save">Update</button>' +
          '</form>' +
        '</div>' +
        '<div class="cp-note sp-note" id="spNote"></div>' +
      '</div>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">About</div>' +
        '<div class="sp-list">' +
          // Prefill the account email + version into the body so a support
          // reply never has to ask "which account, which version?".
          '<a class="sp-item sp-tap" href="mailto:support@isibi.ai?subject=isibi%20support&body=' +
            encodeURIComponent('\n\n—\nAccount: ' + email + ' · isibi ' + APP_VERSION) + '">' +
            '<span class="sp-item-l"><span class="sp-item-t">Contact support</span>' +
            '<span class="sp-item-s">support@isibi.ai</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</a>' +
          '<a class="sp-item sp-tap" href="/terms.html" target="_blank" rel="noopener">' +
            '<span class="sp-item-l"><span class="sp-item-t">Terms of Service</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</a>' +
          '<a class="sp-item sp-tap" href="/privacy.html" target="_blank" rel="noopener">' +
            '<span class="sp-item-l"><span class="sp-item-t">Privacy Policy</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</a>' +
          '<div class="sp-item">' +
            '<span class="sp-item-l"><span class="sp-item-t">Version</span></span>' +
            '<span class="sp-item-r">' + APP_VERSION + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<button type="button" class="sp-signout" id="spSignout">Sign out</button>' +
      '<button type="button" class="sp-signout-all" id="spSignoutAll">Sign out on all devices</button>' +

      '<div class="sp-group">' +
        '<div class="sp-glabel">Danger zone</div>' +
        '<div class="sp-list">' +
          '<button type="button" class="sp-item sp-tap" id="spDelete">' +
            '<span class="sp-item-l"><span class="sp-item-t sp-red">Delete account</span>' +
            '<span class="sp-item-s">Permanently removes your account, chats, saved media and remaining credits.</span></span>' +
            '<span class="sp-item-r"><span class="st-chev">›</span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  view.querySelector('#spCredits').onclick = () => openCredits();

  // The password form stays folded behind its row — an always-open password
  // input on a settings page reads as a prompt to type into it.
  view.querySelector('#spPwRow').onclick = (e) => {
    const row = e.currentTarget;
    const form = view.querySelector('#spForm');
    form.hidden = !form.hidden;
    row.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
    row.classList.toggle('open', !form.hidden);
    view.querySelector('#spNote').textContent = '';
    if (!form.hidden) view.querySelector('#spPw').focus();
  };

  view.querySelector('#spForm').onsubmit = async (e) => {
    e.preventDefault();
    const inp = view.querySelector('#spPw');
    const note = view.querySelector('#spNote');
    const np = inp.value;
    if (np.length < 6) { note.textContent = 'Password needs at least 6 characters.'; return; }
    note.textContent = 'Updating…';
    try {
      await Auth.updatePassword(np);
      inp.value = '';
      note.textContent = 'Password updated ✓';
    } catch (err) {
      note.textContent = (err && err.message) || 'Could not change the password.';
    }
  };

  view.querySelector('#spSignout').onclick = () => doSignOut();

  // Global sign-out: same local flush/wipe as a normal sign-out, but GoTrue
  // revokes the session on every device, not just this one.
  view.querySelector('#spSignoutAll').onclick = () => doSignOut(true);

  view.querySelector('#spDelete').onclick = async (e) => {
    const btn = e.currentTarget;
    if (!confirm('Delete your isibi account? This permanently removes your chats, saved media and remaining credits.')) return;
    if (!confirm('Last check — this cannot be undone. Delete everything?')) return;
    btn.disabled = true;
    try {
      // Files first via the Storage API (clean byte removal; best-effort —
      // the RPC sweeps whatever this misses), then the account itself.
      await Auth.storageWipeOwn();
      await Auth.deleteAccount();
    } catch (err) {
      btn.disabled = false;
      alert((err && err.message) || 'Could not delete the account — try again in a moment.');
      return;
    }
    // Everything server-side is gone; drop every trace in this browser too.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('zephyr_'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    location.reload();
  };
}

// Netflix-style model showcase rows on the Home landing. Each row is a model
// name + a horizontal strip of example videos. Drop URLs into `videos` (they
// can be /public paths or remote URLs) and they replace the placeholder tiles.
const MODEL_ROWS = [
  { model: 'Seedance 2.0 4K', videos: [] },
  { model: 'Veo 3.1', videos: [] },
  { model: 'Kling 3.0', videos: [] },
  { model: 'Sora 2', videos: [] },
  { model: 'Hailuo 02', videos: [] },
];
// ── Home landing / dashboard: greeting, quick actions, model rows, recent. ──
function renderLanding() {
  const view = document.getElementById('viewLanding');
  if (!view) return;
  const email = Auth.email();
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
  const h = new Date().getHours();
  const greet = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  const recent = (typeof galleryItems === 'function' ? galleryItems() : []).slice(0, 8);
  const recentHtml = recent.length
    ? '<div class="lp-sec">Recent creations</div><div class="lp-recent">' +
      recent.map((it) => '<button type="button" class="lp-rec" data-go="gallery">' +
        (it.kind === 'image'
          ? '<img src="' + esc(it.url) + '" alt="" loading="lazy" />'
          : it.kind === 'audio'
          ? '<span class="lp-rec-audio">🎙</span>'
          : '<video src="' + esc(it.url) + '" muted preload="metadata"></video>') +
      '</button>').join('') + '</div>'
    : '';

  const nfHtml = MODEL_ROWS.map((row) => {
    const cards = (row.videos && row.videos.length ? row.videos : [null, null, null, null, null, null])
      .map((v, i) => v
        ? '<div class="nf-card"><video src="' + esc(v) + '" muted loop playsinline preload="metadata"></video></div>'
        : '<div class="nf-card nf-ph nf-ph' + (i % 3) + '"><span class="nf-play">▶</span></div>').join('');
    return '<div class="nf-row">' +
      '<div class="nf-head"><h2 class="nf-title">' + esc(row.model) + '</h2>' +
        '<button type="button" class="nf-all">See all <span class="nf-all-c">›</span></button></div>' +
      '<div class="nf-track">' + cards + '</div></div>';
  }).join('');

  view.innerHTML =
    '<div class="lp-page">' +
      '<div class="lp-hero"><h1>' + greet + ', ' + esc(name) + '</h1>' +
        '<p>Pick up where you left off, or start something new.</p></div>' +
      nfHtml + recentHtml +
    '</div>';

  view.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => showView(b.dataset.go); });
  view.querySelectorAll('.nf-all').forEach((b) => { b.onclick = () => showView('gallery'); });
  // Netflix-style hover-to-play; click goes fullscreen.
  view.querySelectorAll('.nf-card video').forEach((v) => {
    const card = v.closest('.nf-card');
    card.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
    card.addEventListener('mouseleave', () => { try { v.pause(); v.currentTime = 0; } catch (e) {} });
    card.addEventListener('click', () => { if (v.requestFullscreen) v.requestFullscreen().catch(() => {}); });
  });
}

// ── Avatar: talking-avatar workspace. Empty state offers "Generate with AI"
// or "Import"; imported/saved avatars show in a grid (zephyr_avatars_v1). ──
const AVATARS_KEY = 'zephyr_avatars_v1';
function loadAvatars() { try { return JSON.parse(localStorage.getItem(AVATARS_KEY) || '[]'); } catch { return []; } }
function saveAvatars(list) {
  try { localStorage.setItem(AVATARS_KEY, JSON.stringify(list.slice(0, 60))); return true; }
  catch (e) { if (typeof sbToast === 'function') sbToast('Storage is full — this avatar may not stick after a reload. Remove a few to free space.'); return false; }
}

// Avatar-creator state. avatarMode: 'list' (empty state / grid) or 'create'
// (the generator screen — avatar preview in the middle, body-part options on
// the right). AV_PARTS is a placeholder set of options, replaced with the
// real parts later. Avatars generate with Nano Banana Pro.
const AVATAR_MODEL = 'fal-ai/nano-banana-pro';
let avatarMode = 'list';
const acSel = {};   // key -> selected value
const acOpen = {};  // key -> section expanded?
// Right-side "Builder" sections. Types: 'cards' (label + optional icon),
// 'images' (label + image tile), 'swatch' (color dots). Placeholder content —
// swap for the real sections/options later. opts.img adds a real photo tile.
const AV_SECTIONS = [
  { key: 'gender', label: 'Gender', icon: '⚧', type: 'cards',
    opts: [{ v: 'Female', ico: '♀' }, { v: 'Male', ico: '♂' }, { v: 'Trans man', ico: '⚧' }, { v: 'Trans woman', ico: '⚧' }, { v: 'Non-binary', ico: '◯' }] },
  { key: 'skin', label: 'Skin Color', icon: '🎨', type: 'swatch',
    opts: [{ v: 'Fair', c: '#f2e3d5' }, { v: 'Light', c: '#e6c8a8' }, { v: 'Medium', c: '#d0a06f' }, { v: 'Tan', c: '#a86f43' }, { v: 'Brown', c: '#7a4a26' }, { v: 'Deep', c: '#4a2c17' }] },
  { key: 'ethnicity', label: 'Ethnicity / Origin Base', icon: '🌍', type: 'images',
    opts: [{ v: 'African' }, { v: 'Asian' }, { v: 'European' }, { v: 'Indian' }, { v: 'Middle Eastern' }, { v: 'Mixed' }] },
  { key: 'age', label: 'Age', icon: '🎂', type: 'slider', min: 18, max: 100, def: 25 },
  { key: 'hair', label: 'Hair', icon: '💇', type: 'cards',
    opts: [{ v: 'Short' }, { v: 'Long' }, { v: 'Curly' }, { v: 'Wavy' }, { v: 'Straight' }, { v: 'Buzz' }, { v: 'Ponytail' }, { v: 'Bald' }] },
  { key: 'facial', label: 'Facial Hair', icon: '🧔', type: 'cards',
    opts: [{ v: 'None' }, { v: 'Stubble' }, { v: 'Moustache' }, { v: 'Goatee' }, { v: 'Beard' }, { v: 'Full beard' }] },
  { key: 'haircolor', label: 'Hair Color', icon: '🖌️', type: 'swatch',
    opts: [{ v: 'Black', c: '#1a1a1a' }, { v: 'Dark brown', c: '#3b2417' }, { v: 'Brown', c: '#6b4226' }, { v: 'Light brown', c: '#b07b3e' }, { v: 'Blonde', c: '#d9b26a' }, { v: 'Auburn', c: '#a3502a' }, { v: 'Grey', c: '#9a9a9a' }, { v: 'Platinum', c: '#e8e3d3' }, { v: 'Pink', c: '#ff79c6' }, { v: 'Blue', c: '#4a7fd6' }] },
  { key: 'body', label: 'Body Type', icon: '🧍', type: 'images',
    opts: [{ v: 'Slim' }, { v: 'Lean' }, { v: 'Athletic' }, { v: 'Muscular' }, { v: 'Curvy' }, { v: 'Heavy' }, { v: 'Skinny' }] },
];

function renderAvatar() {
  const view = document.getElementById('viewAvatar');
  if (!view) return;
  if (avatarMode === 'create') { renderAvatarCreator(view); return; }
  const avatars = loadAvatars();
  if (!avatars.length) {
    view.innerHTML =
      '<div class="av-page av-empty">' +
        '<div class="av-hero"><h1>Create your avatar</h1>' +
          '<p>Generate a talking avatar with AI, or import your own portrait.</p></div>' +
        '<div class="av-choices">' +
          '<button type="button" class="av-choice" data-act="generate"><span class="av-choice-ico">✨</span>' +
            '<span class="av-choice-t">Generate with AI</span>' +
            '<span class="av-choice-s">Describe a person and isibi creates the avatar.</span></button>' +
          '<button type="button" class="av-choice" data-act="import"><span class="av-choice-ico">⬆</span>' +
            '<span class="av-choice-t">Import</span>' +
            '<span class="av-choice-s">Upload your own portrait photo.</span></button>' +
        '</div>' +
      '</div>';
  } else {
    view.innerHTML =
      '<div class="av-page">' +
        '<div class="av-top"><h1>Your avatars</h1>' +
          '<div class="av-top-btns">' +
            '<button type="button" class="av-mini" data-act="generate">✨ Generate</button>' +
            '<button type="button" class="av-mini" data-act="import">⬆ Import</button>' +
          '</div>' +
        '</div>' +
        '<div class="av-grid">' + avatars.map((a) =>
          '<div class="av-card" data-id="' + esc(a.id) + '">' +
            (a.image ? '<div class="av-thumb"><img src="' + esc(a.image) + '" alt="" /></div>' : '<div class="av-thumb av-thumb-ph">🧑</div>') +
            '<button class="av-del" data-id="' + esc(a.id) + '" aria-label="Remove">✕</button>' +
            '<div class="av-name">' + esc(a.name || 'Avatar') + '</div>' +
          '</div>').join('') + '</div>' +
      '</div>';
  }
  view.querySelectorAll('[data-act="generate"]').forEach((b) => { b.onclick = () => { avatarMode = 'create'; renderAvatar(); }; });
  view.querySelectorAll('[data-act="import"]').forEach((b) => { b.onclick = () => importAvatar(); });
  view.querySelectorAll('.av-del').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); saveAvatars(loadAvatars().filter((a) => a.id !== b.dataset.id)); renderAvatar(); }; });
}

function importAvatar() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const image = await downscaleImage(f, 720);
    const list = loadAvatars();
    list.unshift({ id: prUid(), name: (f.name || 'Avatar').replace(/\.[^.]+$/, '').slice(0, 60), image, at: Date.now() });
    saveAvatars(list);
    renderAvatar();
  };
  inp.click();
}

// The avatar generator screen: preview in the middle, a "Builder" panel of
// body-part options on the right (Higgsfield-style). Generates with Nano
// Banana Pro.
function renderAvatarCreator(view) {
  const secHtml = AV_SECTIONS.map((s) => {
    const open = acOpen[s.key] !== false; // default expanded
    const sel = acSel[s.key];
    let body = '';
    const has = (v) => Array.isArray(sel) && sel.includes(v); // multi-select per category
    if (s.type === 'cards') {
      body = '<div class="ab-cards">' + s.opts.map((o) =>
        '<button type="button" class="ab-card' + (has(o.v) ? ' on' : '') + '" data-k="' + s.key + '" data-v="' + esc(o.v) + '">' +
          '<span class="ab-card-l">' + esc(o.v) + '</span>' + (o.ico ? '<span class="ab-card-i">' + o.ico + '</span>' : '') +
        '</button>').join('') + '</div>';
    } else if (s.type === 'images') {
      body = '<div class="ab-imgs">' + s.opts.map((o, i) =>
        '<button type="button" class="ab-img' + (has(o.v) ? ' on' : '') + '" data-k="' + s.key + '" data-v="' + esc(o.v) + '">' +
          (o.img ? '<img src="' + esc(o.img) + '" alt="" />' : '<span class="ab-img-ph ab-ph' + (i % 3) + '"></span>') +
          '<span class="ab-img-l">' + esc(o.v) + '</span>' +
        '</button>').join('') + '</div>';
    } else if (s.type === 'swatch') {
      body = '<div class="ab-swatches">' + s.opts.map((o) =>
        '<button type="button" class="ab-swatch' + (has(o.v) ? ' on' : '') + '" data-k="' + s.key + '" data-v="' + esc(o.v) + '" style="background:' + esc(o.c) + '" title="' + esc(o.v) + '" aria-label="' + esc(o.v) + '"></button>').join('') + '</div>';
    } else if (s.type === 'slider') {
      const val = sel != null ? sel : s.def;
      body = '<div class="ab-slider">' +
        '<div class="ab-slider-top"><span class="ab-range-val" data-valfor="' + s.key + '">' + val + '</span></div>' +
        '<input type="range" class="ab-range" data-k="' + s.key + '" min="' + s.min + '" max="' + s.max + '" value="' + val + '" />' +
      '</div>';
    }
    const cntStr = s.type === 'slider' ? ' · ' + (sel != null ? sel : s.def) : (Array.isArray(sel) && sel.length ? ' · ' + sel.length : '');
    return '<div class="ab-sec' + (open ? ' open' : '') + '" data-sec="' + s.key + '">' +
      '<button type="button" class="ab-sec-h"><span class="ab-sec-t"><span class="ab-sec-ico">' + s.icon + '</span>' + esc(s.label) +
        '<span class="ab-sec-cnt">' + cntStr + '</span></span><span class="ab-chev">⌄</span></button>' +
      '<div class="ab-sec-body">' + body + '</div>' +
    '</div>';
  }).join('');

  view.innerHTML =
    '<div class="ac-page">' +
      '<button type="button" class="ac-back" id="acBack">← Avatars</button>' +
      '<div class="ac-main">' +
        '<div class="ac-stage">' +
          '<div class="ac-preview" id="acPreview">' +
            '<span class="ac-ph-ico">🖼️</span>' +
            '<div class="ac-ph-txt">Your avatar lives here.<br>Design it on the right, then generate.</div>' +
            '<span class="ac-tag">Human</span>' +
          '</div>' +
          '<div class="ac-actions">' +
            '<button type="button" class="ac-shuffle" id="acShuffle" title="Randomize" aria-label="Randomize">⤨</button>' +
            '<button type="button" class="ac-gen" id="acGen">Generate avatar ✦</button>' +
          '</div>' +
        '</div>' +
        '<aside class="ac-builder">' +
          '<div class="ab-top"><span class="ab-top-t">Builder</span><button type="button" class="ab-reset" id="acReset">Reset</button></div>' +
          secHtml +
        '</aside>' +
      '</div>' +
    '</div>';

  const setCount = (sec) => {
    const c = sec.querySelector('.ab-sec-cnt'); if (!c) return;
    const k = sec.dataset.sec, v = acSel[k], def = AV_SECTIONS.find((x) => x.key === k);
    c.textContent = def && def.type === 'slider' ? ' · ' + (v != null ? v : def.def) : (Array.isArray(v) && v.length ? ' · ' + v.length : '');
  };
  view.querySelector('#acBack').onclick = () => { avatarMode = 'list'; renderAvatar(); };
  view.querySelectorAll('.ab-range').forEach((r) => { r.oninput = () => {
    acSel[r.dataset.k] = +r.value;
    const lbl = view.querySelector('[data-valfor="' + r.dataset.k + '"]'); if (lbl) lbl.textContent = r.value;
    setCount(r.closest('.ab-sec'));
  }; });
  view.querySelectorAll('.ab-sec-h').forEach((h) => { h.onclick = () => {
    const sec = h.closest('.ab-sec'); acOpen[sec.dataset.sec] = sec.classList.toggle('open');
  }; });
  view.querySelectorAll('.ab-card, .ab-img, .ab-swatch').forEach((el) => { el.onclick = () => {
    const k = el.dataset.k, v = el.dataset.v;
    const arr = Array.isArray(acSel[k]) ? acSel[k].slice() : [];
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
    acSel[k] = arr.length ? arr : undefined;
    el.classList.toggle('on', arr.indexOf(v) >= 0);
    setCount(el.closest('.ab-sec'));
  }; });
  view.querySelector('#acReset').onclick = () => {
    Object.keys(acSel).forEach((k) => delete acSel[k]);
    view.querySelectorAll('.ac-builder .on').forEach((x) => x.classList.remove('on'));
    view.querySelectorAll('.ab-range').forEach((r) => {
      const def = (AV_SECTIONS.find((s) => s.key === r.dataset.k) || {}).def;
      if (def != null) { r.value = def; const lbl = view.querySelector('[data-valfor="' + r.dataset.k + '"]'); if (lbl) lbl.textContent = def; }
    });
    view.querySelectorAll('.ab-sec').forEach((sec) => setCount(sec));
  };
  view.querySelector('#acShuffle').onclick = () => {
    AV_SECTIONS.forEach((s) => {
      const sec = view.querySelector('.ab-sec[data-sec="' + s.key + '"]');
      if (s.type === 'slider') {
        const v = s.min + Math.floor(Math.random() * (s.max - s.min + 1));
        acSel[s.key] = v;
        if (sec) { const r = sec.querySelector('.ab-range'); if (r) r.value = v; const lbl = sec.querySelector('[data-valfor="' + s.key + '"]'); if (lbl) lbl.textContent = v; setCount(sec); }
        return;
      }
      const opt = s.opts[Math.floor(Math.random() * s.opts.length)];
      acSel[s.key] = [opt.v];
      if (sec) { sec.querySelectorAll('[data-k="' + s.key + '"]').forEach((x) => x.classList.toggle('on', acSel[s.key].indexOf(x.dataset.v) >= 0)); setCount(sec); }
    });
  };
  view.querySelector('#acGen').onclick = () => acGenerate();
}

function buildAvatarPrompt() {
  const s = acSel, b = [];
  const arr = (k) => (Array.isArray(s[k]) ? s[k] : s[k] != null ? [s[k]] : []);
  const lc = (a) => a.map((x) => String(x).toLowerCase());
  const join = (a) => {
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  };
  const gender = arr('gender'); if (gender.length) b.push(join(lc(gender)));
  // Age falls back to the slider's default even if the user never dragged it,
  // so the shown age (e.g. 25) actually drives the generated avatar.
  const age = s.age != null ? s.age : (AV_SECTIONS.find((x) => x.key === 'age') || {}).def;
  if (age) b.push(age + ' years old');
  const eth = arr('ethnicity'); if (eth.length) b.push('of ' + join(eth) + (eth.length > 1 ? ' mixed origin' : ' origin'));
  const body = arr('body'); if (body.length) b.push(join(lc(body)) + ' build');
  const skin = arr('skin'); if (skin.length) b.push(join(lc(skin)) + ' skin');
  const hair = arr('hair'), haircolor = arr('haircolor');
  const hairStyles = hair.filter((h) => h !== 'Bald');
  if (hair.some((h) => h === 'Bald') && !hairStyles.length) b.push('bald');
  else if (hairStyles.length || haircolor.length) {
    b.push((haircolor.length ? join(lc(haircolor)) + ' ' : '') + (hairStyles.length ? join(lc(hairStyles)) + ' ' : '') + 'hair');
  }
  const facial = arr('facial').filter((f) => f !== 'None');
  if (facial.length) b.push('with a ' + join(lc(facial)));
  const who = b.length ? 'a ' + b.join(', ') : 'a person';
  return 'Photorealistic front-facing portrait headshot of ' + who + ', neutral confident expression, soft even studio lighting, plain background, sharp focus on the eyes, head and shoulders, high detail — a clean talking-avatar reference.';
}

function acGenerate() {
  const prompt = buildAvatarPrompt();
  try { selectedModels.image = AVATAR_MODEL; } catch (e) {}
  showView('home');
  if (typeof setMode === 'function') setMode('image');
  const i = document.getElementById('input');
  if (i) { i.value = prompt; if (typeof autoGrow === 'function') autoGrow(i); i.focus(); }
}

// ── Memory: universal auto-learned taste is a SYSTEM feature with no
// front-end — no button, no page. It learns and applies silently (see the
// memory store above and directorContext().memory). ──

// ── Products: save a product from a store link or a manual upload, then reuse
// it across generations. Stored locally for now (zephyr_products_v1). ──
const PRODUCTS_KEY = 'zephyr_products_v1';
function loadProducts() { try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]'); } catch { return []; } }
function saveProducts(list) {
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list.slice(0, 60))); return true; }
  catch (e) { if (typeof sbToast === 'function') sbToast('Storage is full — this product may not stick after a reload. Remove a few to free space.'); return false; }
}
function prUid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function renderProducts() {
  const view = document.getElementById('viewProducts');
  if (!view) return;
  view.innerHTML =
    '<div class="products-page">' +
      '<div class="pr-head"><h1>Add your product</h1>' +
        '<p>Add a link or upload an image to use your product across generations.</p></div>' +
      '<div class="pr-add">' +
        '<div class="pr-url">' +
          '<span class="pr-url-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></span>' +
          '<input id="prUrl" type="url" placeholder="www.yourproduct.com" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="pr-url-go" id="prUrlGo" aria-label="Add product">→</button>' +
        '</div>' +
        '<span class="pr-or">or</span>' +
        '<button type="button" class="pr-manual" id="prManual">Create manually</button>' +
      '</div>' +
      '<div class="pr-grid" id="prGrid"></div>' +
    '</div>';
  renderProductGrid();
  const urlInput = view.querySelector('#prUrl');
  const go = () => { const v = urlInput.value.trim(); if (v) addProductFromUrl(v); };
  view.querySelector('#prUrlGo').onclick = go;
  urlInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  view.querySelector('#prManual').onclick = () => openCreateProduct();
}

function renderProductGrid() {
  const grid = document.getElementById('prGrid');
  if (!grid) return;
  const products = loadProducts();
  grid.innerHTML = products.map((p) =>
    '<div class="pr-card" data-id="' + esc(p.id) + '">' +
      (p.image
        ? '<div class="pr-thumb"><img src="' + esc(p.image) + '" alt="" loading="lazy" /></div>'
        : '<div class="pr-thumb pr-thumb-empty">📦</div>') +
      '<button class="pr-menu-btn" aria-label="Options">⋯</button>' +
      '<div class="pr-menu">' +
        '<button data-act="gen">Generate ad</button>' +
        '<button data-act="del" class="pr-menu-del">Remove</button>' +
      '</div>' +
      '<div class="pr-name">' + esc(p.name || 'Product') + '</div>' +
    '</div>').join('');
  grid.querySelectorAll('.pr-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.pr-menu-btn').onclick = (e) => { e.stopPropagation(); toggleProductMenu(card); };
    card.querySelector('[data-act="gen"]').onclick = (e) => { e.stopPropagation(); startProductAd(id); };
    card.querySelector('[data-act="del"]').onclick = (e) => { e.stopPropagation(); removeProduct(id); };
  });
}

function toggleProductMenu(card) {
  const open = card.classList.contains('menu-open');
  document.querySelectorAll('.pr-card.menu-open').forEach((c) => c.classList.remove('menu-open'));
  if (!open) {
    card.classList.add('menu-open');
    const close = (e) => { if (!card.contains(e.target)) { card.classList.remove('menu-open'); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

function removeProduct(id) {
  saveProducts(loadProducts().filter((p) => p.id !== id));
  renderProductGrid();
}

async function addProductFromUrl(url) {
  const grid = document.getElementById('prGrid');
  if (!grid) return;
  const inp = document.getElementById('prUrl'); if (inp) inp.value = '';
  const loader = document.createElement('div');
  loader.className = 'pr-card pr-loading';
  loader.innerHTML = '<div class="pr-ring"></div><div class="pr-load-t">Creating product</div><div class="pr-load-s">It takes a few seconds</div>';
  grid.insertBefore(loader, grid.firstChild);
  try {
    const res = await apiFetch('/api/product/scan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    const img = data.image || '';
    const p = { id: prUid(), name: data.name || 'Product', desc: (data.desc || '').slice(0, 300), image: img, images: img ? [img] : [], site: data.site || '', at: Date.now() };
    const list = loadProducts(); list.unshift(p); saveProducts(list);
    renderProductGrid();
  } catch {
    loader.className = 'pr-card pr-loading pr-error';
    loader.innerHTML = '<div class="pr-load-t">Couldn’t read that link</div><div class="pr-load-s">Try “Create manually” instead.</div>';
    setTimeout(() => loader.remove(), 4500);
  }
}

function downscaleImage(file, max) {
  return new Promise((resolve) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      try { resolve(c.toDataURL('image/jpeg', 0.85)); } catch { resolve(''); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); resolve(''); };
    img.src = src;
  });
}

function openCreateProduct() {
  if (document.querySelector('.credits-overlay')) return;
  let imgData = '';
  const ov = document.createElement('div');
  ov.className = 'credits-overlay';
  ov.innerHTML = '<div class="cp-box pr-modal">' +
    '<div class="cp-head"><div class="cp-title">Create product</div><button type="button" class="cp-close">✕</button></div>' +
    '<div class="pr-modal-body">' +
      '<label class="pr-upload" id="prUpload">' +
        '<input type="file" accept="image/*" id="prFile" hidden />' +
        '<div class="pr-upload-inner" id="prUploadInner">' +
          '<div class="pr-upload-ico">⬆</div><div class="pr-upload-t">Upload product image</div><div class="pr-upload-sub">PNG or JPG</div>' +
        '</div>' +
      '</label>' +
      '<div class="pr-fields">' +
        '<label class="pr-flabel">Product name <span class="pr-req">*</span></label>' +
        '<input class="pr-in" id="prName" placeholder="Enter product name" autocomplete="off" required />' +
        '<label class="pr-flabel">Description</label>' +
        '<textarea class="pr-ta" id="prDesc" placeholder="Describe your product"></textarea>' +
        '<button type="button" class="pr-create" id="prCreate" disabled>Create product</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  document.body.appendChild(ov);
  const fileInput = ov.querySelector('#prFile');
  const inner = ov.querySelector('#prUploadInner');
  const nameInp = ov.querySelector('#prName');
  const descInp = ov.querySelector('#prDesc');
  const createBtn = ov.querySelector('#prCreate');
  // Product name is required to save; the image is optional.
  const refresh = () => { createBtn.disabled = !nameInp.value.trim(); };
  fileInput.onchange = async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    imgData = await downscaleImage(f, 720);
    if (imgData) inner.innerHTML = '<img class="pr-upload-img" src="' + esc(imgData) + '" alt="" />';
    refresh();
  };
  nameInp.oninput = refresh;
  // One close path so the keydown listener is always removed (closing via ✕ or
  // the backdrop used to leak one listener per open).
  let onKey;
  const close = () => { ov.remove(); if (onKey) document.removeEventListener('keydown', onKey); };
  createBtn.onclick = () => {
    if (createBtn.disabled) return;
    const p = { id: prUid(), name: nameInp.value.trim().slice(0, 120), desc: descInp.value.trim().slice(0, 500), image: imgData, images: imgData ? [imgData] : [], site: '', at: Date.now() };
    const list = loadProducts(); list.unshift(p); saveProducts(list);
    close();
    renderProducts();
  };
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelector('.cp-close').onclick = close;
  onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  setTimeout(() => nameInp.focus(), 30);
}

// Start an ad from a saved product: drop into the composer prefilled.
function startProductAd(id) {
  const p = loadProducts().find((x) => x.id === id);
  if (!p) return;
  showView('home');
  const input = document.getElementById('input');
  if (input) {
    input.value = 'Create a polished, scroll-stopping ad for ' + (p.name || 'my product') + (p.desc ? ' — ' + p.desc : '') + '.';
    if (typeof autoGrow === 'function') autoGrow(input);
    input.focus();
  }
}

function initAuthGate() {
  const form = document.getElementById('authForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); submitAuth(); });
  const toggle = document.getElementById('authToggle');
  if (toggle) toggle.addEventListener('click', () => setAuthMode(authMode === 'up' ? 'in' : 'up'));
  const forgot = document.getElementById('authForgot');
  if (forgot) forgot.addEventListener('click', onAuthBack);
  const resend = document.getElementById('authResend');
  if (resend) resend.addEventListener('click', resendAuthCode);
  renderAuthStep();
  if (window.Auth && Auth.isSignedIn()) enterApp();
  else showAuthGate();
}

// ── Gallery view: every generation across all (synced) chats ──
let galFilter = 'all';   // all | video | image | audio
let galSort = 'new';     // new | old

function galleryItems() {
  const seen = new Set();
  const out = [];
  let seq = 0;
  chatStore.chats.forEach((c) => (c.msgs || []).forEach((m) => {
    if (m.t === 'media' && m.url && !seen.has(m.url)) {
      seen.add(m.url);
      out.push({ chatId: c.id, kind: m.kind || 'video', url: m.url, prompt: m.prompt, at: m.at || 0, seq: seq++ });
    }
  }));
  const filtered = galFilter === 'all' ? out : out.filter((i) => i.kind === galFilter);
  // Old media has no timestamp — insertion order stands in for age.
  filtered.sort((a, b) => (a.at - b.at) || (a.seq - b.seq));
  if (galSort === 'new') filtered.reverse();
  return filtered;
}

function setGalFilter(f) {
  galFilter = f;
  document.querySelectorAll('.g-chip').forEach((c) => c.classList.toggle('active', c.dataset.f === f));
  renderGallery();
}

function toggleGalSort() {
  galSort = galSort === 'new' ? 'old' : 'new';
  const b = document.getElementById('gallerySort');
  if (b) b.textContent = galSort === 'new' ? 'Newest first ▾' : 'Oldest first ▴';
  renderGallery();
}

// Last-known storage status for the usage bar: { used, cap, tier } in bytes.
// cap 0 = no gallery storage (free/lapsed/top-up-only — saving is a paid perk).
let galStorage = null;

function fmtStorageBytes(n) {
  n = Number(n) || 0;
  const gb = n / 1073741824;
  if (gb >= 1) return gb.toFixed(gb >= 10 ? 0 : 1) + ' GB';
  const mb = n / 1048576;
  if (mb >= 1) return mb.toFixed(mb >= 10 ? 0 : 1) + ' MB';
  const kb = n / 1024;
  if (kb >= 1) return Math.round(kb) + ' KB';
  return n + ' B';
}

// Pull fresh usage from the worker, then repaint. Called on gallery open and
// after a delete; filter/sort clicks repaint from the cached value instead.
async function refreshStorageBar() {
  try {
    const r = await apiFetch('/api/storage');
    if (r && r.ok) galStorage = await r.json();
  } catch {}
  paintStorageBar();
}

function paintStorageBar() {
  const el = document.getElementById('galleryStorage');
  if (!el) return;
  const s = galStorage;
  if (!s) { el.style.display = 'none'; return; }
  el.style.display = '';
  if (!s.cap) { // free / lapsed / top-up-only: gallery storage is a subscription benefit
    el.innerHTML =
      '<div class="gs-note">Saving to your gallery is a <b>paid feature</b>. ' +
      '<button class="gs-cta" data-act="gal-upgrade">Upgrade to keep your creations →</button></div>';
    wireActions(el);
    return;
  }
  const pct = s.cap ? Math.min(100, Math.round((s.used / s.cap) * 100)) : 0;
  const cls = pct >= 100 ? 'full' : pct >= 85 ? 'warn' : '';
  const tier = (s.tier || '').charAt(0).toUpperCase() + (s.tier || '').slice(1);
  el.innerHTML =
    '<div class="gs-row">' +
      '<span class="gs-label">Storage' + (tier ? '<span class="gs-tier">' + tier + '</span>' : '') + '</span>' +
      '<span class="gs-usage">' + fmtStorageBytes(s.used) + ' / ' + fmtStorageBytes(s.cap) + '</span>' +
    '</div>' +
    '<div class="gs-track"><div class="gs-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
    (pct >= 100
      ? '<div class="gs-note">Your gallery is full — free up space or <button class="gs-cta" data-act="gal-upgrade">move up a tier →</button></div>'
      : '');
  wireActions(el);
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  paintStorageBar();
  const items = galleryItems();
  const sub = document.getElementById('gallerySub');
  if (sub) sub.textContent = items.length ? items.length + (items.length === 1 ? ' creation' : ' creations') : '';
  const empty = document.getElementById('galleryEmpty');
  if (empty) {
    empty.style.display = items.length ? 'none' : '';
    empty.textContent = galFilter === 'all'
      ? 'Nothing here yet — everything you generate lands in your gallery.'
      : 'No ' + (galFilter === 'audio' ? 'audio' : galFilter + 's') + ' yet.';
  }
  grid.innerHTML = '';
  items.forEach((it) => {
    const d = document.createElement('div');
    d.className = 'g-item';
    let media;
    if (it.kind === 'image') {
      media = document.createElement('img');
      media.src = it.url; media.loading = 'lazy'; media.alt = '';
      media.onclick = () => openLightbox('image', it.url);
    } else if (it.kind === 'audio') {
      media = document.createElement('div');
      media.className = 'g-audio';
      media.innerHTML = '<span class="note">♪</span>';
      const au = document.createElement('audio');
      au.controls = true; au.preload = 'none'; au.src = it.url;
      media.appendChild(au);
    } else {
      media = document.createElement('video');
      media.src = it.url; media.preload = 'metadata'; media.muted = true;
      media.onmouseenter = () => { media.play().catch(() => {}); };
      media.onmouseleave = () => { media.pause(); media.currentTime = 0; };
      media.onclick = () => openLightbox('video', it.url);
      // Free accounts: same on-screen mark as the chat player.
      d.classList.add('wm-spot');
      if (paidKnown && !isPaid) d.appendChild(wmBadge());
    }
    d.appendChild(media);
    if (it.prompt) {
      const p = document.createElement('div');
      p.className = 'g-prompt'; p.textContent = it.prompt;
      d.appendChild(p);
    }
    const actions = document.createElement('div');
    actions.className = 'g-actions';
    const dl = document.createElement('a');
    dl.className = 'g-btn'; dl.textContent = '⤓'; dl.title = 'Download';
    // Only ever link to a real media URL — never let a stored value smuggle a
    // javascript: URL into an anchor (self-XSS on click).
    dl.href = /^(https?:|blob:|data:)/i.test(it.url || '') ? it.url : '#';
    dl.download = ''; dl.target = '_blank'; dl.rel = 'noopener';
    const del = document.createElement('button');
    del.className = 'g-btn'; del.textContent = '🗑'; del.title = 'Delete';
    del.onclick = () => galleryDelete(it, d);
    actions.appendChild(dl); actions.appendChild(del);
    d.appendChild(actions);
    grid.appendChild(d);
  });
}

async function galleryDelete(it, el) {
  if (!confirm('Delete this from your gallery and its chat?')) return;
  el.remove();
  const chat = chatStore.chats.find((c) => c.id === it.chatId);
  if (chat) {
    const i = chat.msgs.findIndex((m) => m.t === 'media' && m.url === it.url);
    if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); touchSync(chat.id); }
  }
  const m = it.url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  if (m && window.Auth) { try { await Auth.storageDelete(m[1]); } catch {} }
  renderGallery();
  refreshStorageBar(); // freed space → refresh the usage bar
}

// ── Workspace views (Home / Projects / Gallery / Studio) ──
// Navigation is a dropdown in the topbar; the left sidebar (chat history) shows
// on Home only, so every other view gets the full width.
const VIEW_LABELS = { landing: 'Home', home: 'Builder', projects: 'Projects', gallery: 'Gallery', studio: 'Studio', products: 'Products', avatar: 'Avatar', settings: 'Settings' };
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view' + name.charAt(0).toUpperCase() + name.slice(1));
  if (el) el.classList.add('active');
  if (name === 'landing') renderLanding();
  if (name === 'gallery') { renderGallery(); refreshStorageBar(); }
  if (name === 'products') renderProducts();
  if (name === 'avatar') renderAvatar();
  if (name === 'settings') renderSettings();
  document.querySelectorAll('.side-item[data-view], .nav-dd-item[data-view]').forEach((i) =>
    i.classList.toggle('active', i.dataset.view === name));
  const lbl = document.getElementById('navDdLabel');
  if (lbl) lbl.textContent = VIEW_LABELS[name] || 'Home';
  // Studio hides the sidebar and navigates via the topbar dropdown; every other
  // view keeps the normal sidebar (with its nav) and no dropdown.
  const isStudio = name === 'studio';
  const sb = document.querySelector('.sidebar');
  if (sb) sb.style.display = isStudio ? 'none' : '';
  const dd = document.getElementById('navDd');
  if (dd) dd.style.display = isStudio ? '' : 'none';
  // The full-width bar only exists to hold the Studio dropdown; the logo lives
  // in the sidebar on every other view.
  const tb = document.querySelector('.topbar');
  if (tb) tb.style.display = isStudio ? 'flex' : 'none';
  // Chat history is Home-only.
  const chats = document.getElementById('homeChats');
  if (chats) chats.style.display = name === 'home' ? '' : 'none';
  const menu = document.getElementById('navDdMenu');
  if (menu) menu.classList.remove('open');
}
function toggleNavMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('navDdMenu');
  if (menu) menu.classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const dd = document.getElementById('navDd');
  const menu = document.getElementById('navDdMenu');
  if (menu && menu.classList.contains('open') && dd && !dd.contains(e.target)) menu.classList.remove('open');
  const prof = document.getElementById('signOutRow');
  const pop = document.getElementById('profilePop');
  if (pop && pop.classList.contains('open') && prof && !prof.contains(e.target)) pop.classList.remove('open');
});

// Top-right account menu.
function toggleProfileMenu(e) {
  e.stopPropagation();
  const pop = document.getElementById('profilePop');
  if (pop) pop.classList.toggle('open');
}

// ── Studio lives in studio.js (shot-based projects) ──

// ── Declarative event wiring (CSP-safe) ───────────────────────────────────
// The HTML carries data-act / data-change / data-input / data-keydown hooks
// instead of inline on* handlers, so the CSP can drop script-src 'unsafe-inline'.
// Listeners are attached directly to each element (not document-delegated) to
// preserve the stopPropagation() semantics the menu toggles rely on. Handlers
// are resolved from these tables at click time, so studio.js globals referenced
// below are fine even though studio.js loads after this file.
const CLICK_ACTIONS = {
  'view': (e, el) => showView(el.dataset.view),
  'new-chat': () => newChat(),
  'credits': () => openCredits(),
  'credits-topup': () => openCredits(true),
  'profile-menu': (e) => toggleProfileMenu(e),
  'nav-menu': (e) => toggleNavMenu(e),
  'sign-out': () => doSignOut(),
  'effort-menu': (e) => toggleEffortMenu(e),
  'set-effort': (e, el) => setEffort(el.dataset.effort),
  'ap-row': (e, el) => toggleApRow(el.dataset.row),
  'ap-info': (e, el) => showApInfo(el.dataset.info, e, el),
  'img-src': (e, el) => openImgSrc(el.dataset.src, e),
  'img-pick': (e, el) => imgSrcPick(el.dataset.pick, e),
  'file': (e, el) => { const f = document.getElementById(el.dataset.file); if (f) f.click(); },
  'dir-menu': (e) => toggleDirMenu(e),
  'set-mode': (e, el) => setMode(el.dataset.mode),
  'model-menu': (e) => toggleModelMenu(e),
  'opt-settings': (e) => toggleOpt(e, 'settings'),
  'send': () => send(true),
  'presets-open': () => togglePresets(true),
  'presets-close': () => togglePresets(false),
  'gal-filter': (e, el) => setGalFilter(el.dataset.f),
  'gal-sort': () => toggleGalSort(),
  'gal-upgrade': () => openCredits(),
  'studio-send': () => studioSend(),
  'sb-speed': () => sbCycleSpeed(),
  'sb-mute': () => sbToggleMute(),
  'sb-prev': () => sbPrevShot(),
  'sb-play': () => sbTogglePlay(),
  'sb-next': () => sbNextShot(),
  'sb-fs': () => sbFullscreenPreview(),
  'sb-playall': () => sbPlayAll(),
  'sb-export': () => sbExport(),
};
const CHANGE_ACTIONS = {
  'attach': (e, el) => onAttach(el.dataset.attach, el),
  'attach-extra': (e, el) => onAttachExtra(el),
  'attach-ref': (e, el) => onAttachRef(el),
  'sb-project': (e, el) => sbSwitchProject(el.value),
};
const INPUT_ACTIONS = {
  'search': () => renderChatList(),
  'autogrow': (e, el) => autoGrow(el),
};
const KEYDOWN_ACTIONS = {
  'send': (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } },
  'studio-send': (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); studioSend(); } },
  'credits-topup': (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCredits(true); } },
};
function wireActions(root) {
  const scope = root || document;
  const bind = (attr, evt, table) => scope.querySelectorAll('[' + attr + ']').forEach((el) => {
    const flag = '_w_' + evt;
    if (el[flag]) return; el[flag] = true;
    const fn = table[el.getAttribute(attr)];
    if (fn) el.addEventListener(evt, (e) => fn(e, el));
  });
  bind('data-act', 'click', CLICK_ACTIONS);
  bind('data-change', 'change', CHANGE_ACTIONS);
  bind('data-input', 'input', INPUT_ACTIONS);
  bind('data-keydown', 'keydown', KEYDOWN_ACTIONS);
}

// Keyboard navigation for the dropdown menus (model / effort / settings / dir /
// image-source), which are otherwise click-only: ↑/↓ move between items,
// Enter/Space picks the focused one, Esc closes.
document.addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(e.key)) return;
  const menu = document.querySelector('.model-menu.open');
  if (!menu) return;
  if (e.key === 'Escape') { menu.classList.remove('open'); return; }
  const items = [...menu.querySelectorAll('.model-item')].filter((el) => el.getClientRects().length);
  if (!items.length) return;
  items.forEach((el) => { el.setAttribute('role', 'menuitem'); if (!el.hasAttribute('tabindex')) el.tabIndex = -1; });
  const idx = items.indexOf(document.activeElement);
  if (e.key === 'Enter' || e.key === ' ') { if (idx >= 0) { e.preventDefault(); items[idx].click(); } return; }
  e.preventDefault();
  items[e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx <= 0 ? items.length - 1 : idx - 1)].focus();
});

// Init
wireActions();
buildMenu();
buildOptMenus();
renderAttach('audio');
loadStore();
loadMemory();
renderChatList();
renderThread();

// Hero ambience drifts gently toward the cursor (rAF-throttled).
(function initHeroParallax() {
  const amb = document.getElementById('hhAmb');
  const area = document.querySelector('.view-home .thread');
  if (!amb || !area) return;
  let raf = 0;
  area.addEventListener('mousemove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = area.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - .5;
      const dy = (e.clientY - r.top) / r.height - .5;
      amb.style.transform = 'translate(' + (dx * 28).toFixed(1) + 'px, ' + (dy * 20).toFixed(1) + 'px)';
    });
  });
})();

initAuthGate();

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  // If already signed in, run it now; otherwise hold it so enterApp picks it up
  // once the visitor authenticates, instead of losing the prompt at the gate.
  if (window.Auth && Auth.isSignedIn()) startDirector(firstMsg);
  else pendingFirstMsg = firstMsg;
}
// Back from Stripe: the webhook mints the credits — poll the balance so the
// chip catches up even if the webhook lands a few seconds after we do.
if (params.get('credits') === 'added') {
  window.history.replaceState({}, '', location.pathname);
  if (window.Auth && Auth.isSignedIn()) {
    addMsg('agent', '✦ Payment received — your credits are landing now.');
    setTimeout(fetchCredits, 2500);
    setTimeout(fetchCredits, 8000);
  }
}
