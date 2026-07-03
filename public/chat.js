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
// Models whose fal schema accepts num_images (verified against the OpenAPI docs).
const IMAGE_NUM_MODELS = new Set([
  'fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/bytedance/seedream/v4/text-to-image',
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
  // Caps must stay under the Worker's base64 ceilings (data URI ≈ size × 1.34).
  const cap = kind === 'clip' ? 20 : kind === 'audio' ? 20 : 8;
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
  model = selectedModels[mode] || DEFAULT_MODELS[mode];
  MODEL_LISTS[mode].forEach((m) => {
    const d = document.createElement('div');
    d.className = 'model-item' + (m.id === model ? ' selected' : '');
    d.dataset.model = m.id;
    d.dataset.label = m.label;
    const note = m.note ? ' <small style="color:var(--muted)">· ' + m.note + '</small>' : '';
    d.innerHTML = '<span>' + m.label + note + '</span><span class="check">✓</span>';
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

function currentOpts() {
  if (mode === 'audio') return AUDIO_OPTS;
  if (mode === 'image') {
    return {
      ratios: IMAGE_OPTS.ratios, defRatio: IMAGE_OPTS.defRatio,
      nums: IMAGE_NUM_MODELS.has(model) ? [1, 2, 3, 4] : null,
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

  // How many images per prompt (billing is per image, so always reset to 1).
  const numWrap = document.getElementById('numWrap');
  numWrap.style.display = opts.nums ? '' : 'none';
  if (opts.nums) {
    numImages = 1;
    document.getElementById('numLabel').textContent = '1';
    const numMenu = document.getElementById('numMenu');
    numMenu.innerHTML = '';
    opts.nums.forEach((n) => {
      const el = document.createElement('div');
      el.className = 'model-item' + (n === numImages ? ' selected' : '');
      el.innerHTML = '<span>' + n + (n === 1 ? ' image' : ' images') + '</span><span class="check">✓</span>';
      el.onclick = () => {
        numImages = n;
        document.getElementById('numLabel').textContent = String(n);
        numMenu.querySelectorAll('.model-item').forEach((i) => i.classList.toggle('selected', i === el));
        numMenu.classList.remove('open');
      };
      numMenu.appendChild(el);
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
  // Keep the current chat in the sidebar; just start a fresh one.
  const current = activeChat();
  if (current && !current.msgs.length) { document.getElementById('input').focus(); return; }
  const fresh = newChatEntry();
  chatStore.chats.unshift(fresh);
  chatStore.active = fresh.id;
  persistStore();
  renderChatList();
  renderThread();
  document.getElementById('input').focus();
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
  if (kind === 'user' || kind === 'agent') {
    addCopyBtn(div, text);
    pushSaved({ t: kind, text });
  }
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
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: 'New chat', msgs: [] };
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
}

function renderSaved(item) {
  if (item.t === 'media') { threadAppend(buildMedia(item.kind, item.url)); return; }
  const div = document.createElement('div');
  div.className = 'msg ' + item.t;
  div.textContent = item.text;
  addCopyBtn(div, item.text);
  threadAppend(div);
}

// Greeting is display-only — never saved, so empty chats stay empty.
function showGreeting() {
  const div = document.createElement('div');
  div.className = 'msg agent';
  div.textContent = GREETINGS[AGENT];
  threadAppend(div);
}

function renderThread() {
  const box = document.getElementById('messages');
  box.innerHTML = '';
  const chat = activeChat();
  if (chat && chat.msgs.length) chat.msgs.forEach(renderSaved);
  else showGreeting();
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
}
function deliverAgent(chatId, text) {
  if (chatStore.active === chatId) addMsg('agent', text);
  else saveToChat(chatId, { t: 'agent', text });
}
function deliverMedia(chatId, kind, url) {
  saveToChat(chatId, { t: 'media', kind, url });
  if (chatStore.active === chatId) threadAppend(buildMedia(kind, url));
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
    if (i >= 0) { chat.msgs.splice(i, 1); persistStore(); }
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
  if (chatStore.active === chatId) {
    const el = document.getElementById('genLoader');
    if (el) el.remove();
  }
  updateSendLock();
}

// While the active chat is generating, the send arrow becomes a stop square.
const ARROW_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const STOP_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>';
function updateSendLock() {
  const btn = document.getElementById('sendBtn');
  const busy = activeGens.has(chatStore.active);
  btn.disabled = false;
  btn.title = busy ? 'Stop generating' : 'Send';
  btn.innerHTML = busy ? STOP_SVG : ARROW_SVG;
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
  deliverAgent(chatId, '⏹ Cancelled.');
}

// Turn fal/worker failures into human messages; the raw detail goes to the console.
function friendlyFail(job) {
  console.error('generation failed:', job);
  const raw = JSON.stringify(job || {});
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
        avatar: attachments.avatar || undefined,
        end: attachments.end || undefined,
        audio: attachments.audio || undefined,
        clip: attachments.clip || undefined,
        duration: kind === 'video' && currentOpts().durations ? duration : undefined,
        ratio: currentOpts().ratios ? ratio : undefined,
        quality: kind === 'video' && currentOpts().resolutions ? quality : undefined,
        voice: kind === 'audio' ? voice : undefined,
        num: kind === 'image' && currentOpts().nums && numImages > 1 ? numImages : undefined,
      }),
    });
    const job = await res.json();
    if (!alive()) return; // cancelled while submitting
    if (!res.ok || !job.status_url) {
      endGen(origin);
      deliverAgent(origin, friendlyFail(job));
      return;
    }
    myGen.statusUrl = job.status_url; // lets Stop cancel the job on fal too

    const started = Date.now();
    let state = '';
    while (Date.now() - started < 10 * 60 * 1000) {
      const sr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.status_url));
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
      deliverAgent(origin, '⚠️ Timed out after 10 minutes — the job may still finish on fal.ai.');
      return;
    }

    const rr = await apiFetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
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
      for (const u of urls) {
        let finalUrl = u;
        try {
          const sv = await apiFetch('/api/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: u, kind }),
          });
          if (sv.ok) { const d = await sv.json(); if (d.url) finalUrl = d.url; }
        } catch {}
        finals.push(finalUrl);
      }
      if (!alive()) return;
      endGen(origin);
      finals.forEach((f) => deliverMedia(origin, kind, f));
      // The inputs were consumed — don't let them ride along on the next prompt.
      Object.keys(attachments).forEach((k) => {
        if (attachments[k]) { attachments[k] = null; renderAttach(k); }
      });
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
// Sonnet 5 will drive this once ANTHROPIC_API_KEY is set. For now the two
// "brain" functions below (directorAsk / directorCompose) are local
// placeholders; the question card + review UI and wiring are the real,
// final implementation and won't change when Sonnet is plugged in.
let directorState = null;

// Sonnet 5 drives the director via /api/direct. If the key isn't set (501)
// or the call fails, we fall back to these local placeholders so the flow
// still works.
// The last few chat turns, so the director remembers the conversation.
function directorHistory() {
  const chat = activeChat();
  return (chat ? chat.msgs : [])
    .filter((m) => m.t === 'user' || m.t === 'agent')
    .slice(-8)
    .map((m) => ({ role: m.t === 'user' ? 'user' : 'assistant', text: String(m.text || '').slice(0, 400) }));
}

async function directorAsk(text, history) {
  if (mode === 'audio') return { reply: '', ready: true, questions: [] }; // voice: words are literal
  try {
    const res = await apiFetch('/api/direct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'ask', kind: mode, prompt: text, history: history || [] }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    return {
      reply: data.reply || '',
      ready: !!data.ready,
      questions: Array.isArray(data.questions) ? data.questions : [],
    };
  } catch { return localAsk(text); }
}

async function directorCompose(text, answers) {
  if (mode === 'audio') return text; // voice: speak the words as given
  try {
    const res = await apiFetch('/api/direct', {
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
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Greeting / small talk — just chat, no question card.
  if (words < 3) {
    return { reply: "Hey! Tell me what you'd like to create and I'll help you shape it.", ready: false, questions: [] };
  }
  // Already detailed — go straight to composing.
  if (words >= 12) return { reply: '', ready: true, questions: [] };
  // Vague creative request — ask a couple of natural questions.
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
  return { reply: '', ready: true, questions: [look, mood] };
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
  addMsg('user', text);
  const thinking = addMsg('agent typing', 'Zephyr is thinking');
  let res;
  try { res = await directorAsk(text, history); } finally { thinking.remove(); }
  // Zephyr's conversational reply (greetings, small talk, or a lead-in to questions).
  if (res.reply) deliverAgent(origin, res.reply);
  // If the user moved to another chat while Zephyr was thinking, stop here —
  // don't pop question cards into the wrong thread.
  if (chatStore.active !== origin) return;
  // A vague creative request — walk through the tappable questions.
  if (res.questions && res.questions.length) {
    directorState = { text, questions: res.questions, answers: new Array(res.questions.length).fill(null) };
    renderQuestion(0);
    return;
  }
  // A ready, detailed request — compose the prompt for review.
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

// Grow the message box downward as the user types; cap it, then scroll.
function autoGrow(el) {
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
  input.value = '';
  input.style.height = 'auto'; // collapse back to one line after sending
  if (promptless) { generateMedia(text); return; }
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

let authMethod = 'password'; // 'password' | 'code'
function setAuthMethod(m) {
  authMethod = m;
  const isPw = m === 'password';
  document.getElementById('tabPassword').classList.toggle('active', isPw);
  document.getElementById('tabCode').classList.toggle('active', !isPw);
  document.getElementById('authForm').style.display = isPw ? '' : 'none';
  document.getElementById('authSwitch').style.display = isPw ? '' : 'none';
  document.getElementById('codeForm').style.display = isPw ? 'none' : '';
  showAuthError(''); showCodeError('');
  if (isPw) {
    setAuthMode(authMode);
    document.getElementById('authEmail').focus();
  } else {
    document.getElementById('authTitle').textContent = 'Sign in to Zephyr';
    resetCodeFlow();
    const typed = document.getElementById('authEmail').value.trim();
    if (typed) document.getElementById('codeEmail').value = typed;
    document.getElementById('codeEmail').focus();
  }
}

let authMode = 'in'; // 'in' = sign in, 'up' = create account
function setAuthMode(m) {
  authMode = m;
  document.getElementById('authTitle').textContent = m === 'in' ? 'Sign in to Zephyr' : 'Create your account';
  document.getElementById('authSubmit').textContent = m === 'in' ? 'Sign in' : 'Create account';
  document.getElementById('authSwitchText').textContent = m === 'in' ? 'New here?' : 'Already have an account?';
  document.getElementById('authToggle').textContent = m === 'in' ? 'Create an account' : 'Sign in';
  document.getElementById('authPass').setAttribute('autocomplete', m === 'in' ? 'current-password' : 'new-password');
  showAuthError('');
}
function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}
function showCodeError(msg) {
  const el = document.getElementById('codeError');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}

// Email-code flow: 'request' shows the email field, 'verify' shows the code field.
let codeStep = 'request';
function resetCodeFlow() {
  codeStep = 'request';
  document.getElementById('codeEmail').disabled = false;
  const codeInput = document.getElementById('codeInput');
  codeInput.style.display = 'none'; codeInput.value = '';
  document.getElementById('codeSubmit').textContent = 'Send code';
  document.getElementById('codeHint').style.display = 'none';
  showCodeError('');
}

async function submitCode() {
  const btn = document.getElementById('codeSubmit');
  const emailEl = document.getElementById('codeEmail');
  const email = emailEl.value.trim();
  if (codeStep === 'request') {
    if (!email) { showCodeError('Enter your email.'); return; }
    const orig = btn.textContent; btn.disabled = true; btn.textContent = '…'; showCodeError('');
    try {
      await Auth.sendCode(email);
      codeStep = 'verify';
      emailEl.disabled = true;
      const codeInput = document.getElementById('codeInput');
      codeInput.style.display = ''; codeInput.focus();
      btn.textContent = 'Verify & sign in';
      document.getElementById('codeHint').style.display = '';
    } catch (e) {
      showCodeError((e && e.message) || 'Could not send the code.');
    } finally { btn.disabled = false; if (btn.textContent === '…') btn.textContent = orig; }
  } else {
    const token = document.getElementById('codeInput').value.trim();
    if (!/^\d{6}$/.test(token)) { showCodeError('Enter the 6-digit code from your email.'); return; }
    const orig = btn.textContent; btn.disabled = true; btn.textContent = '…'; showCodeError('');
    try {
      await Auth.verifyCode(email, token);
      enterApp();
    } catch (e) {
      showCodeError((e && e.message) || "That code didn't work — try again.");
    } finally { btn.disabled = false; if (btn.textContent === '…') btn.textContent = orig; }
  }
}

async function resendCode() {
  const email = document.getElementById('codeEmail').value.trim();
  if (!email) return;
  showCodeError('');
  try {
    await Auth.sendCode(email);
    document.getElementById('codeHintText').textContent = 'New code sent — check your email.';
  } catch (e) {
    showCodeError((e && e.message) || 'Could not resend the code.');
  }
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const btn = document.getElementById('authSubmit');
  if (!email || !pass) { showAuthError('Enter your email and password.'); return; }
  if (authMode === 'up' && pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…'; showAuthError('');
  try {
    if (authMode === 'in') {
      await Auth.signIn(email, pass);
      enterApp();
    } else {
      const r = await Auth.signUp(email, pass);
      if (r.needsConfirm) {
        showAuthError('Check your email to confirm your account, then sign in.');
        setAuthMode('in');
      } else {
        enterApp();
      }
    }
  } catch (e) {
    showAuthError((e && e.message) || 'Something went wrong.');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

function enterApp() {
  hideAuthGate();
  const badge = document.getElementById('authEmailBadge');
  if (badge) badge.textContent = Auth.email();
  const so = document.getElementById('signOutRow');
  if (so) so.style.display = '';
  document.getElementById('input').focus();
}

async function doSignOut() {
  await Auth.signOut();
  location.reload();
}

function initAuthGate() {
  const form = document.getElementById('authForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); submitAuth(); });
  const toggle = document.getElementById('authToggle');
  if (toggle) toggle.addEventListener('click', () => setAuthMode(authMode === 'in' ? 'up' : 'in'));
  const codeForm = document.getElementById('codeForm');
  if (codeForm) codeForm.addEventListener('submit', (e) => { e.preventDefault(); submitCode(); });
  const resend = document.getElementById('codeResend');
  if (resend) resend.addEventListener('click', resendCode);
  if (window.Auth && Auth.isSignedIn()) enterApp();
  else showAuthGate();
}

// Init
buildMenu();
buildOptMenus();
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
