const AGENT = document.body.dataset.agent;
const GREETINGS = {
  Nova: "Hey! Nova here — your website builder. Tell me the site you want. Let's go.",
  Zephyr: "Hello there… I'm Zephyr, your video generator. Describe the scene you see in your head and I'll bring it to life. Pick a model top right, or leave it on Auto — no rush.",
};

let history = [];
let model = 'auto';

const modelMenu = document.getElementById('modelMenu');

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

async function generateVideo(text) {
  addMsg('user', text);

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  const label = document.getElementById('modelLabel').textContent;
  const status = addMsg('agent typing', 'Sending to ' + label);

  try {
    const res = await fetch('/api/video', {
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
          ? label + ' is generating your video…'
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
    const vurl =
      out.video?.url || out.video_url || out.videos?.[0]?.url || out.data?.video?.url;
    if (vurl) {
      const div = document.createElement('div');
      div.className = 'msg agent video';
      const vid = document.createElement('video');
      vid.controls = true;
      vid.src = vurl;
      div.appendChild(vid);
      const box = document.getElementById('messages');
      box.appendChild(div);
      box.parentElement.scrollTop = box.parentElement.scrollHeight;
    } else {
      addMsg('agent', '⚠️ Finished but no video in the response: ' + JSON.stringify(out).slice(0, 300));
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
    generateVideo(text);
  } else {
    deliver(text);
  }
}

// Init
addMsg('agent', GREETINGS[AGENT]);
history.push({ role: 'assistant', content: GREETINGS[AGENT] });

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  if (AGENT === 'Zephyr') {
    generateVideo(firstMsg);
  } else {
    deliver(firstMsg);
  }
}
document.getElementById('input').focus();
