// THE PAGE: sign in (password, then a code we email, as before), then Coder.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let mode = 'in';      // in | up
  let step = 1;         // 1: email + password, 2: the emailed code
  let codeType = 'email';
  let busy = false;

  // WHICH AGENT: the address says (/gloopy), Coder otherwise.
  const agentNow = () => (/^\/gloopy\/?$/.test(location.pathname) ? 'gloopy' : 'coder');
  let coderMounted = false;
  function pick(agent, push) {
    if (push && agentNow() !== agent) { try { history.pushState({}, '', agent === 'gloopy' ? '/gloopy' : '/'); } catch (e) {} }
    document.querySelectorAll('.gf-tab').forEach((t) => t.classList.toggle('on', t.dataset.agent === agent));
    $('gfApp').hidden = agent !== 'coder';
    $('gfSoon').hidden = agent !== 'gloopy';
    $('gfAgentName').textContent = agent === 'gloopy' ? 'Gloopy agent' : 'Coder';
    if (agent === 'coder') {
      if (!coderMounted) { coderMounted = true; window.CoderView.mount($('gfApp'), { tools: $('gfColTools'), recents: $('gfRecents') }); }
      else window.CoderView.drawSide();
    } else {
      $('gfColTools').innerHTML = '';
      $('gfRecents').innerHTML = '<p class="gf-none">No chats yet.</p>';
    }
    sideOpen(false);
  }
  // On a phone the left side slides in (the ☰ button in Coder's bar opens it).
  function sideOpen(on) { document.body.classList.toggle('gf-side-open', !!on); }
  function showApp() {
    $('gfGate').hidden = true;
    $('gfShell').hidden = false;
    const mail = window.Auth.email();
    $('gfEmail').textContent = mail.split('@')[0] || mail;
    $('gfMenuMail').textContent = mail;
    $('gfMeAv').textContent = (mail[0] || '?').toUpperCase();
    $('gfTabGloopy').innerHTML = window.gloopyHTML(34);
    $('gfSoonFig').innerHTML = window.gloopyHTML(150);
    document.querySelectorAll('.gf-tab').forEach((t) => t.addEventListener('click', () => pick(t.dataset.agent, true)));
    $('gfGear').addEventListener('click', (e) => { e.stopPropagation(); $('gfMenu').hidden = !$('gfMenu').hidden; });
    document.addEventListener('click', () => { $('gfMenu').hidden = true; });
    $('gfScrim').addEventListener('click', () => sideOpen(false));
    addEventListener('gf:side', (e) => sideOpen(e.detail !== false));
    addEventListener('popstate', () => pick(agentNow(), false));
    pick(agentNow(), false);
  }
  function showGate() {
    $('gfShell').hidden = true;
    $('gfGate').hidden = false;
    draw();
  }
  function draw() {
    $('gfTitle').textContent = step === 2 ? 'Check your email' : mode === 'in' ? 'Sign in' : 'Create your account';
    $('gfSub').textContent = step === 2 ? 'We sent a code to ' + $('gfMail').value.trim() + '.' : 'Coder works on your code in your own GitHub.';
    $('gfStep1').hidden = step === 2;
    $('gfStep2').hidden = step !== 2;
    $('gfSwitch').hidden = step === 2;
    $('gfSwitch').textContent = mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in';
    $('gfPw').autocomplete = mode === 'in' ? 'current-password' : 'new-password';
    $('gfGo').textContent = busy ? 'One moment…' : step === 2 ? 'Verify' : mode === 'in' ? 'Continue' : 'Create account';
    $('gfGo').disabled = busy;
  }
  function say(t) { $('gfMsg').textContent = t || ''; }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const email = $('gfMail').value.trim();
    const pw = $('gfPw').value;
    say('');
    busy = true; draw();
    try {
      if (step === 2) {
        await window.Auth.verifyCode(email, $('gfCode').value.trim(), codeType);
        busy = false; return showApp();
      }
      if (!email || !pw) throw new Error('Enter your email and password.');
      if (mode === 'in') {
        await window.Auth.signIn(email, pw);
        codeType = 'email'; step = 2;
      } else {
        if (pw.length < 6) throw new Error('Use at least 6 characters for the password.');
        const r = await window.Auth.signUp(email, pw);
        if (r.session) { busy = false; return showApp(); }
        codeType = r.type || 'signup'; step = 2;
      }
    } catch (err) {
      say((err && err.message) || 'Something went wrong.');
    }
    busy = false; draw();
    if (step === 2) $('gfCode').focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('gfForm').addEventListener('submit', submit);
    $('gfSwitch').addEventListener('click', () => { mode = mode === 'in' ? 'up' : 'in'; say(''); draw(); });
    $('gfOut').addEventListener('click', async () => { await window.Auth.signOut(); location.href = '/'; });
    if (window.Auth.isSignedIn()) showApp(); else showGate();
  });
})();
