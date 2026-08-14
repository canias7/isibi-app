import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A tooltip with more than a word in it — a definition, a shortcut, a small
 * table.
 *
 * IT OPENS ON FOCUS AS WELL AS HOVER, and it stays open while the pointer is
 * INSIDE IT. Both matter: hover-only is unreachable from a keyboard and on
 * every touchscreen, and a tooltip that closes when the pointer enters it means
 * a link inside can never be clicked. That second rule is why `rich` tooltips
 * are different from plain ones.
 *
 * There is a DELAY opening and a shorter one closing. Without the open delay,
 * moving the mouse across a toolbar fires five tooltips; without the close
 * delay, the gap between the trigger and the panel closes it before the pointer
 * arrives.
 *
 * Escape closes it, which is a WCAG requirement for content that appears on
 * hover and the thing hand-rolled tooltips always miss.
 *
 * NEVER put essential information only in here. On a touchscreen a tooltip
 * needs a deliberate press and many people never discover one exists — that is
 * why `autofill-note` is a paragraph rather than a tooltip.
 */
export function RichTooltip({ content, children, openDelay = 300, closeDelay = 150, side = "top", className }: {
  content: React.ReactNode;
  children: React.ReactNode;
  openDelay?: number;
  closeDelay?: number;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = React.useId();

  const schedule = (next: boolean, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), ms);
  };
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => schedule(true, openDelay)}
      onMouseLeave={() => schedule(false, closeDelay)}
      onFocus={() => schedule(true, 0)}
      onBlur={() => schedule(false, 0)}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } }}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0} className="rounded focus-visible:outline-2 focus-visible:outline-ring">
        {children}
      </span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          // Staying open while the pointer is inside is what makes a link in
          // here reachable at all.
          onMouseEnter={() => schedule(true, 0)}
          onMouseLeave={() => schedule(false, closeDelay)}
          className={cn("absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-xs shadow-lg",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2", className)}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
