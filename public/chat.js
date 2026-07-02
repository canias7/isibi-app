const AGENT = document.body.dataset.agent;
const GREETINGS = {
  Nova: "Hey! Nova here — your website builder. Tell me the site you want. Let's go.",
  Zephyr: "Hello there… I'm Zephyr, your video generator. Describe the scene you see in your head and I'll bring it to life. Pick a model top right, or leave it on Auto — no rush.",
};

let history = [];
let model = 'auto';
let mode = 'video';

const MODEL_LISTS = {
  video: [
    { id: 'auto', label: 'Auto', note: 'Seedance Fast' },
    { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0', note: 'audio' },
    { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast' },
    { id: 'bytedance/seedance-2.0/mini/text-to-video', label: 'Seedance 2.0 Mini', note: 'cheapest' },
    { id: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', note: 'audio' },
    { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling 3.0 Standard' },
    { id: 'xai/grok-imagine-video/text-to-video', label: 'Grok Imagine', note: 'audio' },
    { id: 'google/gemini-omni-flash', label: 'Gemini Omni Flash', note: 'audio' },
  ],
  image: [
    { id: 'auto', label: 'Auto', note: 'FLUX Schnell' },
    { id: 'google/nano-banana-2', label: 'Nano Banana 2' },
    { id: 'fal-ai/nano-banana-pro', label: 'Nano Banana Pro' },
    { id: 'openai/gpt-image-2', label: 'GPT Image 2', note: 'typography' },
    { id: 'fal-ai/flux/dev', label: 'FLUX.1 Dev' },
    { id: 'fal-ai/flux/schnell', label: 'FLUX.1 Schnell', note: 'fastest' },
    { id: 'fal-ai/krea-2/turbo', label: 'Krea 2 Turbo' },
    { id: 'xai/grok-imagine-image', label: 'Grok Imagine' },
  ],
};

const modelMenu = document.getElementById('modelMenu');

function buildMenu() {
  if (!modelMenu) return;
  modelMenu.innerHTML = '';
  MODEL_LISTS[mode].forEach((m) => {
    const d = document.createElement('div');
    d.className = 'model-item' + (m.id === 'auto' ? ' selected' : '');
    d.dataset.model = m.id;
    d.dataset.label = m.label;
    const note = m.note ? ' <small style="color:var(--muted)">· ' + m.note + '</small>' : '';
    d.innerHTML = '<span>' + m.label + note + '</span><span class="check">✓</span>';
    d.onclick = () => pickModel(d);
    modelMenu.appendChild(d);
  });
  model = 'auto';
  document.getElementById('modelLabel').textContent = 'Auto';
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === m));
  buildMenu();
  document.getElementById('input').placeholder =
    m === 'image' ? 'Describe your image…' : 'Describe your scene…';
}

function toggleModelMenu(e) {
  e.stopPropagation();
  modelMenu.classList.toggle('open');
}

function pickModel(el) {
  if (el.classList.contains('disabled')) return;
  model = el.dataset.model;
  document.querySelectorAll('.model-item').forEach(i => i.classList.toggle('selected', i === el));
  document.getElementById('modelLabel').textContent = el.dataset.label;
  modelMenu.classList.remove('open');
}

if (modelMenu) {
  document.addEventListener('click', () => modelMenu.classList.remove('open'));
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

  try {
    const res = await fetch(kind === 'image' ? '/api/image' : '/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
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
      : (out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url);
    if (mediaUrl) {
      const div = document.createElement('div');
      div.className = 'msg agent ' + kind;
      let el;
      if (kind === 'image') {
        el = document.createElement('img');
        el.src = mediaUrl;
        el.alt = text;
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
