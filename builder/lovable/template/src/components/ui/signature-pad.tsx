import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Sign with a finger or a mouse.
 *
 * Pointer events, not mouse or touch events: one set of handlers that works
 * for a finger, a stylus and a trackpad, where the mouse-only version is
 * inert on exactly the device people sign on.
 *
 * The canvas is scaled by `devicePixelRatio`, or the signature is a blurry
 * 1× bitmap stretched over a retina screen — which is what it will be printed
 * from.
 *
 * There is ALWAYS a typed-name fallback in `onClear`'s neighbourhood: a
 * signature nobody can draw (no pointer, a screen reader) must not be the
 * only way to agree to something. Render `Input` beside this for that.
 */
export function SignaturePad({ onChange, height = 160, className }: {
  onChange?: (dataUrl: string | null) => void; height?: number; className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const [empty, setEmpty] = React.useState(true);

  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).color;
  }, [height]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ctx = () => ref.current?.getContext("2d") ?? null;

  const clear = () => {
    const c = ref.current, g = ctx();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div data-slot="signature-pad" className={cn("space-y-2", className)}>
      <canvas ref={ref} style={{ height, touchAction: "none" }}
        className="w-full cursor-crosshair rounded-md border border-input text-foreground"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const g = ctx(); if (!g) return;
          const p = at(e); g.beginPath(); g.moveTo(p.x, p.y);
          drawing.current = true; setEmpty(false);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const g = ctx(); if (!g) return;
          const p = at(e); g.lineTo(p.x, p.y); g.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange?.(ref.current?.toDataURL("image/png") ?? null);
        }}
        onPointerLeave={() => { drawing.current = false; }} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Sign above</p>
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={empty}>Clear</Button>
      </div>
    </div>
  );
}
