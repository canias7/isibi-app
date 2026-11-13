// THE PAGE: sign in (password, then a code we email, as before), then Coder.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // INSIDE AN APP (owner, 2026-11-06: the desktop and phone apps): the desktop
  // app says so in its browser name, an installed phone app opens full-screen.
  // There, the "Download for Mac / Windows" buttons are hidden.
  const inApp = /GoFartherDesktop\/|GoFartherApp\//.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (inApp) document.documentElement.classList.add('gf-inapp');
  // IN THE PHONE APP: links to other sites open in the app's own browser sheet
  // (Safari / Chrome on top of the app), so the app is never left stuck on
  // another site. GitHub's sign-in and install pages stay in the app, like on
  // the desktop (Connect GitHub must come back here).
  if (/GoFartherApp\//.test(navigator.userAgent)) {
    const GITHUB_INSIDE = /^\/(login|session|sessions)(\/|$)|^\/apps\/[\w.-]+\/installations(\/|$)|^\/settings\/installations(\/|$)/;
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      let u; try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
      if (u.origin === location.origin || !/^https?:$/.test(u.protocol)) return;
      e.preventDefault();
      if (u.hostname === 'github.com' && GITHUB_INSIDE.test(u.pathname)) { location.href = u.href; return; }
      const B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
      if (B && B.open) B.open({ url: u.href }); else window.open(u.href, '_blank', 'noopener');
    }, true);
  }
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
  // THE LANDING PAGE: "Sign in", or sending from the ask box, opens the card.
  function openSignin() { $('gfGate').classList.add('signing'); draw(); setTimeout(() => $('gfMail').focus(), 0); }
  // What was typed in the ask box is kept for Coder's chat box after sign-in.
  function keepAsk() { try { const v = $('gfAskIn').value.trim(); if (v) sessionStorage.setItem('gf_ask', v); } catch (e) { /* private mode */ } }
  $('gfSignin').addEventListener('click', () => { keepAsk(); mode = 'in'; step = 1; openSignin(); });
  $('gfAsk').addEventListener('submit', (e) => { e.preventDefault(); keepAsk(); openSignin(); });
  $('gfAskIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); keepAsk(); openSignin(); } });
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
        // A new account also needs the emailed code (the audit, 2026-11-06).
        if (pw.length < 6) throw new Error('Use at least 6 characters for the password.');
        const r = await window.Auth.signUp(email, pw);
        codeType = r.type || 'signup'; step = 2;
      }
    } catch (err) {
      // THE PASSWORD STEP'S TICKET RAN OUT (15 minutes): back to that step (the audit, 2026-11-06).
      if (err && err.restart) { step = 1; $('gfCode').value = ''; }
      say((err && err.message) || 'Something went wrong.');
    }
    busy = false; draw();
    if (step === 2) $('gfCode').focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('gfForm').addEventListener('submit', submit);
    $('gfSwitch').addEventListener('click', () => { mode = mode === 'in' ? 'up' : 'in'; say(''); draw(); });
    $('gfOut').addEventListener('click', async () => { await window.Auth.signOut(); location.href = '/'; });
    // NOTIFICATIONS (owner item 8): Coder's screen opens its panel.
    $('gfConnectors').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:connectors')); });
    $('gfNotify').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:notify')); });
    // SETTINGS (owner, 2026-11-10: "the setting put it in settings"): Coder's own, for all the owner's chats.
    $('gfSettings').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:settings')); });
    if (window.Auth.isSignedIn()) showApp();
    else {
      showGate();
      // THE SESSION ENDED (the audit, 2026-11-06): straight to the sign-in card.
      if (window.Auth.justEnded()) { mode = 'in'; step = 1; openSignin(); say('Sign in again.'); }
    }
  });
})();
