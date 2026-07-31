import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Choose the part of a photograph that gets used.
 *
 * The crop is stored as FRACTIONS of the image, never pixels. A picture is
 * displayed at whatever width the layout gives it and re-cropped later at full
 * resolution on a server; pixels measured against a 400px preview mean nothing
 * against a 4000px original, and that mismatch is how a crop comes out
 * somewhere else entirely.
 *
 * It is a fixed ASPECT window that moves and scales over the image, rather than
 * a free rectangle. The reason to crop here is almost always to fit a known
 * slot — a card, an avatar, an og:image — and a free crop lets somebody produce
 * a shape the layout will then crop again, undoing the choice they just made.
 *
 * Arrow keys move it and +/- resize it, so this is usable without a mouse.
 * Every drag-only cropper on the web is unreachable from a keyboard.
 *
 * `object-contain`, so nothing is hidden. Cropping inside a box that has
 * already cropped the preview means choosing from a picture you cannot fully
 * see.
 *
 * The area outside the crop is dimmed by a huge `box-shadow` SPREAD on the crop
 * window itself, not by an overlay with a second copy of the image inside it.
 * The overlay version needs `url(<src>)` in a style attribute, and a data URI —
 * which is what an uploaded picture is before it is saved — contains commas and
 * parentheses that make that declaration invalid, so the window silently shows
 * the dimmed image and the crop looks like it is doing nothing. Seen exactly
 * that way. The shadow needs no URL at all.
 */
export type Crop = { x: number; y: number; w: number };

export function ImageCrop({ src, alt = "", aspect = 1, value, onChange, className }: {
  src: string;
  alt?: string;
  aspect?: number;
  value: Crop;
  onChange: (crop: Crop) => void;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [size, setSize] = React.useState({ w: 1, h: 1 });

  React.useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Height as a fraction is width × aspect corrected for the box's own shape,
  // so a square crop stays square whatever the container is.
  const h = value.w * (size.w / size.h) / aspect;
  const clamp = (c: Crop): Crop => {
    const w = Math.min(1, Math.max(0.1, c.w));
    const hh = w * (size.w / size.h) / aspect;
    return { w, x: Math.min(1 - w, Math.max(0, c.x)), y: Math.min(1 - Math.min(1, hh), Math.max(0, c.y)) };
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label="Crop area — arrow keys to move, plus and minus to resize"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, cx: value.x, cy: value.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onChange(clamp({
            ...value,
            x: drag.current.cx + (e.clientX - drag.current.x) / size.w,
            y: drag.current.cy + (e.clientY - drag.current.y) / size.h,
          }));
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          if (e.key === "ArrowLeft") { e.preventDefault(); onChange(clamp({ ...value, x: value.x - step })); }
          if (e.key === "ArrowRight") { e.preventDefault(); onChange(clamp({ ...value, x: value.x + step })); }
          if (e.key === "ArrowUp") { e.preventDefault(); onChange(clamp({ ...value, y: value.y - step })); }
          if (e.key === "ArrowDown") { e.preventDefault(); onChange(clamp({ ...value, y: value.y + step })); }
          if (e.key === "+" || e.key === "=") { e.preventDefault(); onChange(clamp({ ...value, w: value.w + step })); }
          if (e.key === "-") { e.preventDefault(); onChange(clamp({ ...value, w: value.w - step })); }
        }}
        className="relative touch-none overflow-hidden rounded-md bg-muted select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <img src={src} alt={alt} draggable={false} className="block max-h-72 w-full object-contain" />
        <div
          aria-hidden
          className="pointer-events-none absolute cursor-move border-2 border-background"
          style={{
            left: `${value.x * 100}%`, top: `${value.y * 100}%`,
            width: `${value.w * 100}%`, height: `${Math.min(1, h) * 100}%`,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Crop saved as fractions: x {value.x.toFixed(2)} · y {value.y.toFixed(2)} · width {value.w.toFixed(2)}
      </p>
    </div>
  );
}
