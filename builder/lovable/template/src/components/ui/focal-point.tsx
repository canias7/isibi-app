import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Click the part of a picture that must survive every crop.
 *
 * `image-crop` PRODUCES ONE CROP. A site crops the same photo half a dozen
 * ways — square avatar, wide hero, tall card — and the failure is always the
 * same: the automatic centre crop cuts somebody's head off. A focal point is
 * one decision that steers all of them.
 *
 * THE OUTPUT IS `object-position`, which is why this is worth a component
 * rather than a crop tool: the browser does the cropping at every size, no
 * re-encoding, no derivative files, and the same photo stays sharp.
 *
 * PREVIEWS ARE SHOWN AT SEVERAL ASPECTS, live. A focal point that looks
 * right on the editor's own square and wrong in the 21:9 banner is the whole
 * bug, and it is invisible until the shapes sit side by side.
 *
 * Keyboard-adjustable in 2% steps — precise placement with a pointer is
 * fiddly and impossible on a phone.
 */
export function FocalPoint({ src, alt = "", value, onChange, previews = ["1/1", "16/9", "3/4"], className }: {
  src: string;
  alt?: string;
  value: { x: number; y: number };
  onChange: (v: { x: number; y: number }) => void;
  previews?: string[];
  className?: string;
}) {
  const box = React.useRef<HTMLButtonElement>(null);
  const set = (clientX: number, clientY: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    onChange({
      x: Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))),
    });
  };
  const nudge = (dx: number, dy: number) =>
    onChange({ x: Math.min(100, Math.max(0, value.x + dx)), y: Math.min(100, Math.max(0, value.y + dy)) });

  return (
    <div data-slot="focal-point" className={cn("flex flex-col gap-2", className)}>
      <button ref={box} type="button"
        onClick={(e) => set(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          const map: Record<string, [number, number]> = {
            ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2],
          };
          const d = map[e.key];
          if (d) { e.preventDefault(); nudge(d[0], d[1]); }
        }}
        aria-label={`Focal point, ${value.x}% across and ${value.y}% down. Arrow keys adjust.`}
        className="relative block w-full cursor-crosshair overflow-hidden rounded-lg border border-border">
        <img src={src} alt={alt} className="block w-full" />
        <span aria-hidden className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background ring-2 ring-foreground"
          style={{ left: `${value.x}%`, top: `${value.y}%` }} />
      </button>
      {/* Several aspects at once - the 21:9 failure is invisible on a square. */}
      <div className="flex gap-2">
        {previews.map((ratio) => (
          <figure key={ratio} className="flex flex-col items-center gap-0.5">
            <span className="block w-20 overflow-hidden rounded border border-border" style={{ aspectRatio: ratio }}>
              <img src={src} alt="" className="h-full w-full object-cover"
                style={{ objectPosition: `${value.x}% ${value.y}%` }} />
            </span>
            <figcaption className="text-[10px] text-muted-foreground">{ratio}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
