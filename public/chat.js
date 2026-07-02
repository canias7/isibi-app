const AGENT = document.body.dataset.agent;
const GREETINGS = {
  Nova: "Hey! Nova here — your website builder. Tell me the site you want. Let's go.",
  Zephyr: "Hello there… I'm Zephyr, your video generator. Describe the scene you see in your head and I'll bring it to life. Pick a model top right — no rush.",
};

let history = [];
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
};
const IMAGE_OPTS = { ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'], defRatio: '1:1', caps: { image: true, end: false, avatar: true } };
// Audio (voice) generation: no frames/ratio/resolution — a voice + the words to speak.
const AUDIO_OPTS = { voices: VOICES, defVoice: 'Rachel', caps: { image: false, end: false, avatar: false } };

let duration = 5;
let ratio = '16:9';
let quality = '720p';
let voice = 'Rachel';
let model = DEFAULT_MODELS.video;
let mode = 'video';


const MODEL_LISTS = {
  video: [
    { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0', note: 'audio' },
    { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast' },
    { id: 'bytedance/seedance-2.0/mini/text-to-video', label: 'Seedance 2.0 Mini', note: 'cheapest' },
    { id: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', note: 'audio' },
    { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling 3.0 Standard' },
    { id: 'xai/grok-imagine-video/text-to-video', label: 'Grok Imagine', note: 'audio' },
    { id: 'google/gemini-omni-flash', label: 'Gemini Omni Flash', note: 'audio' },
  ],
  image: [
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

const attachments = { image: null, avatar: null, end: null, audio: null };
const ATTACH_LABELS = {
  image: '+ Image',
  avatar: '+ Avatar',
  audio: '+ Audio',
  end: '+ End frame',
};

function attachBtn(kind) {
  return document.getElementById('btn' + kind[0].toUpperCase() + kind.slice(1));
}

function onAttach(kind, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  const cap = kind === 'audio' ? 25 : 8;
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
  const caps = (currentOpts() && currentOpts().caps) || { image: false, end: false, avatar: false, audio: false };
  [['image', caps.image], ['avatar', caps.avatar], ['audio', caps.audio], ['end', caps.end]].forEach(([kind, ok]) => {
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
  return mode === 'video' ? MODEL_OPTS[model] : IMAGE_OPTS;
}

function buildOptMenus() {
  const durWrap = document.getElementById('durWrap');
  if (!durWrap) return;
  const opts = currentOpts();
  durWrap.style.display = mode === 'video' ? '' : 'none';

  if (mode === 'video') {
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
  qualWrap.style.display = mode === 'video' && opts.resolutions ? '' : 'none';
  if (mode === 'video' && opts.resolutions) {
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
      el.innerHTML = '<span>' + v + '</span><span class="check">✓</span>';
      el.onclick = () => {
        voice = v;
        document.getElementById('voiceLabel').textContent = v;
        voiceMenu.querySelectorAll('.model-item').forEach((i) => i.classList.toggle('selected', i === el));
        voiceMenu.classList.remove('open');
      };
      voiceMenu.appendChild(el);
    });
  }

  updateAttachVisibility();
}

function toggleOpt(e, which) {
  e.stopPropagation();
  const menu = document.getElementById(which + 'Menu');
  document.querySelectorAll('.model-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}

function toggleAdvanced() {
  document.getElementById('advToggle').classList.toggle('open');
  document.getElementById('advPanel').classList.toggle('open');
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
  return div;
}

async function deliver(text) {
  addMsg('user', text);
  history.push({ role: 'user', content: text });

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  const typing = addMsg('agent typing', AGENT + ' is thinking');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: AGENT, messages: history, model }),
    });
    const data = await res.json();
    typing.remove();
    if (data.reply) {
      addMsg('agent', data.reply);
      history.push({ role: 'assistant', content: data.reply });
    } else {
      addMsg('agent', '⚠️ ' + (data.error || 'Something went wrong.'));
    }
  } catch {
    typing.remove();
    addMsg('agent', '⚠️ Network error — try again.');
  } finally {
    btn.disabled = false;
    document.getElementById('input').focus();
  }
}

async function generateMedia(text) {
  addMsg('user', text);

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  const kind = mode;
  const label = document.getElementById('modelLabel').textContent;
  const status = addMsg('agent typing', 'Sending to ' + label);

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
        duration: kind === 'video' ? duration : undefined,
        ratio: kind === 'audio' ? undefined : ratio,
        quality: kind === 'video' && currentOpts().resolutions ? quality : undefined,
        voice: kind === 'audio' ? voice : undefined,
      }),
    });
    const job = await res.json();
    if (!res.ok || !job.status_url) {
      status.remove();
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
      status.textContent =
        state === 'IN_PROGRESS'
          ? label + ' is generating your ' + kind + '…'
          : 'Queued at ' + label + (st.queue_position != null ? ' (#' + st.queue_position + ')' : '') + '…';
      await new Promise((r) => setTimeout(r, 4000));
    }

    if (state !== 'COMPLETED') {
      status.remove();
      addMsg('agent', '⚠️ Timed out after 10 minutes — the job may still finish on fal.ai.');
      return;
    }

    const rr = await fetch('/api/video/poll?url=' + encodeURIComponent(job.response_url));
    const out = await rr.json();
    status.remove();
    const mediaUrl = kind === 'image'
      ? (out.images?.[0]?.url || out.image?.url || out.data?.images?.[0]?.url)
      : kind === 'audio'
      ? (out.audio?.url || out.audio_url || out.audio_file?.url || out.audio?.[0]?.url || out.data?.audio?.url)
      : (out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url);
    if (mediaUrl) {
      const div = document.createElement('div');
      div.className = 'msg agent ' + kind;
      let el;
      if (kind === 'image') {
        el = document.createElement('img');
        el.src = mediaUrl;
        el.alt = text;
      } else if (kind === 'audio') {
        el = document.createElement('audio');
        el.controls = true;
        el.src = mediaUrl;
      } else {
        el = document.createElement('video');
        el.controls = true;
        el.src = mediaUrl;
      }
      div.appendChild(el);
      const box = document.getElementById('messages');
      box.appendChild(div);
      box.parentElement.scrollTop = box.parentElement.scrollHeight;
    } else {
      addMsg('agent', '⚠️ Finished but no ' + kind + ' in the response: ' + JSON.stringify(out).slice(0, 300));
    }
  } catch {
    addMsg('agent', '⚠️ Network error — try again.');
  } finally {
    status.remove();
    btn.disabled = false;
    document.getElementById('input').focus();
  }
}

function send() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (AGENT === 'Zephyr') {
    generateMedia(text);
  } else {
    deliver(text);
  }
}

// Init
buildMenu();
buildOptMenus();
addMsg('agent', GREETINGS[AGENT]);
history.push({ role: 'assistant', content: GREETINGS[AGENT] });

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  if (AGENT === 'Zephyr') {
    generateMedia(firstMsg);
  } else {
    deliver(firstMsg);
  }
}
document.getElementById('input').focus();
