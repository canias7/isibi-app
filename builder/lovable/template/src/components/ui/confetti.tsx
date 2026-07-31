import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A burst of pieces from a point — the small version of `celebration`.
 *
 * CANVAS, not DOM nodes. A hundred absolutely-positioned spans is a hundred
 * elements the browser lays out and composites every frame; the same hundred on
 * a canvas is one element and a loop. `celebration` uses DOM because a dozen
 * pieces of pure CSS needs no script at all — past about twenty, canvas wins.
 *
 * It runs for a fixed duration and then STOPS THE LOOP and clears. A rAF loop
 * left running is a permanent drain on the battery of every phone that ever
 * opened the page, and it is invisible in every test.
 *
 * `prefers-reduced-motion` renders nothing at all. There is no message here to
 * fall back to — this is purely decorative, which is exactly the thing that
 * should disappear when somebody has asked for less movement.
 *
 * Monochrome: the pieces are the foreground colour at varying opacity. The kit
 * has no palette to draw a rainbow from, and a burst of one colour reads fine.
 */
export function Confetti({ fire, pieces = 90, duration = 1200, className }: {
  fire: boolean;
  pieces?: number;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!fire) return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const ink = getComputedStyle(canvas).color;
    const bits = Array.from({ length: pieces }, (_, i) => {
      const angle = (i / pieces) * Math.PI * 2;
      const speed = 3 + (i % 7) * 0.6;
      return {
        x: w / 2, y: h / 2,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: 2 + (i % 3), spin: (i % 2 ? 1 : -1) * 0.2, rot: 0,
      };
    });

    let raf = 0, t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const p = (now - t0) / duration;
      if (p >= 1) { ctx.clearRect(0, 0, w, h); return; }
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = ink;
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.22; b.rot += b.spin;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 1.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Stopping the loop is the whole reason this is safe to put on a page.
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); };
  }, [fire, pieces, duration]);

  return (
    <canvas ref={ref} aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full text-foreground motion-reduce:hidden", className)} />
  );
}
