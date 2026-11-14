// CODER'S LOGO, THE TYPEWRITER (the owner, 2026-11-14: "that will be the logo for Coder, but you're gonna make it.
// You're going to make it in code, not an image … Just a typewriter, like moving the keys and moving the tip, like, you
// know, like if it's actually typing"; before, of an old Underwood: "I think there's some more modern ones, and more
// simpler"): a modern portable typewriter, drawn here once (window.coderLogoHTML) for Coder's tab on the left, its chat's
// bar and its empty chat, as gloopy.js draws Gloopy. Still until it types: while Coder works on a message (coder.js says
// so: window.coderLogo.busy), and one line on a hover or a click. A line: the keys go down one at a time, the type bar
// flicks up to the paper and a letter shows, the carriage steps left; at the line's end the lever is pushed, the paper
// goes up a line and the carriage slides back; the ribbon lifts to the paper as each bar strikes. Every line is "fix bug",
// so a line ends as the drawing began and it loops with no jump. The motion is coder-logo.css's; none with reduced motion.
(function () {
  'use strict';
  // WHEN IT TYPES (easy to change): while Coder works on a message, and one line on a hover or a click.
  const WHEN = { working: true, hover: true, click: true };
  // One line typed and its return, in ms (the same as --cl-t in coder-logo.css).
  const LINE_MS = 2500;
  // THE DRAWING (viewBox 0 0 100 100), back to front. A moving part has a clg- class (coder-logo.css moves it). No ids
  // (so no gradients: its light and shade are shapes of their own), so it can be drawn more than once on the page.
  // Made more real on 2026-11-14 (the owner: "lets make it a bit more real, like more present"): lit from the top left,
  // a shadow under it, feet, the roller's knobs with grips, the ribbon spools and the type basket on its deck, the
  // ribbon at the print point, and typewriter letters on the paper. Its colours (red, the owner's pick of
  // four, 2026-11-14): the body #c0392b (its deck #d4473a, its lower front #a93226, its base #7b241c), cream keys
  // (#f7f4ee), ink (#0d1b2a) for the roller, knobs, lever, spools and letters, white paper (#d5cec3 at its edge), metal
  // grey (#9aa6b2), the ribbon's red (#c0392b), and a gold type bar (#f2c14e), which shows against the red.
  const DRAWING = [
    // The shadow on the desk.
    '<ellipse cx="50" cy="94.4" rx="46" ry="3.4" fill="#0d1b2a" opacity=".14"/>',
    // THE CARRIAGE (it slides): the return lever with its knob, the paper, its lines, the roller and its knobs.
    '<g class="clg-car">',
    '<g class="clg-lever"><path d="M12 40.6L6.4 33.6" stroke="#0d1b2a" stroke-width="2.4" stroke-linecap="round"/><circle cx="6" cy="33.1" r="2.1" fill="#0d1b2a"/><circle cx="5.4" cy="32.5" r=".7" fill="#fff" opacity=".35"/></g>',
    '<rect x="30.4" y="11.2" width="42" height="37" rx="1.4" fill="#0d1b2a" opacity=".1"/>',
    '<rect x="29" y="10" width="42" height="37" rx="1.4" fill="#ffffff" stroke="#d5cec3" stroke-width=".9"/>',
    '<rect x="29.5" y="10.5" width="41" height="2.6" rx="1" fill="#0d1b2a" opacity=".05"/>',
    // The paper's lines, typewriter letters drawn as strokes, every one "fix bug" (they go up a line at each return): the
    // faint one, the one done, the line being typed (3 letters done, 3 to come), and the next line's first 3, under the roller.
    '<g class="clg-feed" fill="#0d1b2a">',
    '<g class="clg-l3" opacity=".3"><path d="M40.8 26v-2.65q0-.95.95-.95h.45M39.95 23.75h2.05M39.95 26h1.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 26v-2.25h-.75M43.1 26h1.85M43.95 22.7h.05" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M45.95 23.75l2.1 2.25M48.05 23.75l-2.1 2.25" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M51.6 22.45h.55v3.55M52.15 24.88a1.02 1.12 0 1 0 2.04 0a1.02 1.12 0 1 0-2.04 0" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M54.7 23.75h.35v1.25q0 1 .95 1t.95-1v-1.25h-.3M56.75 25v1h.45" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 24.8a.96 1.05 0 1 0 1.92 0a.96 1.05 0 1 0-1.92 0M59.92 23.75h.4m-.4 0v2.5q0 1-1 1h-.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/></g>',
    '<g class="clg-l2"><path d="M40.8 32v-2.65q0-.95.95-.95h.45M39.95 29.75h2.05M39.95 32h1.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 32v-2.25h-.75M43.1 32h1.85M43.95 28.7h.05" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M45.95 29.75l2.1 2.25M48.05 29.75l-2.1 2.25" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M51.6 28.45h.55v3.55M52.15 30.88a1.02 1.12 0 1 0 2.04 0a1.02 1.12 0 1 0-2.04 0" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M54.7 29.75h.35v1.25q0 1 .95 1t.95-1v-1.25h-.3M56.75 31v1h.45" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 30.8a.96 1.05 0 1 0 1.92 0a.96 1.05 0 1 0-1.92 0M59.92 29.75h.4m-.4 0v2.5q0 1-1 1h-.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/></g>',
    '<path d="M40.8 38v-2.65q0-.95.95-.95h.45M39.95 35.75h2.05M39.95 38h1.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 38v-2.25h-.75M43.1 38h1.85M43.95 34.7h.05" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path d="M45.95 35.75l2.1 2.25M48.05 35.75l-2.1 2.25" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path class="clg-m clg-m5" d="M51.6 34.45h.55v3.55M52.15 36.88a1.02 1.12 0 1 0 2.04 0a1.02 1.12 0 1 0-2.04 0" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path class="clg-m clg-m6" d="M54.7 35.75h.35v1.25q0 1 .95 1t.95-1v-1.25h-.3M56.75 37v1h.45" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path class="clg-m clg-m7" d="M58 36.8a.96 1.05 0 1 0 1.92 0a.96 1.05 0 1 0-1.92 0M59.92 35.75h.4m-.4 0v2.5q0 1-1 1h-.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path class="clg-m clg-n1" d="M40.8 44v-2.65q0-.95.95-.95h.45M39.95 41.75h2.05M39.95 44h1.85" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path class="clg-m clg-n2" d="M44 44v-2.25h-.75M43.1 44h1.85M43.95 40.7h.05" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/><path class="clg-m clg-n3" d="M45.95 41.75l2.1 2.25M48.05 41.75l-2.1 2.25" fill="none" stroke="#0d1b2a" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/>',
    '</g>',
    // The roller: dark, lit along its top, shaded along its bottom.
    '<rect x="14" y="39" width="72" height="11" rx="5.5" fill="#0d1b2a"/><rect x="18" y="40.7" width="64" height="2" rx="1" fill="#fff" opacity=".2"/><rect x="18" y="46.6" width="64" height="2" rx="1" fill="#000" opacity=".3"/>',
    // The roller's knobs, with their grips.
    '<rect x="7.4" y="37.4" width="8.4" height="14.2" rx="2.9" fill="#0d1b2a"/><rect x="84.2" y="37.4" width="8.4" height="14.2" rx="2.9" fill="#0d1b2a"/>',
    '<g fill="#fff" opacity=".2"><rect x="9.2" y="39.6" width=".8" height="9.8" rx=".4"/><rect x="11.2" y="39.6" width=".8" height="9.8" rx=".4"/><rect x="13.2" y="39.6" width=".8" height="9.8" rx=".4"/><rect x="86" y="39.6" width=".8" height="9.8" rx=".4"/><rect x="88" y="39.6" width=".8" height="9.8" rx=".4"/><rect x="90" y="39.6" width=".8" height="9.8" rx=".4"/></g>',
    '</g>',
    // THE RIBBON at the print point, black over red in its metal guide: below the line at rest, up as a bar strikes.
    '<g class="clg-rb"><rect x="44.2" y="37.8" width="1.2" height="3.6" rx=".5" fill="#9aa6b2"/><rect x="54.6" y="37.8" width="1.2" height="3.6" rx=".5" fill="#9aa6b2"/><rect x="45.2" y="38.6" width="9.6" height="1.05" fill="#0d1b2a"/><rect x="45.2" y="39.65" width="9.6" height="1.05" fill="#c0392b"/></g>',
    // THE TYPE BARS (the tip), one from each side: hidden in the body until a key sends one up to the paper.
    '<g class="clg-bl"><path d="M50 66V38.6" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round"/><rect x="48" y="34" width="4" height="5.6" rx="1.2" fill="#f2c14e"/></g><g class="clg-br"><path d="M50 66V38.6" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round"/><rect x="48" y="34" width="4" height="5.6" rx="1.2" fill="#f2c14e"/></g>',
    // THE BODY: its feet, its base (with a name plate), its shell (the top deck lit, the front, the darker apron), its edges.
    '<rect x="13" y="90.6" width="9" height="4.2" rx="1.6" fill="#0d1b2a"/><rect x="78" y="90.6" width="9" height="4.2" rx="1.6" fill="#0d1b2a"/>',
    '<rect x="5" y="83.4" width="90" height="9.4" rx="4" fill="#7b241c"/><rect x="9" y="84.2" width="82" height="1.1" rx=".55" fill="#fff" opacity=".12"/><rect x="43" y="87.2" width="14" height="2.4" rx="1.1" fill="#f7f4ee" opacity=".55"/>',
    '<path d="M24 48.4H76Q82.4 48.4 84.2 54.4L92.4 81Q94.2 87.4 87.6 87.4H12.4Q5.8 87.4 7.6 81L15.8 54.4Q17.6 48.4 24 48.4Z" fill="#c0392b"/>',
    // The top deck (lit), and the dark line where it turns down to the keys.
    '<path d="M24 48.4H76Q82.4 48.4 84.2 54.4L84.9 56.6H15.1L15.8 54.4Q17.6 48.4 24 48.4Z" fill="#d4473a"/><path d="M15.1 56.6H84.9" stroke="#5e1b15" stroke-width=".8" opacity=".55"/>',
    // The lower front, darker.
    '<path d="M9.2 75.6H90.8L92.4 81Q94.2 87.4 87.6 87.4H12.4Q5.8 87.4 7.6 81Z" fill="#a93226"/>',
    // Edges: lit on the left, shaded on the right; the deck's lit top edge.
    '<path d="M16.2 55L8.1 81.4" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".14"/><path d="M83.8 55L91.9 81.4" stroke="#000" stroke-width="1" stroke-linecap="round" opacity=".14"/><path d="M24.4 49.2H75.6" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".22"/>',
    // A soft shine on the upper left, and a fine outline so it stands out at small sizes.
    '<path d="M22 50.4H44Q38 52.6 33.6 56.6H16.6L17.6 53.6Q19 50.4 22 50.4Z" fill="#fff" opacity=".1"/><path d="M24 48.4H76Q82.4 48.4 84.2 54.4L92.4 81Q94.2 87.4 87.6 87.4H12.4Q5.8 87.4 7.6 81L15.8 54.4Q17.6 48.4 24 48.4Z" fill="none" stroke="#5e1b15" stroke-width=".7" opacity=".6"/>',
    // The ribbon spools on the deck.
    '<ellipse cx="25.4" cy="52.6" rx="6.2" ry="2.5" fill="#0d1b2a"/><ellipse cx="25.4" cy="52.3" rx="3.6" ry="1.4" fill="#9aa6b2"/><ellipse cx="25.4" cy="52.3" rx="1.2" ry=".55" fill="#0d1b2a"/>',
    '<ellipse cx="74.6" cy="52.6" rx="6.2" ry="2.5" fill="#0d1b2a"/><ellipse cx="74.6" cy="52.3" rx="3.6" ry="1.4" fill="#9aa6b2"/><ellipse cx="74.6" cy="52.3" rx="1.2" ry=".55" fill="#0d1b2a"/>',
    // The type basket: the bars at rest, fanned in their dark slot.
    '<path d="M36.8 56.6A13.2 5.2 0 0 1 63.2 56.6Z" fill="#5e1b15"/><path d="M47.59 56.18L39.63 54.78M47.84 56L40.7 54.03M48.17 55.85L42.11 53.38M48.56 55.73L43.82 52.85M49.01 55.64L45.75 52.45M49.5 55.58L47.83 52.21M50 55.56L50 52.13M50.5 55.58L52.17 52.21M50.99 55.64L54.25 52.45M51.44 55.73L56.18 52.85M51.83 55.85L57.89 53.38M52.16 56L59.3 54.03M52.41 56.18L60.37 54.78" stroke="#9aa6b2" stroke-width=".55" stroke-linecap="round" opacity=".7"/>',
    // The keys: their shades, then the caps (two rows and the space bar).
    '<g fill="#6e1f17"><rect x="19.5" y="57.8" width="8" height="6.2" rx="2"/><rect x="30.1" y="57.8" width="8" height="6.2" rx="2"/><rect x="40.7" y="57.8" width="8" height="6.2" rx="2"/><rect x="51.3" y="57.8" width="8" height="6.2" rx="2"/><rect x="61.9" y="57.8" width="8" height="6.2" rx="2"/><rect x="72.5" y="57.8" width="8" height="6.2" rx="2"/><rect x="24.8" y="67.4" width="8" height="6.2" rx="2"/><rect x="35.4" y="67.4" width="8" height="6.2" rx="2"/><rect x="46" y="67.4" width="8" height="6.2" rx="2"/><rect x="56.6" y="67.4" width="8" height="6.2" rx="2"/><rect x="67.2" y="67.4" width="8" height="6.2" rx="2"/><rect x="31" y="78.9" width="38" height="5.4" rx="2.7"/></g>',
    '<g class="clg-k0"><rect x="19.5" y="56.5" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="20.7" y="57.2" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="20.1" y="61.2" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k1"><rect x="30.1" y="56.5" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="31.3" y="57.2" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="30.7" y="61.2" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k2"><rect x="40.7" y="56.5" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="41.9" y="57.2" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="41.3" y="61.2" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k3"><rect x="51.3" y="56.5" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="52.5" y="57.2" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="51.9" y="61.2" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k4"><rect x="61.9" y="56.5" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="63.1" y="57.2" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="62.5" y="61.2" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k5"><rect x="72.5" y="56.5" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="73.7" y="57.2" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="73.1" y="61.2" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k6"><rect x="24.8" y="66.1" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="26" y="66.8" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="25.4" y="70.8" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k7"><rect x="35.4" y="66.1" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="36.6" y="66.8" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="36" y="70.8" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k8"><rect x="46" y="66.1" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="47.2" y="66.8" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="46.6" y="70.8" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k9"><rect x="56.6" y="66.1" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="57.8" y="66.8" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="57.2" y="70.8" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-k10"><rect x="67.2" y="66.1" width="8" height="6.2" rx="2" fill="#f7f4ee"/><rect x="68.4" y="66.8" width="5.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="67.8" y="70.8" width="6.8" height="1.1" rx=".55" fill="#d9d2c5"/></g><g class="clg-sp"><rect x="31" y="77.6" width="38" height="5.4" rx="2" fill="#f7f4ee"/><rect x="32.2" y="78.3" width="35.6" height="1.1" rx=".55" fill="#fff" opacity=".9"/><rect x="31.6" y="81.5" width="36.8" height="1.1" rx=".55" fill="#d9d2c5"/></g>',
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
