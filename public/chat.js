const AGENT = document.body.dataset.agent;
const GREETINGS = {
  Nova: "Hey! Nova here — your website builder. Tell me the site you want. Let's go.",
  Zephyr: "Hello there… I'm Zephyr, your video generator. Describe what you see in your head — no rush.",
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

function send() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  deliver(text);
}

// Init
addMsg('agent', GREETINGS[AGENT]);
history.push({ role: 'assistant', content: GREETINGS[AGENT] });

const params = new URLSearchParams(location.search);
const firstMsg = params.get('q');
if (firstMsg) {
  window.history.replaceState({}, '', location.pathname);
  deliver(firstMsg);
}
document.getElementById('input').focus();
