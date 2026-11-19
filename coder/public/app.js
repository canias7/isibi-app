// THE PAGE: sign in (a code we email: no password, 2026-11-15), then Coder.
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
  let step = 1;         // 1: the email, 2: the emailed code
  let codeType = 'email';
  let busy = false;

  // WHICH AGENT: the address says (/gloopy), Coder otherwise.
  const agentNow = () => (/^\/gloopy\/?$/.test(location.pathname) ? 'gloopy' : 'coder');
  let coderMounted = false, gloopyMounted = false;
  function pick(agent, push) {
    if (push && agentNow() !== agent) { try { history.pushState({}, '', agent === 'gloopy' ? '/gloopy' : '/'); } catch (e) {} }
    document.querySelectorAll('.gf-tab').forEach((t) => t.classList.toggle('on', t.dataset.agent === agent));
    $('gfApp').hidden = agent !== 'coder';
    $('gfGloopyApp').hidden = agent !== 'gloopy';
    $('gfAgentName').textContent = agent === 'gloopy' ? 'Gloopy' : 'Coder';
    if (agent === 'coder') {
      if (!coderMounted) { coderMounted = true; window.CoderView.mount($('gfApp'), { tools: $('gfColTools'), recents: $('gfRecents') }); }
      else window.CoderView.drawSide();
    } else {
      // GLOOPY'S CHAT (owner, 2026-11-09): your own Gloopy, drawn by coder.js as Gloopy.
      if (!gloopyMounted) { gloopyMounted = true; window.GloopyView.mount($('gfGloopyApp'), { tools: $('gfColTools'), recents: $('gfRecents') }); }
      else window.GloopyView.drawSide();
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
    // CODER'S LOGO, THE TYPEWRITER (the owner, 2026-11-14: "that will be the logo for Coder"), in place of the laptop emoji.
    if (window.coderLogoHTML) $('gfTabCoder').innerHTML = window.coderLogoHTML(34);
    document.querySelectorAll('.gf-tab').forEach((t) => t.addEventListener('click', () => pick(t.dataset.agent, true)));
    $('gfGear').addEventListener('click', (e) => { e.stopPropagation(); $('gfMenu').hidden = !$('gfMenu').hidden; });
    document.addEventListener('click', () => { $('gfMenu').hidden = true; });
    $('gfScrim').addEventListener('click', () => sideOpen(false));
    addEventListener('gf:side', (e) => sideOpen(e.detail !== false));
    addEventListener('popstate', () => pick(agentNow(), false));
    pick(agentNow(), false);
    // GLOOPY NEEDS YOU (the docs, 2026-11-10): the mark on its tab, asked for when the page opens and when you come back.
    const attention = () => { if (window.GloopyView && window.GloopyView.attention) window.GloopyView.attention().catch(() => {}); };
    attention();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') attention(); });
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
  $('gfSignin').addEventListener('click', () => { keepAsk(); step = 1; openSignin(); });
  $('gfAsk').addEventListener('submit', (e) => { e.preventDefault(); keepAsk(); openSignin(); });
  $('gfAskIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); keepAsk(); openSignin(); } });
  // ONE CARD FOR SIGNING IN AND SIGNING UP (the owner, 2026-11-15: "no passwords, just email codes pls"): the email, then
  // the code we send it; a new email's first code makes its account.
  function draw() {
    $('gfTitle').textContent = step === 2 ? 'Check your email' : 'Sign in';
    $('gfSub').textContent = step === 2 ? 'We sent a code to ' + $('gfMail').value.trim() + '.' : 'We\u2019ll email you a code. New here? The same code makes your account.';
    $('gfStep1').hidden = step === 2;
    $('gfStep2').hidden = step !== 2;
    $('gfCodeActs').hidden = step !== 2;
    $('gfGo').textContent = busy ? 'One moment\u2026' : step === 2 ? 'Sign in' : 'Email me a code';
    $('gfGo').disabled = busy;
    $('gfResend').disabled = busy;
  }
  // (`ok`: good news, such as a new code sent, not an error.)
  function say(t, ok) { $('gfMsg').textContent = t || ''; $('gfMsg').classList.toggle('gf-ok', !!ok); }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const email = $('gfMail').value.trim();
    say('');
    busy = true; draw();
    try {
      if (step === 2) {
        await window.Auth.verifyCode(email, $('gfCode').value.trim(), codeType);
        busy = false; return showApp();
      }
      if (!email) throw new Error('Enter your email.');
      const r = await window.Auth.sendCode(email);
      codeType = (r && r.type) || 'email'; step = 2; $('gfCode').value = '';
    } catch (err) {
      // THE CODE'S TICKET RAN OUT (15 minutes), or too many tries: back to the email (the audit, 2026-11-06).
      if (err && err.restart) { step = 1; $('gfCode').value = ''; }
      say((err && err.message) || 'Something went wrong.');
    }
    busy = false; draw();
    if (step === 2) $('gfCode').focus();
  }
  // A NEW CODE for the same email (Supabase sends at most one a minute; Coder's Worker five per 15 minutes).
  async function resend() {
    if (busy) return;
    say('');
    busy = true; draw();
    try {
      const r = await window.Auth.sendCode($('gfMail').value.trim());
      codeType = (r && r.type) || 'email'; $('gfCode').value = '';
      say('We sent a new code.', true);
    } catch (err) { say((err && err.message) || 'Something went wrong.'); }
    busy = false; draw();
    $('gfCode').focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('gfForm').addEventListener('submit', submit);
    $('gfResend').addEventListener('click', resend);
    $('gfBack').addEventListener('click', () => { if (busy) return; step = 1; $('gfCode').value = ''; say(''); draw(); $('gfMail').focus(); });
    $('gfOut').addEventListener('click', async () => {
      const done = await window.Auth.signOut();
      // (Not confirmed by the server: signed out here, and told so, as Claude Code's /logout says where to revoke it.)
      if (done === false) { try { sessionStorage.setItem('gf_out_note', '1'); } catch (e) {} }
      location.href = '/';
    });
    // NOTIFICATIONS (owner item 8): Coder's screen opens its panel.
    // PERMISSION RULES in the gear menu (2026-11-15: out of the mode menu, which /permissions opens, as in Claude Code).
    $('gfRules').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:rules')); });
    $('gfConnectors').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:connectors')); });
    $('gfNotify').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:notify')); });
    // SETTINGS (owner, 2026-11-10: "the setting put it in settings"): Coder's own, for all the owner's chats.
    $('gfSettings').addEventListener('click', () => { $('gfMenu').hidden = true; window.dispatchEvent(new CustomEvent('gf:side', { detail: false })); window.dispatchEvent(new CustomEvent('gf:settings')); });
    if (window.Auth.isSignedIn()) showApp();
    else {
      showGate();
      // THE SESSION ENDED (the audit, 2026-11-06): straight to the sign-in card.
      if (window.Auth.justEnded()) { step = 1; openSignin(); say('Sign in again.'); }
      // A SIGN-OUT THE SERVER DID NOT CONFIRM (L-server-16): said on the sign-in card, once.
      let outNote = null;
      try { outNote = sessionStorage.getItem('gf_out_note'); sessionStorage.removeItem('gf_out_note'); } catch (e) {}
      if (outNote) { step = 1; openSignin(); say('You are signed out on this device, but your other devices could not be signed out. Sign in and press Sign out again.'); }
    }
  });
})();
