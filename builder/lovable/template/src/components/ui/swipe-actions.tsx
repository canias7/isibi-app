import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Swipe a row sideways to reveal Archive and Delete.
 *
 * THE ACTIONS ARE ALSO REAL BUTTONS, shown on hover and always reachable by
 * keyboard. A swipe is undiscoverable and impossible with a mouse or a
 * keyboard, so swipe-only actions are actions most people never find — this is
 * the same rule as `drag-list`, one gesture down.
 *
 * It only captures a gesture that is clearly HORIZONTAL. Deciding on the first
 * pointer event steals every vertical scroll that starts on a row, which makes
 * the whole list impossible to scroll on a phone — the commonest bug in this
 * pattern. The direction is judged after ~10px of movement.
 *
 * It does not TRIGGER on release, only reveal. A swipe that deletes when you
 * let go deletes things people were only scrolling past, and there is no
 * confirmation step to catch it.
 *
 * `touch-action: pan-y` tells the browser vertical scrolling is still ours to
 * pass through, which is what stops the two gestures fighting.
 */
export function SwipeActions({ actions, children, className }: {
  actions: { key: string; label: string; icon?: React.ReactNode; onAction: () => void; destructive?: boolean }[];
  children: React.ReactNode;
  className?: string;
}) {
  const [offset, setOffset] = React.useState(0);
  const start = React.useRef<{ x: number; y: number; axis: null | "x" | "y" } | null>(null);
  const width = actions.length * 72;

  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div className="absolute inset-y-0 end-0 flex">
        {actions.map((a) => (
          <button key={a.key} type="button" onClick={() => { a.onAction(); setOffset(0); }}
            className={cn("flex w-18 cursor-pointer flex-col items-center justify-center gap-1 px-3 text-xs",
              a.destructive ? "bg-foreground font-medium text-background" : "bg-muted")}>
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        style={{ transform: `translateX(${-offset}px)`, touchAction: "pan-y" }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, axis: null }; }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          // Decide the axis only once the gesture is unambiguous, or every
          // vertical scroll starting on a row is swallowed.
          if (!s.axis) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (s.axis === "y") { start.current = null; return; }
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setOffset(Math.max(0, Math.min(width, -dx)));
        }}
        onPointerUp={() => {
          start.current = null;
          // Reveal or close — never fire the action on release.
          setOffset((o) => (o > width / 2 ? width : 0));
        }}
        onPointerCancel={() => { start.current = null; setOffset(0); }}
        className="relative bg-background transition-transform duration-(--dur-2) motion-reduce:transition-none"
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        {actions.map((a) => (
          <button key={a.key} type="button" onClick={a.onAction} aria-label={a.label}
            className={cn("h-full cursor-pointer px-3 text-xs",
              a.destructive ? "bg-foreground font-medium text-background" : "bg-muted")}>
            {a.icon ?? a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
