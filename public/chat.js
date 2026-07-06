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
    caps: { image: true, end: false, avatar: false },
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

const attachments = { image: null, avatar: null, end: null, audio: null, clip: null };
// Extra reference images beyond the first (multi-image models only).
const extraImages = [];
const ATTACH_LABELS = {
  image: '<span class="plus-big">+</span>',
  avatar: '<span class="plus-big">+</span>',
  audio: '+ Audio',
  clip: '+ Video clip',
  end: '<span class="plus-big">+</span>',
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
    if (kind === 'audio') { awName = (file.name || 'audio').replace(/[<>&"]/g, ''); awDecode(reader.result); }
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
    awPlayer.play();
  }
  awIcon();
}

function renderAudioSlot(btn) {
  if (attachments.audio) {
    btn.classList.add('has');
    const dur = Math.round(awDur || 0);
    const meta = (awName || 'audio') + (dur ? ' · ' + Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0') : '');
    btn.innerHTML = awBarsHtml(awPeaks || awPlaceholder(0.25), true)
      + '<span class="aw-play" onclick="awToggle(event)">▶</span>'
      + '<span class="aw-meta">' + meta + '</span>'
      + '<span class="x" onclick="clearAttach(event, \'audio\')">×</span>';
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
      : '<img src="' + attachments[kind] + '" alt="" />';
    btn.innerHTML = preview + '<span class="x" onclick="clearAttach(event, \'' + kind + '\')">×</span>';
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
  const anySlot = !!(caps.image || caps.avatar || caps.audio || caps.clip || caps.end);
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
      out.push(m.url);
    }
  }));
  return out.reverse(); // newest first
}

function openGalleryPicker() {
  const old = document.querySelector('.gal-overlay');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'gal-overlay';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const urls = galleryImages();
  const grid = urls.length
    ? '<div class="gal-grid">' + urls.map((u) => '<img src="' + u + '" alt="" />').join('') + '</div>'
    : '<div class="gal-empty">Nothing in your gallery yet — images you generate will show up here.</div>';
  ov.innerHTML = '<div class="gal-box"><div class="gal-head"><span class="gal-title">Pick from your gallery</span>'
    + '<span class="gal-sub">' + (urls.length ? urls.length + (urls.length === 1 ? ' image' : ' images') : '') + '</span>'
    + '<button class="gal-close" onclick="this.closest(\'.gal-overlay\').remove()">×</button></div>' + grid + '</div>';
  ov.querySelectorAll('.gal-grid img').forEach((img) => {
    img.onclick = () => { useGalleryImage(img.src); ov.remove(); };
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
    d.innerHTML = '<img src="' + src + '" alt="" /><span class="x">×</span>';
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
  const cur = MODEL_LISTS[mode].find((m) => m.id === model);
  document.getElementById('modelLabel').textContent = cur.label;
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
// Prompt-help mode chip (top-right of the composer). Three modes:
//   auto — Zephyr composes and makes every creative call, never asks
//   plan — Zephyr interviews first (the question popup), then composes
//   off  — raw prompting: the text goes to the model exactly as typed,
//          and the director surcharge disappears from the price
const DIR_MODE_KEY = 'zephyr_director_mode';
const DIR_MODES = {
  auto: { icon: '', label: 'Auto', desc: 'Zephyr writes the prompt and generates right away' },
  plan: { icon: '', label: 'Plan', desc: 'Zephyr shows you the plan to approve before generating' },
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
  document.getElementById('homeSlide').classList.toggle('show-presets', open);
  document.getElementById('drawerArrow').setAttribute('aria-expanded', open);
}

function toggleEffortMenu(e) {
  e.stopPropagation();
  if (directorMode === 'off') return; // raw mode: effort has nothing to control
  const menu = document.getElementById('effortMenu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
// Raw mode greys the effort picker out — the knob only shapes the prompt
// Zephyr writes, and in raw mode Zephyr isn't writing one.
function renderEffortLock() {
  const pick = document.querySelector('.effort-pick');
  if (!pick) return;
  const off = directorMode === 'off';
  pick.classList.toggle('locked', off);
  pick.querySelector('.opt-btn').title = off
    ? 'Effort applies when Zephyr writes the prompt — turn prompt help back on to use it'
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
      body: JSON.stringify({ model, prompt: "Hi, I'm " + name + ". This is how I sound.", voice: name }),
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

// Wall-clock caption under a bubble, e.g. "11:03 PM" (user) / "Zephyr · 11:03 PM" (agent).
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
  t.textContent = kind === 'agent' ? 'Zephyr · ' + fmtTime(ts) : fmtTime(ts);
  return t;
}

function addMsg(kind, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + kind;
  if (kind.includes('typing')) {
    div.innerHTML = text + ' <span class="dots"></span>';
  } else {
    div.textContent = text;
  }
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
    if (s && Array.isArray(s.chats)) { chatStore = s; }
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
let lastPull = 0;

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
      await fetch(SYNC_ENDPOINT + '?on_conflict=user_id,id', {
        method: 'POST',
        headers: Object.assign({}, h, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(rows),
      });
    }
    for (const id of dels) {
      await fetch(SYNC_ENDPOINT + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: h });
    }
  } catch {
    // Network hiccup — requeue everything for the next flush.
    ids.forEach((id) => syncDirty.add(id));
    dels.forEach((id) => syncDeleted.add(id));
  }
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
    const remoteAt = Date.parse(r.updated_at) || 0;
    const local = chatStore.chats.find((c) => c.id === r.id);
    if (!local) {
      chatStore.chats.push({
        id: r.id, title: r.title || 'New chat', brief: r.brief || undefined,
        lastPrompt: r.last_prompt || undefined,
        msgs: Array.isArray(r.msgs) ? r.msgs : [], updatedAt: remoteAt,
      });
      changed = true;
    } else if (remoteAt > (local.updatedAt || 0)) {
      local.title = r.title || local.title;
      local.brief = r.brief || undefined;
      local.lastPrompt = r.last_prompt || undefined;
      if (Array.isArray(r.msgs)) local.msgs = r.msgs;
      local.updatedAt = remoteAt;
      changed = true;
    } else if ((local.updatedAt || 0) > remoteAt) {
      syncDirty.add(local.id); // local is ahead — push it back up
    }
  });
  // Local chats the server has never seen ride up too.
  chatStore.chats.forEach((c) => {
    if (c.msgs.length && !rows.some((r) => r.id === c.id)) syncDirty.add(c.id);
  });
  if (syncDirty.size) { clearTimeout(syncTimer); syncTimer = setTimeout(pushChats, 1200); }
  if (changed) {
    chatStore.chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!chatStore.chats.find((c) => c.id === chatStore.active)) {
      chatStore.active = (chatStore.chats[0] || {}).id || null;
    }
    persistStore();
    renderChatList();
    renderThread();
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
  else saveToChat(chatId, { t: 'agent', text });
}
function deliverMedia(chatId, kind, url, prompt) {
  saveToChat(chatId, { t: 'media', kind, url, at: Date.now(), prompt: prompt ? String(prompt).slice(0, 300) : undefined });
  if (chatStore.active === chatId) threadAppend(buildMedia(kind, url, prompt));
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
  if (kind === 'video' && window.sbAddFromChat) {
    const st = document.createElement('button');
    st.className = 'media-btn'; st.type = 'button'; st.title = 'Add to Studio as a shot'; st.textContent = '🎬';
    st.onclick = async (e) => {
      e.stopPropagation();
      st.textContent = '…';
      const n = await sbAddFromChat(url, prompt || '');
      st.textContent = '✓';
      setTimeout(() => { st.textContent = '🎬'; }, 1500);
      deliverAgent(chatStore.active, 'Added to Studio as shot ' + n + ' of “' + sbProject().title + '” — open Studio to direct it.');
    };
    actions.appendChild(st);
  }
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
  lightboxEl.querySelector('.lb-dl').onclick = () => downloadMedia(url, kind);
  lightboxEl.classList.add('open');
}
function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.classList.remove('open');
  lightboxEl.querySelector('.lb-stage').innerHTML = ''; // stop playback
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

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
    visual.style.aspectRatio = aspect || ratioAspect(ratio);
    // The ghost loop plays inside the frame; the poster covers the first beat.
    visual.innerHTML = '<video autoplay muted loop playsinline poster="/loading-ghost.webp">'
      + '<source src="/loading-ghost.webm" type="video/webm" />'
      + '<source src="/loading-ghost.mp4" type="video/mp4" /></video>';
  }

  const status = document.createElement('div');
  status.className = 'gen-status';
  status.innerHTML = '<span class="gen-spinner"></span><span class="gen-status-text"></span>';

  wrap.appendChild(visual);
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
}
function setGenText(chatId, t) {
  const gen = activeGens.get(chatId);
  if (gen) gen.text = t;
  if (chatStore.active === chatId) {
    const el = document.querySelector('#genLoader .gen-status-text');
    if (el) el.textContent = t;
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

function savesLoad() { try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch { return []; } }
function savesWrite(list) { try { localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(-20))); } catch {} }
function queuePendingSave(url, kind) { savesWrite([...savesLoad().filter((p) => p.url !== url), { url, kind, at: Date.now() }]); }

// Copy a fal output into permanent Supabase Storage, with bounded retries —
// a failed copy must never silently become the permanent record.
async function trySave(url, kind, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const sv = await apiFetch('/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, kind }),
      });
      if (sv.ok) { const d = await sv.json(); if (d.url) return d.url; }
      if (sv.status === 401) return null; // signed out — retrying now won't help
    } catch {}
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
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
    const perm = await trySave(p.url, p.kind, 1);
    if (perm) replaceMediaUrl(p.url, perm);
    else keep.push(p);
  }
  savesWrite(keep);
}

// Boot: pick up any generation that was in flight when the tab last died.
function resumeJobs() {
  const jobs = jobsLoad().filter((j) => j.chatId && j.statusUrl && j.responseUrl);
  jobsWrite(jobs);
  jobs.forEach((j) => {
    if (activeGens.has(j.chatId)) return;
    const kind = j.kind || 'video';
    const myGen = { kind, aspect: j.aspect, text: 'Checking on your ' + kind + '…', statusUrl: j.statusUrl };
    activeGens.set(j.chatId, myGen);
    updateSendLock();
    mountGenLoader();
    // Give even a stale job a real chance — fal keeps results around for days.
    const deadline = Math.max(Date.now() + 90000, j.deadline || 0);
    const mins = Math.max(2, Math.round((deadline - Date.now()) / 60000));
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
// The dot meter shows the balance against the highest balance this browser
// has seen (plan size / last top-up) — a Higgsfield-style "credits left" bar.
const CRED_MAX_KEY = 'zephyr_cred_max_v1';
const CRED_SEGS = 12;
function renderCredDots(el, frac) {
  if (!el) return;
  if (!el.childElementCount) {
    for (let i = 0; i < CRED_SEGS; i++) el.appendChild(document.createElement('i'));
  }
  const on = Math.max(frac > 0 ? 1 : 0, Math.round(frac * CRED_SEGS));
  [...el.children].forEach((d, i) => d.classList.toggle('on', i < on));
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
  renderCredDots(document.getElementById('credDots'), frac);
  renderCredDots(document.getElementById('credDotsMenu'), frac);
  const pill = document.getElementById('credPill');
  if (pill) pill.classList.add('show');
}
async function fetchCredits() {
  try {
    const r = await apiFetch('/api/credits');
    if (!r.ok) return;
    const d = await r.json();
    if (typeof d.balance === 'number') { setCredits(d.balance); maybeShowWelcome(d.balance); }
  } catch {}
}

// One-time welcome banner for fresh accounts: makes the signup grant feel
// intentional and points at the plans. Shows only while the account still
// looks new (grant-sized balance, no chat history), until dismissed.
const WELCOME_KEY = 'zephyr_welcome_v1';
function maybeShowWelcome(balance) {
  try {
    if (localStorage.getItem(WELCOME_KEY)) return;
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
      '<p class="wm-sub">Enough for a few images or a voice line — every model, one balance. Ready for video? Plans start at $25/mo.</p>' +
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
const MEMBERSHIPS = [
  { plan: '25', usd: 25, credits: 2000, name: 'Plus', klass: 't-plus', off: '10% OFF', strike: 28,
    desc: 'For getting started with AI creation',
    imgs: '1,000', vids: '13',
    save: 'Save $3/mo while the launch offer lasts',
    feats: [1, 1, 1, 0, 0] },
  { plan: '50', usd: 50, credits: 4000, name: 'Pro', klass: 't-pro best', off: '20% OFF', strike: 63, pop: 1,
    desc: 'For consistent, everyday creation',
    imgs: '2,000', vids: '26',
    save: 'Save $13/mo while the launch offer lasts',
    feats: [1, 1, 1, 1, 0] },
  { plan: '100', usd: 100, credits: 8000, name: 'Max', klass: 't-max', off: '25% OFF', val: 'Best value', strike: 133,
    desc: 'For creators building big projects',
    imgs: '4,000', vids: '53',
    save: 'Save $33/mo while the launch offer lasts',
    feats: [1, 1, 1, 1, 1] },
];
// Launch-offer countdown target (shown live on the pricing page).
const OFFER_END = '2026-07-13T23:59:59';
const MEMBER_ROWS = [
  'All video, image &amp; voice models',
  'Unused credits roll over',
  'Cancel anytime',
  'Enough for daily video (~26/mo)',
  'Studio-scale output (~53 videos/mo)',
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
        '<div class="up-credeq">= ' + p.imgs + ' Nano Banana images</div>' +
        '<div class="up-credeq">~ ' + p.vids + ' Kling 2.5 videos</div>' +
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
      '<div class="up-modelbox">' +
        '<div class="up-mtitle">Model access</div>' +
        ['Veo 3', 'Sora 2', 'Kling 2.5 &amp; more'].map((m) =>
          '<div class="up-mrow"><span>' + m + '</span><span class="up-full">Full access</span></div>').join('') +
      '</div>' +
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
        '<div class="up-models">' + ['Veo 3', 'Sora 2', 'Kling 2.5', 'Seedance', 'Nano Banana', 'ElevenLabs', '+ more'].map((m) => '<span class="up-mchip">' + m + '</span>').join('') + '</div>' +
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
    const end = new Date(OFFER_END).getTime();
    const two = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { cEl.textContent = 'soon'; return; }
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

// Failures become a conversation: Zephyr explains what went wrong in plain
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
      deliverAgent(origin, '⚡ Not enough credits — this run needs ' + (job.cost ? job.cost + ' credits' : 'more than you have') + '. Tap your ✦ balance in the sidebar to get more.');
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
  try {
    let state = '';
    while (Date.now() < deadline) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(statusUrl));
      if (sr.status === 401) {
        if (alive()) { endGen(origin); deliverAgent(origin, '⚠️ Your session expired mid-generation — sign in again; the job may still finish on fal.'); }
        return;
      }
      const st = await sr.json();
      if (!alive()) return; // cancelled while polling
      state = st.status;
      if (state === 'COMPLETED') break;
      setGenText(origin,
        state === 'IN_PROGRESS'
          ? label + ' is generating your ' + kind + '…'
          : 'Queued at ' + label + (st.queue_position != null ? ' (#' + st.queue_position + ')' : '') + '…');
      await new Promise((r) => setTimeout(r, 4000));
      if (!alive()) return;
    }

    if (state !== 'COMPLETED') {
      endGen(origin);
      deliverAgent(origin, '⚠️ Timed out after ' + maxWaitMin + ' minutes — the job may still finish on fal.ai.');
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
    if (urls.length) {
      // Copy to permanent storage — fal URLs expire after a few days.
      setGenText(origin, urls.length > 1 ? 'Saving ' + urls.length + ' images…' : 'Saving to your gallery…');
      const finals = [];
      let saveFailed = false;
      for (const u of urls) {
        const perm = await trySave(u, kind, 3);
        if (perm) finals.push(perm);
        else { finals.push(u); saveFailed = true; queuePendingSave(u, kind); }
      }
      if (!alive()) return;
      endGen(origin);
      finals.forEach((f) => deliverMedia(origin, kind, f, text));
      if (saveFailed) deliverAgent(origin, '⚠️ Delivered with a temporary link — the gallery copy failed, so I queued a retry for the next time the app opens.');
      if (clearInputs) {
        // The inputs were consumed — don't let them ride along on the next prompt.
        Object.keys(attachments).forEach((k) => {
          if (attachments[k]) { attachments[k] = null; renderAttach(k); }
        });
        extraImages.length = 0;
        renderExtraImages();
      }
    } else {
      endGen(origin);
      console.error('generation finished without media:', out);
      deliverAgent(origin, '⚠️ The model finished but returned no ' + kind + ' — try again.');
    }
  } catch {
    if (alive()) deliverAgent(origin, '⚠️ Network hiccup — try again.');
  } finally {
    if (alive()) endGen(origin);
    if (chatStore.active === origin) document.getElementById('input').focus();
  }
}

// ── Director flow (Zephyr) ───────────────────────────────────────────────
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
function directorContext() {
  return {
    model: model,
    duration: mode === 'video' ? duration : undefined,
    ratio: mode !== 'audio' ? ratio : undefined,
    hasImage: !!attachments.image,
    hasEnd: !!attachments.end,
    brief: (activeChat() || {}).brief || undefined,
    effort: effort,
  };
}

// The composer returns an updated per-chat creative brief with each prompt;
// it only becomes the chat's memory when the user APPROVES that prompt.
let pendingBrief = null;

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
      return {
        reply: final.reply || '',
        ready: !!final.ready,
        rerun: !!final.rerun,
        revise: !!final.revise,
      };
    }
    const data = await res.json();
    return {
      reply: data.reply || '',
      ready: !!data.ready,
      rerun: !!data.rerun,
      revise: !!data.revise,
    };
  } catch { return localAsk(text); }
}

// Surgical prompt revision: previous prompt + plain-words feedback → edited prompt.
async function directorRevise(feedback) {
  const prev = (activeChat() || {}).lastPrompt || '';
  pendingBrief = null;
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
    if (data.prompt) return data.prompt;
    throw 0;
  } catch { return prev ? prev + ' ' + feedback : feedback; }
}

async function directorCompose(text, answers) {
  if (mode === 'audio') return text; // voice: speak the words as given
  pendingBrief = null;
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'compose', kind: mode, prompt: text, answers: answers.filter(Boolean),
        history: directorHistory(), ...directorContext(), ...(await directorImage()),
      }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.brief) pendingBrief = String(data.brief).slice(0, 600);
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
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
  const thinking = addMsg('agent typing', 'Zephyr is thinking');
  // Zephyr's reply streams into a live bubble; the final text is re-delivered
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
  // Zephyr's conversational reply (greetings, small talk, or a lead-in).
  if (res.reply) deliverAgent(origin, res.reply);
  // If the user moved to another chat while Zephyr was thinking, stop here —
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
  // A creative request — compose the prompt for review.
  if (res.ready) composeAndReview(text, []);
  // Otherwise (greeting / small talk): the reply alone is the whole turn.
}

async function composeAndReview(text, answers) {
  const origin = chatStore.active;
  const thinking = addMsg('agent typing', 'Writing the prompt');
  let prompt;
  try { prompt = await directorCompose(text, answers); } finally { thinking.remove(); }
  // The user moved to another chat while the prompt was being written —
  // don't pop the review card into the wrong thread.
  if (chatStore.active !== origin) return;
  deliverPrompt(prompt);
}

// Mode split: Plan pops the finished paragraph into the chat for approval;
// Auto commits the brief and generates without stopping.
function deliverPrompt(prompt) {
  if (directorMode === 'plan') { reviewPrompt(prompt); return; }
  const c = activeChat();
  if (pendingBrief && c) { c.brief = pendingBrief; pendingBrief = null; persistStore(); touchSync(c.id); }
  generateMedia(prompt, { announce: false });
}

// The floating dock above the composer (was the question cards; the Plan
// mode card renders here next).
function clearQDock() {
  const dock = document.getElementById('qDock');
  if (dock) dock.innerHTML = '';
}

function reviewPrompt(prompt) {
  const box = document.createElement('div');
  box.className = 'review-card';
  const label = document.createElement('div');
  label.className = 'review-label';
  label.textContent = mode === 'audio'
    ? "I'll voice exactly these words — approve to hear it:"
    : "Here's the plan — approve to run it:";
  const body = document.createElement('div');
  body.className = 'review-prompt'; body.textContent = prompt;
  const actions = document.createElement('div'); actions.className = 'review-actions';
  const deny = document.createElement('button'); deny.className = 'review-deny'; deny.textContent = '✕ Deny';
  const allow = document.createElement('button'); allow.className = 'review-allow';
  // Price the card on the actual prompt/script, not the (now-cleared) input.
  allow.textContent = 'Generate ' + (estimatePrice(mode === 'audio' ? prompt : undefined) || '✦');
  deny.onclick = () => { actions.remove(); label.textContent = 'Denied — tweak it and send again.'; document.getElementById('input').focus(); };
  allow.onclick = () => {
    actions.remove(); label.textContent = 'Approved ✦';
    // Approval is the signal that this direction is right — commit the brief.
    const c = activeChat();
    if (pendingBrief && c) { c.brief = pendingBrief; pendingBrief = null; persistStore(); touchSync(c.id); }
    generateMedia(prompt, { announce: false });
  };
  actions.appendChild(deny); actions.appendChild(allow);
  box.appendChild(label); box.appendChild(body); box.appendChild(actions);
  threadAppend(box);
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
  const email = document.getElementById('authEmail');
  if (email) email.focus();
}
function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.style.display = 'none';
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
  in:    { creds: 'Sign in to Zephyr',   code: 'Check your email' },
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
        [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, 'zephyr_studio_v1', CRED_MAX_KEY]
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      chatStore = { active: null, chats: [] };
      syncDirty.clear(); syncDeleted.clear();
      loadStore();
      renderChatList(); renderThread();
      // Studio holds its projects in memory too — reset it from the wiped store.
      if (typeof sbResetForAccountSwitch === 'function') sbResetForAccountSwitch();
    }
    try { localStorage.setItem('zephyr_owner_v1', uid); } catch {}
  }
  // Signed in — pull the account's chats from the server and merge.
  pullChats();
  fetchCredits();
  // Pick up any generation that was mid-flight when the tab last closed,
  // and re-copy any media whose gallery save failed.
  resumeJobs();
  retryPendingSaves();
}

async function doSignOut() {
  // Flush any unsynced edits first, then wipe this browser's local copy so
  // the next account on this machine never sees — or re-uploads — these chats.
  try { await pushChats(); } catch {}
  try {
    [STORE_KEY, OLD_STORE_KEY, JOBS_KEY, SAVES_KEY, 'zephyr_owner_v1', 'zephyr_studio_v1']
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  await Auth.signOut();
  location.reload();
}

// Settings panel: account info + password change, no browser prompts.
function openSettings() {
  if (document.querySelector('.credits-overlay')) return;
  const pop = document.getElementById('profilePop');
  if (pop) pop.classList.remove('open');
  const email = Auth.email();
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
  const ov = document.createElement('div');
  ov.className = 'credits-overlay';
  ov.innerHTML = '<div class="cp-box cp-narrow st-box">' +
    '<div class="cp-head"><div class="cp-title">Settings</div><button type="button" class="cp-close">✕</button></div>' +
    '<div class="st-sec">Account</div>' +
    '<div class="st-acct">' +
      '<span class="st-av"></span>' +
      '<div class="st-id"><div class="st-name"></div><div class="st-mail"></div></div>' +
    '</div>' +
    '<div class="st-sec">Change password</div>' +
    '<form class="st-form" id="stForm">' +
      '<input type="password" class="st-in" id="stPw" placeholder="New password (min 6 characters)" autocomplete="new-password" />' +
      '<button type="submit" class="st-save">Update</button>' +
    '</form>' +
    '<div class="cp-note" id="stNote"></div>' +
  '</div>';
  ov.querySelector('.st-av').textContent = (name[0] || '·').toUpperCase();
  ov.querySelector('.st-name').textContent = name;
  ov.querySelector('.st-mail').textContent = email;
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.querySelector('.cp-close').onclick = () => ov.remove();
  ov.querySelector('#stForm').onsubmit = async (e) => {
    e.preventDefault();
    const inp = ov.querySelector('#stPw');
    const note = ov.querySelector('#stNote');
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
  document.body.appendChild(ov);
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

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
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
    dl.href = it.url; dl.download = ''; dl.target = '_blank'; dl.rel = 'noopener';
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
}

// ── Workspace views (Home / Projects / Gallery / Studio) ──
// Navigation is a dropdown in the topbar; the left sidebar (chat history) shows
// on Home only, so every other view gets the full width.
const VIEW_LABELS = { home: 'Home', projects: 'Projects', gallery: 'Gallery', studio: 'Studio' };
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view' + name.charAt(0).toUpperCase() + name.slice(1));
  if (el) el.classList.add('active');
  if (name === 'gallery') renderGallery();
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

// Init
buildMenu();
buildOptMenus();
renderAttach('audio');
loadStore();
renderChatList();
renderThread();

initAuthGate();

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  if (window.Auth && Auth.isSignedIn()) startDirector(firstMsg);
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
