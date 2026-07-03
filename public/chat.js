const AGENT = document.body.dataset.agent;
const GREETINGS = {
  Zephyr: "Hello there… I'm Zephyr, your video generator. Describe the scene you see in your head and I'll bring it to life. Pick a model top right — no rush.",
};

const DEFAULT_MODELS = {
  video: 'bytedance/seedance-2.0/fast/text-to-video',
  image: 'fal-ai/flux/schnell',
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
  caps: { image: true, end: true, avatar: true, audio: true },
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
// Audio (voice) generation: no frames/ratio/resolution — a voice + the words to speak.
// audio:true surfaces the "+ Audio" upload picker (e.g. a clip to clone from later).
const AUDIO_OPTS = { voices: VOICES, defVoice: 'Rachel', caps: { image: false, end: false, avatar: false, audio: true } };

let duration = 5;
let ratio = '16:9';
let quality = '720p';
let voice = 'Rachel';
let model = DEFAULT_MODELS.video;
let mode = 'video';


const MODEL_LISTS = {
  video: [
    { id: 'fal-ai/veo3.1', label: 'Veo 3.1', note: 'Google · audio' },
    { id: 'fal-ai/sora-2/text-to-video/pro', label: 'Sora 2 Pro', note: 'OpenAI' },
    { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0', note: 'audio' },
    { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast' },
    { id: 'bytedance/seedance-2.0/mini/text-to-video', label: 'Seedance 2.0 Mini', note: 'cheapest' },
    { id: 'fal-ai/kling-video/o3/pro/text-to-video', label: 'Kling o3 Pro', note: 'newest' },
    { id: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', note: 'audio' },
    { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling 3.0 Standard' },
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
    { id: 'fal-ai/flux/schnell', label: 'FLUX.1 Schnell', note: 'fastest' },
    { id: 'fal-ai/krea-2/turbo', label: 'Krea 2 Turbo' },
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
const ATTACH_LABELS = {
  image: '+ Image',
  avatar: '+ Avatar',
  audio: '+ Audio',
  clip: '+ Video clip',
  end: '+ End frame',
};

function attachBtn(kind) {
  return document.getElementById('btn' + kind[0].toUpperCase() + kind.slice(1));
}

function onAttach(kind, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  const cap = kind === 'clip' ? 20 : kind === 'audio' ? 25 : 8;
  if (file.size > cap * 1024 * 1024) {
    alert('File too big — max ' + cap + ' MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    attachments[kind] = reader.result;
    renderAttach(kind);
  };
  reader.readAsDataURL(file);
}

function renderAttach(kind) {
  const btn = attachBtn(kind);
  if (!btn) return;
  if (attachments[kind]) {
    btn.classList.add('has');
    const preview = kind === 'audio'
      ? '<span class="audio-chip">♪ audio</span>'
      : kind === 'clip'
      ? '<span class="audio-chip">🎬 clip</span>'
      : '<img src="' + attachments[kind] + '" alt="" />';
    btn.innerHTML = preview + '<span class="x" onclick="clearAttach(event, \'' + kind + '\')">×</span>';
  } else {
    btn.classList.remove('has');
    btn.innerHTML = ATTACH_LABELS[kind];
  }
}

function clearAttach(ev, kind) {
  ev.stopPropagation();
  attachments[kind] = null;
  renderAttach(kind);
}

// Show only the attachment pickers the current model actually supports,
// and clear any attachment a model can't use so it isn't sent.
function updateAttachVisibility() {
  const caps = (currentOpts() && currentOpts().caps) || {};
  [['image', caps.image], ['avatar', caps.avatar], ['audio', caps.audio], ['clip', caps.clip], ['end', caps.end]].forEach(([kind, ok]) => {
    const btn = attachBtn(kind);
    if (!btn) return;
    btn.style.display = ok ? '' : 'none';
    if (!ok && attachments[kind]) { attachments[kind] = null; renderAttach(kind); }
  });
}

function buildMenu() {
  if (!modelMenu) return;
  modelMenu.innerHTML = '';
  MODEL_LISTS[mode].forEach((m) => {
    const d = document.createElement('div');
    d.className = 'model-item' + (m.id === DEFAULT_MODELS[mode] ? ' selected' : '');
    d.dataset.model = m.id;
    d.dataset.label = m.label;
    const note = m.note ? ' <small style="color:var(--muted)">· ' + m.note + '</small>' : '';
    d.innerHTML = '<span>' + m.label + note + '</span><span class="check">✓</span>';
    d.onclick = () => pickModel(d);
    modelMenu.appendChild(d);
  });
  model = DEFAULT_MODELS[mode];
  const def = MODEL_LISTS[mode].find((m) => m.id === model);
  document.getElementById('modelLabel').textContent = def.label;
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

function currentOpts() {
  if (mode === 'audio') return AUDIO_OPTS;
  if (mode === 'image') {
    return {
      ratios: IMAGE_OPTS.ratios, defRatio: IMAGE_OPTS.defRatio,
      caps: { image: IMAGE_EDIT_MODELS.has(model), end: false, avatar: IMAGE_MULTI_MODELS.has(model) },
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
  document.querySelectorAll('.voice-test.playing').forEach((b) => {
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
    const res = await fetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: "Hi, I'm " + name + ". This is how I sound.", voice: name }),
    });
    const job = await res.json();
    if (!res.ok || !job.status_url) throw new Error('start');

    const started = Date.now();
    let out = null;
    while (Date.now() - started < 90 * 1000) {
      const sr = await fetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
      const st = await sr.json();
      if (st.status === 'COMPLETED') {
        const rr = await fetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
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

function buildOptMenus() {
  const durWrap = document.getElementById('durWrap');
  if (!durWrap) return;
  const opts = currentOpts();
  durWrap.style.display = opts.durations ? '' : 'none';

  if (opts.durations) {
    duration = opts.defDur;
    document.getElementById('durLabel').textContent = duration + 's';
    const durMenu = document.getElementById('durMenu');
    durMenu.innerHTML = '';
    opts.durations.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'model-item' + (d === duration ? ' selected' : '');
      el.innerHTML = '<span>' + d + 's</span><span class="check">✓</span>';
      el.onclick = () => {
        duration = d;
        document.getElementById('durLabel').textContent = d + 's';
        durMenu.querySelectorAll('.model-item').forEach((i) => i.classList.toggle('selected', i === el));
        durMenu.classList.remove('open');
      };
      durMenu.appendChild(el);
    });
  }

  const qualWrap = document.getElementById('qualWrap');
  qualWrap.style.display = opts.resolutions ? '' : 'none';
  if (opts.resolutions) {
    quality = opts.defRes;
    document.getElementById('qualLabel').textContent = quality;
    const qualMenu = document.getElementById('qualMenu');
    qualMenu.innerHTML = '';
    opts.resolutions.forEach((q) => {
      const el = document.createElement('div');
      el.className = 'model-item' + (q === quality ? ' selected' : '');
      el.innerHTML = '<span>' + q + '</span><span class="check">✓</span>';
      el.onclick = () => {
        quality = q;
        document.getElementById('qualLabel').textContent = q;
        qualMenu.querySelectorAll('.model-item').forEach((i) => i.classList.toggle('selected', i === el));
        qualMenu.classList.remove('open');
      };
      qualMenu.appendChild(el);
    });
  }

  // Audio generation has no aspect ratio; hide the ratio picker entirely.
  const ratioWrap = document.getElementById('ratioWrap');
  ratioWrap.style.display = opts.ratios ? '' : 'none';
  if (opts.ratios) {
    ratio = opts.defRatio;
    document.getElementById('ratioLabel').textContent = ratio;
    const ratioMenu = document.getElementById('ratioMenu');
    ratioMenu.innerHTML = '';
    opts.ratios.forEach((r) => {
      const el = document.createElement('div');
      el.className = 'model-item' + (r === ratio ? ' selected' : '');
      el.innerHTML = '<span>' + r + '</span><span class="check">✓</span>';
      el.onclick = () => {
        ratio = r;
        document.getElementById('ratioLabel').textContent = r;
        ratioMenu.querySelectorAll('.model-item').forEach((i) => i.classList.toggle('selected', i === el));
        ratioMenu.classList.remove('open');
      };
      ratioMenu.appendChild(el);
    });
  }

  // Voice picker — only shown in audio (voice) mode.
  const voiceWrap = document.getElementById('voiceWrap');
  voiceWrap.style.display = opts.voices ? '' : 'none';
  if (opts.voices) {
    voice = opts.defVoice;
    document.getElementById('voiceLabel').textContent = voice;
    const voiceMenu = document.getElementById('voiceMenu');
    voiceMenu.innerHTML = '';
    opts.voices.forEach((v) => {
      const el = document.createElement('div');
      el.className = 'model-item' + (v === voice ? ' selected' : '');
      const nameEl = document.createElement('span');
      nameEl.textContent = v;
      const right = document.createElement('span');
      right.className = 'voice-right';
      const test = document.createElement('button');
      test.className = 'voice-test';
      test.type = 'button';
      test.textContent = '▶';
      test.title = 'Hear ' + v;
      test.onclick = (e) => { e.stopPropagation(); previewVoice(v, test); };
      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = '✓';
      right.appendChild(test);
      right.appendChild(check);
      el.appendChild(nameEl);
      el.appendChild(right);
      el.onclick = () => {
        voice = v;
        document.getElementById('voiceLabel').textContent = v;
        voiceMenu.querySelectorAll('.model-item').forEach((i) => i.classList.toggle('selected', i === el));
        voiceMenu.classList.remove('open');
      };
      voiceMenu.appendChild(el);
    });
  }

  // Placeholder: a per-model hint (e.g. lip-sync models) else the mode default.
  document.getElementById('input').placeholder = opts.hint ||
    (mode === 'image' ? 'Describe your image…' :
     mode === 'audio' ? 'Type what you want the voice to say…' :
     'Describe your scene…');

  updateAttachVisibility();
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
  clearSaved();
  location.href = location.pathname;
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
  box.parentElement.scrollTop = box.parentElement.scrollHeight;
  if (kind === 'user' || kind === 'agent') pushSaved({ t: kind, text });
  return div;
}

function ratioAspect(r) {
  const m = typeof r === 'string' && r.match(/^(\d{1,2}):(\d{1,2})$/);
  return m ? m[1] + ' / ' + m[2] : '16 / 9';
}

// ── Persistence: keep the thread across reloads / app switches ──
const STORE_KEY = 'zephyr_thread_v1';
let saved = [];
function pushSaved(item) {
  saved.push(item);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(saved.slice(-80))); } catch {}
}
function clearSaved() {
  saved = [];
  try { localStorage.removeItem(STORE_KEY); } catch {}
}
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function renderSaved(item) {
  if (item.t === 'media') { threadAppend(buildMedia(item.kind, item.url)); return; }
  const div = document.createElement('div');
  div.className = 'msg ' + item.t;
  div.textContent = item.text;
  threadAppend(div);
}

// ── Generated media: element + download + full-screen actions ──
function buildMedia(kind, url) {
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
  div.appendChild(actions);
  return div;
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
  let el;
  if (kind === 'image') { el = document.createElement('img'); el.src = url; }
  else { el = document.createElement('video'); el.src = url; el.controls = true; el.autoplay = true; el.playsInline = true; }
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
function makeLoader(kind) {
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
    visual.style.aspectRatio = ratioAspect(ratio);
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

async function generateMedia(text, opts = {}) {
  if (opts.announce !== false) addMsg('user', text || '🎬 Lip-sync from the attached media');

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  const kind = mode;
  const label = document.getElementById('modelLabel').textContent;
  const loader = makeLoader(kind);
  loader.setText('Sending to ' + label);

  const apiPath = kind === 'image' ? '/api/image' : kind === 'audio' ? '/api/audio' : '/api/video';
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text,
        image: attachments.image || undefined,
        avatar: attachments.avatar || undefined,
        end: attachments.end || undefined,
        audio: attachments.audio || undefined,
        clip: attachments.clip || undefined,
        duration: kind === 'video' && currentOpts().durations ? duration : undefined,
        ratio: currentOpts().ratios ? ratio : undefined,
        quality: kind === 'video' && currentOpts().resolutions ? quality : undefined,
        voice: kind === 'audio' ? voice : undefined,
      }),
    });
    const job = await res.json();
    if (!res.ok || !job.status_url) {
      loader.el.remove();
      addMsg('agent', '⚠️ ' + (job.error || 'Could not start the generation.') +
        (job.detail ? ' — ' + JSON.stringify(job.detail).slice(0, 300) : ''));
      return;
    }

    const started = Date.now();
    let state = '';
    while (Date.now() - started < 10 * 60 * 1000) {
      const sr = await fetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
      const st = await sr.json();
      state = st.status;
      if (state === 'COMPLETED') break;
      loader.setText(
        state === 'IN_PROGRESS'
          ? label + ' is generating your ' + kind + '…'
          : 'Queued at ' + label + (st.queue_position != null ? ' (#' + st.queue_position + ')' : '') + '…');
      await new Promise((r) => setTimeout(r, 4000));
    }

    if (state !== 'COMPLETED') {
      loader.el.remove();
      addMsg('agent', '⚠️ Timed out after 10 minutes — the job may still finish on fal.ai.');
      return;
    }

    const rr = await fetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
    const out = await rr.json();
    loader.el.remove();
    const mediaUrl = kind === 'image'
      ? (out.images?.[0]?.url || out.image?.url || out.data?.images?.[0]?.url)
      : kind === 'audio'
      ? (out.audio?.url || out.audio_url || out.audio_file?.url || out.audio?.[0]?.url || out.data?.audio?.url)
      : (out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url);
    if (mediaUrl) {
      threadAppend(buildMedia(kind, mediaUrl));
      pushSaved({ t: 'media', kind, url: mediaUrl });
    } else {
      addMsg('agent', '⚠️ Finished but no ' + kind + ' in the response: ' + JSON.stringify(out).slice(0, 300));
    }
  } catch {
    addMsg('agent', '⚠️ Network error — try again.');
  } finally {
    loader.el.remove();
    btn.disabled = false;
    document.getElementById('input').focus();
  }
}

// ── Director flow (Zephyr) ───────────────────────────────────────────────
// Sonnet 5 will drive this once ANTHROPIC_API_KEY is set. For now the two
// "brain" functions below (directorAsk / directorCompose) are local
// placeholders; the question card + review UI and wiring are the real,
// final implementation and won't change when Sonnet is plugged in.
let directorState = null;

// Sonnet 5 drives the director via /api/direct. If the key isn't set (501)
// or the call fails, we fall back to these local placeholders so the flow
// still works.
async function directorAsk(text) {
  if (mode === 'audio') return []; // voice: the words are literal, no questions
  try {
    const res = await fetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'ask', kind: mode, prompt: text }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (Array.isArray(data.questions)) return data.questions;
    throw 0;
  } catch { return localAsk(text); }
}

async function directorCompose(text, answers) {
  if (mode === 'audio') return text; // voice: speak the words as given
  try {
    const res = await fetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'compose', kind: mode, prompt: text, answers: answers.filter(Boolean) }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (data.prompt) return data.prompt;
    throw 0;
  } catch { return localCompose(text, answers); }
}

function localAsk(text) {
  if (text.trim().split(/\s+/).length >= 12) return [];
  const look = mode === 'image'
    ? { title: 'What style?', options: [
        { label: 'Photoreal', desc: 'Lifelike detail' },
        { label: 'Illustration', desc: 'Drawn / painted' },
        { label: '3D render', desc: 'CGI look' }] }
    : { title: 'What look?', options: [
        { label: 'Realistic', desc: 'Photoreal footage' },
        { label: 'Cinematic', desc: 'Filmic, color-graded' },
        { label: 'Animated', desc: '3D / anime' }] };
  const mood = { title: 'Mood?', options: [
    { label: 'Bright & lively', desc: '' },
    { label: 'Moody & dramatic', desc: '' },
    { label: 'Dreamy & soft', desc: '' }] };
  return [look, mood];
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
  addMsg('user', text);
  const thinking = addMsg('agent typing', 'Zephyr is thinking');
  let questions;
  try { questions = await directorAsk(text); } finally { thinking.remove(); }
  if (!questions.length) { composeAndReview(text, []); return; }
  directorState = { text, questions, answers: new Array(questions.length).fill(null) };
  renderQuestion(0);
}

async function composeAndReview(text, answers) {
  const thinking = addMsg('agent typing', 'Writing the prompt');
  let prompt;
  try { prompt = await directorCompose(text, answers); } finally { thinking.remove(); }
  reviewPrompt(prompt);
}

// One question per card; answering it reveals the next, then the review.
function renderQuestion(qi) {
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const q = directorState.questions[qi];
  const total = directorState.questions.length;

  const card = document.createElement('div');
  card.className = 'q-card';

  const step = document.createElement('div');
  step.className = 'q-intro';
  step.textContent = 'Question ' + (qi + 1) + ' of ' + total;
  card.appendChild(step);

  const title = document.createElement('div');
  title.className = 'q-title'; title.textContent = q.title;
  card.appendChild(title);

  const opts = document.createElement('div'); opts.className = 'opts';
  q.options.forEach((o, oi) => {
    const opt = document.createElement('div'); opt.className = 'opt';
    opt.innerHTML = '<span class="key">' + LETTERS[oi] + '</span><span class="txt"><b>' +
      esc(o.label) + '</b>' + (o.desc ? '<small>' + esc(o.desc) + '</small>' : '') + '</span>';
    opt.onclick = () => chooseAnswer(card, opt, qi, o.label);
    opts.appendChild(opt);
  });

  // Other… — tap to reveal a text field; Enter (or tapping it again) confirms.
  const other = document.createElement('div'); other.className = 'opt';
  other.innerHTML = '<span class="key">' + LETTERS[q.options.length] + '</span><span class="txt"><b>Other…</b></span>';
  const inp = document.createElement('input');
  inp.className = 'other-input'; inp.placeholder = 'Type & press Enter…'; inp.style.display = 'none';
  other.querySelector('.txt').appendChild(inp);
  other.onclick = (e) => {
    if (e.target === inp) return;
    if (inp.style.display === 'none') { other.classList.add('sel'); inp.style.display = ''; inp.focus(); }
    else if (inp.value.trim()) chooseAnswer(card, other, qi, inp.value.trim());
  };
  inp.onclick = (e) => e.stopPropagation();
  inp.onkeydown = (e) => {
    if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); chooseAnswer(card, other, qi, inp.value.trim()); }
  };
  opts.appendChild(other);

  card.appendChild(opts);
  threadAppend(card);
}

function chooseAnswer(card, optEl, qi, value) {
  directorState.answers[qi] = value;
  card.querySelectorAll('.opt').forEach((o) => { o.classList.remove('sel'); o.style.pointerEvents = 'none'; });
  optEl.classList.add('sel');
  card.querySelectorAll('.other-input').forEach((i) => { i.disabled = true; });
  const next = qi + 1;
  if (next < directorState.questions.length) renderQuestion(next);
  else composeAndReview(directorState.text, directorState.answers);
}

function reviewPrompt(prompt) {
  const box = document.createElement('div');
  box.className = 'review-card';
  const label = document.createElement('div');
  label.className = 'review-label';
  label.textContent = "Here's the prompt I'll generate — approve to run it:";
  const body = document.createElement('div');
  body.className = 'review-prompt'; body.textContent = prompt;
  const actions = document.createElement('div'); actions.className = 'review-actions';
  const deny = document.createElement('button'); deny.className = 'review-deny'; deny.textContent = '✕ Deny';
  const allow = document.createElement('button'); allow.className = 'review-allow'; allow.textContent = 'Allow & Generate ✦';
  deny.onclick = () => { actions.remove(); label.textContent = 'Denied — tweak it and send again.'; document.getElementById('input').focus(); };
  allow.onclick = () => { actions.remove(); label.textContent = 'Approved ✦'; generateMedia(prompt, { announce: false }); };
  actions.appendChild(deny); actions.appendChild(allow);
  box.appendChild(label); box.appendChild(body); box.appendChild(actions);
  threadAppend(box);
}

function send() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  // Lip-sync models are prompt-less — they run off the attachments, not text.
  const promptless = mode === 'video' && currentOpts() && currentOpts().noPrompt;
  if (!text && !promptless) return;
  input.value = '';
  if (promptless) { generateMedia(text); return; }
  startDirector(text);
}

// Init
buildMenu();
buildOptMenus();
const restored = loadSaved();
if (restored.length) { saved = restored; restored.forEach(renderSaved); }
else { addMsg('agent', GREETINGS[AGENT]); }

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  startDirector(firstMsg);
}
document.getElementById('input').focus();
