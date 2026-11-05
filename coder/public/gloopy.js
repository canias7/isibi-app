// GLOOPY (the yellow figure, owner-approved 2026-11-02, brought back 2026-11-05
// for the Gloopy agent's tab): follows the pointer, waves on a click.
(function () {
'use strict';
const GLOOPY_VARS = ['--px', '--py', '--ex', '--ey', '--tilt', '--ht', '--hx', '--hy', '--lk'];
(function gloopyFollow() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.matchMedia || !document.addEventListener || !document.documentElement) return;
  const mq = (q) => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
  document.addEventListener('click', (e) => {
    const s = e.target && e.target.closest && e.target.closest('svg.st-gloopy');
    if (!s || mq('(prefers-reduced-motion: reduce)')) return;
    // Selecting the Sites agent re-renders its row, so the svg clicked may be
    // replaced: the wave goes to the Gloopy now in the same agent row.
    const row = s.closest('[data-agent]');
    const key = row ? row.getAttribute('data-agent') : null;
    s.style.setProperty('--wv', 'none');
    void s.getBoundingClientRect();
    requestAnimationFrame(() => {
      let g = s;
      if (!g.isConnected && key) g = [...document.querySelectorAll('[data-agent] svg.st-gloopy')].find((x) => x.closest('[data-agent]').getAttribute('data-agent') === key) || g;
      g.style.setProperty('--wv', 'gg-wave');
      clearTimeout(g._gfWave);
      g._gfWave = setTimeout(() => g.style.setProperty('--wv', 'none'), 2200);
    });
  }, true);
  let mx = null, my = null, last = 0, running = false;
  const clear = (s) => { for (const v of GLOOPY_VARS) s.style.removeProperty(v); };
  function tick() {
    const icons = [...document.querySelectorAll('svg.st-gloopy')].filter((s) => s.getClientRects().length);
    const idle = mx === null || performance.now() - last > 2500;
    for (const s of icons) {
      if (idle) { clear(s); continue; }
      const r = s.getBoundingClientRect();
      const dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height * 0.38);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220);
      const c = (v) => Math.max(-1, Math.min(1, v));
      s.style.setProperty('--lk', 'none');
      s.style.setProperty('--px', (dx / d * 6 * k).toFixed(2) + 'px'); s.style.setProperty('--py', (dy / d * 5 * k).toFixed(2) + 'px');
      s.style.setProperty('--ex', (dx / d * 4 * k).toFixed(2) + 'px'); s.style.setProperty('--ey', (dy / d * 3.5 * k).toFixed(2) + 'px');
      s.style.setProperty('--tilt', (c(dx / 350) * 4).toFixed(2) + 'deg'); s.style.setProperty('--ht', (c(dx / 300) * 15).toFixed(2) + 'deg');
      s.style.setProperty('--hx', (dx / d * 4 * k).toFixed(2) + 'px'); s.style.setProperty('--hy', (dy / d * 3 * k).toFixed(2) + 'px');
    }
    if (idle || !icons.length) { running = false; return; }
    requestAnimationFrame(tick);
  }
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !mq('(any-pointer: fine)') || mq('(prefers-reduced-motion: reduce)')) return;
    mx = e.clientX; my = e.clientY; last = performance.now();
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { mx = null; });
})();
window.gloopyHTML = function (h) { return '<svg class="st-gloopy" viewBox="0 0 200 230" width="' + Math.round(h * 200 / 230) + '" height="' + h + '" aria-hidden="true" focusable="false"><use href="#gfGloopy"/></svg>'; };
})();
