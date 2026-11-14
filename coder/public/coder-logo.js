// CODER'S LOGO, THE TYPEWRITER (the owner, 2026-11-14: "that will be the logo for Coder, but you're gonna make it.
// You're going to make it in code, not an image … Just a typewriter, like moving the keys and moving the tip, like, you
// know, like if it's actually typing"; before, of an old Underwood: "I think there's some more modern ones, and more
// simpler"): a modern portable typewriter, drawn here once (window.coderLogoHTML) for Coder's tab on the left, its chat's
// bar and its empty chat, as gloopy.js draws Gloopy. Still until it types: while Coder works on a message (coder.js says
// so: window.coderLogo.busy), and one line on a hover or a click. A line: the keys go down one at a time, the type bar
// flicks up to the paper and a letter shows, the carriage steps left; at the line's end the lever is pushed, the paper
// goes up a line and the carriage slides back. The motion is coder-logo.css's; none with reduced motion.
(function () {
  'use strict';
  // WHEN IT TYPES (easy to change): while Coder works on a message, and one line on a hover or a click.
  const WHEN = { working: true, hover: true, click: true };
  // One line typed and its return, in ms (the same as --cl-t in coder-logo.css).
  const LINE_MS = 2500;
  // THE DRAWING (viewBox 0 0 100 100), back to front. A moving part has a clg- class (coder-logo.css moves it). No ids,
  // so it can be drawn more than once on the page. Its colours: the body in Coder's teal (#0f766e; #115e59 under it,
  // #0a4d47 under the keys), cream keys (#f7f4ee), ink (#0d1b2a) for the roller, knobs, lever and letters, white
  // paper (#d5cec3 at its edge), and the type bar in the page's orange "working" colour (#e8912d).
  const DRAWING = [
    // The carriage: the return lever, the paper and its lines, the roller and its knobs (they slide together).
    '<g class="clg-car">',
    '<path class="clg-lever" d="M12 40.6L6.2 33.4" stroke="#0d1b2a" stroke-width="2.6" stroke-linecap="round"/>',
    '<rect x="30.2" y="11" width="42" height="37" rx="1.4" fill="#0d1b2a" opacity=".08"/><rect x="29" y="10" width="42" height="37" rx="1.4" fill="#ffffff" stroke="#d5cec3" stroke-width=".9"/>',
    // The paper's lines (they go up a line at each return): the faint one, the one done, the line being typed (three
    // letters done, three to come), and the next line's first three, still under the roller.
    '<g class="clg-feed" fill="#0d1b2a">',
    '<g class="clg-l3" opacity=".3"><rect x="39.85" y="22.6" width="2.3" height="3.4" rx=".6"/><rect x="42.85" y="22.6" width="2.3" height="3.4" rx=".6"/><rect x="45.85" y="23.5" width="2.3" height="2.5" rx=".6"/><rect x="51.85" y="23.5" width="2.3" height="2.5" rx=".6"/><rect x="54.85" y="23.5" width="2.3" height="2.5" rx=".6"/><rect x="57.85" y="22.6" width="2.3" height="3.4" rx=".6"/></g>',
    '<g class="clg-l2"><rect x="39.85" y="28.6" width="2.3" height="3.4" rx=".6"/><rect x="42.85" y="28.6" width="2.3" height="3.4" rx=".6"/><rect x="45.85" y="29.5" width="2.3" height="2.5" rx=".6"/><rect x="51.85" y="29.5" width="2.3" height="2.5" rx=".6"/><rect x="54.85" y="29.5" width="2.3" height="2.5" rx=".6"/><rect x="57.85" y="28.6" width="2.3" height="3.4" rx=".6"/></g>',
    '<rect x="39.85" y="34.6" width="2.3" height="3.4" rx=".6"/><rect x="42.85" y="34.6" width="2.3" height="3.4" rx=".6"/><rect x="45.85" y="35.5" width="2.3" height="2.5" rx=".6"/><rect class="clg-m clg-m5" x="51.85" y="35.5" width="2.3" height="2.5" rx=".6"/><rect class="clg-m clg-m6" x="54.85" y="35.5" width="2.3" height="2.5" rx=".6"/><rect class="clg-m clg-m7" x="57.85" y="34.6" width="2.3" height="3.4" rx=".6"/>',
    '<rect class="clg-m clg-n1" x="39.85" y="40.6" width="2.3" height="3.4" rx=".6"/><rect class="clg-m clg-n2" x="42.85" y="40.6" width="2.3" height="3.4" rx=".6"/><rect class="clg-m clg-n3" x="45.85" y="41.5" width="2.3" height="2.5" rx=".6"/></g>',
    '<rect x="14" y="39" width="72" height="11" rx="5.5" fill="#0d1b2a"/><rect x="18" y="41" width="64" height="1.8" rx=".9" fill="#fff" opacity=".16"/>',
    '<rect x="7.6" y="37.6" width="8" height="13.8" rx="2.8" fill="#0d1b2a"/><rect x="84.4" y="37.6" width="8" height="13.8" rx="2.8" fill="#0d1b2a"/></g>',
    // The type bars (the tip), one from each side of the keys: hidden in the body until a key sends one up to the paper.
    '<g class="clg-bl"><path d="M50 66V38.6" stroke="#e8912d" stroke-width="2.4" stroke-linecap="round"/><rect x="48" y="34" width="4" height="5.6" rx="1.2" fill="#e8912d"/></g><g class="clg-br"><path d="M50 66V38.6" stroke="#e8912d" stroke-width="2.4" stroke-linecap="round"/><rect x="48" y="34" width="4" height="5.6" rx="1.2" fill="#e8912d"/></g>',
    // The body and its keys: two rows and the space bar.
    '<rect x="5" y="84" width="90" height="9" rx="4" fill="#115e59"/><path d="M24 48.4H76Q82.4 48.4 84.2 54.4L92.4 81Q94.2 87.4 87.6 87.4H12.4Q5.8 87.4 7.6 81L15.8 54.4Q17.6 48.4 24 48.4Z" fill="#0f766e"/>',
    '<g fill="#0a4d47"><rect x="19.5" y="57.8" width="8" height="6.2" rx="2"/><rect x="30.1" y="57.8" width="8" height="6.2" rx="2"/><rect x="40.7" y="57.8" width="8" height="6.2" rx="2"/><rect x="51.3" y="57.8" width="8" height="6.2" rx="2"/><rect x="61.9" y="57.8" width="8" height="6.2" rx="2"/><rect x="72.5" y="57.8" width="8" height="6.2" rx="2"/><rect x="24.8" y="67.4" width="8" height="6.2" rx="2"/><rect x="35.4" y="67.4" width="8" height="6.2" rx="2"/><rect x="46" y="67.4" width="8" height="6.2" rx="2"/><rect x="56.6" y="67.4" width="8" height="6.2" rx="2"/><rect x="67.2" y="67.4" width="8" height="6.2" rx="2"/><rect x="31" y="78.9" width="38" height="5.4" rx="2.7"/></g>',
    '<g fill="#f7f4ee"><rect class="clg-k0" x="19.5" y="56.5" width="8" height="6.2" rx="2"/><rect class="clg-k1" x="30.1" y="56.5" width="8" height="6.2" rx="2"/><rect class="clg-k2" x="40.7" y="56.5" width="8" height="6.2" rx="2"/><rect class="clg-k3" x="51.3" y="56.5" width="8" height="6.2" rx="2"/><rect class="clg-k4" x="61.9" y="56.5" width="8" height="6.2" rx="2"/><rect class="clg-k5" x="72.5" y="56.5" width="8" height="6.2" rx="2"/><rect class="clg-k6" x="24.8" y="66.1" width="8" height="6.2" rx="2"/><rect class="clg-k7" x="35.4" y="66.1" width="8" height="6.2" rx="2"/><rect class="clg-k8" x="46" y="66.1" width="8" height="6.2" rx="2"/><rect class="clg-k9" x="56.6" y="66.1" width="8" height="6.2" rx="2"/><rect class="clg-k10" x="67.2" y="66.1" width="8" height="6.2" rx="2"/><rect class="clg-sp" x="31" y="77.6" width="38" height="5.4" rx="2.7"/></g>',
  ].join('');
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  let busy = false, since = 0, finish = 0;
  // How far into its line the typing is (ms): a logo drawn again while Coder works (its chat's bar is redrawn every 1.5
  // seconds) goes on from there, in step with the others, instead of starting the line again.
  const into = () => (performance.now() - since) % LINE_MS;
  window.coderLogoHTML = function (h) {
    const on = (busy || !!finish) && !reduced();
    return '<svg class="cl-logo' + (on ? ' cl-run' : '') + '" viewBox="0 0 100 100" width="' + h + '" height="' + h + '"' + (on ? ' style="--cl-d:-' + Math.round(into()) + 'ms"' : '') + ' aria-hidden="true" focusable="false">' + DRAWING + '</svg>';
  };
  const logos = () => document.querySelectorAll('svg.cl-logo');
  // CODER IS WORKING, or not (coder.js, each time it draws Coder's chat). It types from then on; when Coder is done it
  // finishes its line first, so it stops as it started (the drawing at rest), with no jump.
  function setBusy(on) {
    on = !!on && WHEN.working && !reduced();
    if (on === busy) return;
    busy = on;
    if (!on) { finish = setTimeout(stop, LINE_MS - into()); return; }
    if (finish) { clearTimeout(finish); finish = 0; return; } // still on its last line: it goes on
    // (A logo already typing its one line for a hover goes on, and the others start in step with it.)
    const going = [...logos()].find((s) => s.classList.contains('cl-once'));
    since = going ? going._clAt : performance.now();
    for (const s of logos()) {
      if (s.classList.contains('cl-once')) { s.classList.remove('cl-once'); continue; }
      s.style.setProperty('--cl-d', '-' + Math.round(into()) + 'ms');
      s.classList.add('cl-run');
    }
  }
  function stop() {
    finish = 0;
    for (const s of logos()) if (!s.classList.contains('cl-once')) { s.classList.remove('cl-run'); s.style.removeProperty('--cl-d'); }
  }
  window.coderLogo = { busy: setBusy };
  // ONE LINE ON A HOVER OR A CLICK (on a logo, or on a button that has one, such as Coder's tab), then still again.
  function once(s) {
    if (!s || reduced() || s.classList.contains('cl-run')) return;
    s._clAt = performance.now();
    s.style.setProperty('--cl-d', '0ms');
    s.classList.add('cl-run', 'cl-once');
  }
  const host = (t) => {
    if (!t || !t.closest) return null;
    const s = t.closest('svg.cl-logo'), b = t.closest('button');
    return b && (!s || b.contains(s)) ? b : s;
  };
  const logoIn = (h) => (!h ? null : h.matches('svg.cl-logo') ? h : h.querySelector('svg.cl-logo'));
  document.addEventListener('animationend', (e) => {
    if (e.animationName !== 'clg-car') return;
    const s = e.target.closest && e.target.closest('svg.cl-logo');
    if (s && s.classList.contains('cl-once')) { s.classList.remove('cl-run', 'cl-once'); s.style.removeProperty('--cl-d'); }
  });
  if (WHEN.hover) document.addEventListener('pointerover', (e) => {
    const h = host(e.target);
    if (!h || e.pointerType === 'touch' || (e.relatedTarget && h.contains(e.relatedTarget))) return;
    once(logoIn(h));
  }, { passive: true });
  if (WHEN.click) document.addEventListener('click', (e) => once(logoIn(host(e.target))), true);
})();
