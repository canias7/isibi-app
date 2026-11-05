// THE PAGE: sign in (password, then a code we email, as before), then Coder.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let mode = 'in';      // in | up
  let step = 1;         // 1: email + password, 2: the emailed code
  let codeType = 'email';
  let busy = false;

  // WHICH TAB: the address says (/gloopy), Coder otherwise.
  const agentNow = () => (/^\/gloopy\/?$/.test(location.pathname) ? 'gloopy' : 'coder');
  let coderMounted = false;
  function pick(agent, push) {
    if (push && agentNow() !== agent) { try { history.pushState({}, '', agent === 'gloopy' ? '/gloopy' : '/'); } catch (e) {} }
    document.querySelectorAll('.gf-tab').forEach((t) => t.classList.toggle('on', t.dataset.agent === agent));
    $('gfApp').hidden = agent !== 'coder';
    $('gfSoon').hidden = agent !== 'gloopy';
    if (agent === 'coder' && !coderMounted) { coderMounted = true; window.CoderView.mount($('gfApp')); }
  }
  function showApp() {
    $('gfGate').hidden = true;
    $('gfShell').hidden = false;
    $('gfUser').hidden = false;
    $('gfEmail').textContent = window.Auth.email();
    $('gfTabGloopy').innerHTML = window.gloopyHTML(44);
    $('gfSoonFig').innerHTML = window.gloopyHTML(150);
    document.querySelectorAll('.gf-tab').forEach((t) => t.addEventListener('click', () => pick(t.dataset.agent, true)));
    addEventListener('popstate', () => pick(agentNow(), false));
    pick(agentNow(), false);
  }
  function showGate() {
    $('gfShell').hidden = true;
    $('gfUser').hidden = true;
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
        await window.Auth.checkPassword(email, pw);
        await window.Auth.sendCode(email, false);
        codeType = 'email'; step = 2;
      } else {
        if (pw.length < 6) throw new Error('Use at least 6 characters for the password.');
        const r = await window.Auth.signUp(email, pw);
        if (r.session) { busy = false; return showApp(); }
        codeType = 'signup'; step = 2;
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
