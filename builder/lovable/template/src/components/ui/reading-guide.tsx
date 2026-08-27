import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A horizontal band that follows the pointer down long text — a finger under
 * the line, for screens.
 *
 * IT IS OPT-IN AND THE TOGGLE IS VISIBLE. A reading aid that appears uninvited
 * is a distraction for the nine people in ten who did not want it; discovery
 * matters less than consent here.
 *
 * THE BAND FOLLOWS THE POINTER'S LINE, dimming everything else slightly —
 * never a hard mask, because context above and below is part of reading, and
 * a letterbox that hides it helps nobody.
 *
 * POSITION IS WRITTEN DIRECTLY TO THE NODE from pointermove — the `tilt-card`
 * rule — because routing a per-move update through React re-renders the whole
 * article at pointer speed.
 *
 * Keyboard: the band follows focus within the text when arrowing, and Escape
 * turns it off — a mode with no exit is a trap.
 */
export function ReadingGuide({ height = 44, children, className }: {
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [on, setOn] = React.useState(false);
  const band = React.useRef<HTMLDivElement>(null);
  const wrap = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOn(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on]);

  return (
    <div data-slot="reading-guide" className={cn("flex flex-col gap-2", className)}>
      <button type="button" onClick={() => setOn((v) => !v)} aria-pressed={on}
        className="cursor-pointer self-start rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
        {on ? "Hide the reading guide (Esc)" : "Reading guide"}
      </button>
      <div
        ref={wrap}
        onPointerMove={(e) => {
          if (!on || !band.current || !wrap.current) return;
          const r = wrap.current.getBoundingClientRect();
          // Written straight to the node: per-move React renders the article.
          band.current.style.top = `${e.clientY - r.top - height / 2}px`;
        }}
        className="relative"
      >
        {children}
        {on ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div ref={band}
              style={{ height, boxShadow: "0 0 0 9999px color-mix(in oklab, var(--background) 55%, transparent)" }}
              className="absolute inset-x-0 top-0" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
