import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Somebody else's pointer, with their name on it.
 *
 * IT IS `aria-hidden` AND `pointer-events-none`. A cursor is a decoration
 * layered over the document — announcing every movement would make the page
 * unusable with a screen reader, and intercepting a click would make it
 * unusable with a mouse. Presence for assistive technology belongs in
 * `presence-bar`, which names people once.
 *
 * The position is applied as a TRANSFORM, not `top`/`left`. Transforms are
 * composited; changing `top` on every message from every collaborator forces a
 * layout on the whole document dozens of times a second.
 *
 * The label is offset DOWN AND RIGHT of the point, so it never sits under the
 * arrow tip — which is exactly where the reader is looking.
 *
 * A cursor FADES after a quiet period rather than vanishing. A tab that goes
 * silent leaves a pointer frozen mid-document forever otherwise, which reads as
 * somebody staring at one word.
 */
export function LiveCursor({ x, y, name, idleAfter = 15000, lastMove, className }: {
  x: number;
  y: number;
  name: string;
  idleAfter?: number;
  lastMove?: number;
  className?: string;
}) {
  const [faded, setFaded] = React.useState(false);

  React.useEffect(() => {
    setFaded(false);
    const t = setTimeout(() => setFaded(true), idleAfter);
    return () => clearTimeout(t);
  }, [x, y, lastMove, idleAfter]);

  return (
    <div
      aria-hidden
      // A transform is composited; top/left forces a layout on every message.
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      className={cn("pointer-events-none absolute top-0 start-0 z-40 transition-opacity duration-(--dur-4)",
        faded && "opacity-30", className)}
    >
      <svg width="14" height="18" viewBox="0 0 14 18" className="drop-shadow-sm">
        <path d="M1 1l11 7-4.5 1.3L5 16 1 1z" fill="currentColor" stroke="var(--background)" strokeWidth="1.2" />
      </svg>
      <span className="ms-3 -mt-1 inline-block rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background">
        {name}
      </span>
    </div>
  );
}
