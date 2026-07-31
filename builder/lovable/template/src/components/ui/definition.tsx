import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An inline term whose meaning is one tap away.
 *
 * A REAL `<dfn>` WRAPS THE FIRST USE — the semantic claim "this is where
 * the term is defined", which search engines and reading tools use. The
 * convention this component encodes: define a term ONCE, at first use;
 * later uses are just words (a page where every "fade" is interactive
 * reads like a minefield).
 *
 * NOT `title=""` — hover tooltips do not exist on touch, which is most
 * readers. The term is a button (dotted underline, the established signal
 * for "defined here"); the meaning expands INLINE and closes on a second
 * press or Escape. Inline rather than floating because a definition is
 * prose, not chrome — it should wrap, select and print.
 *
 * aria-expanded on the button; the meaning is in the flow, so a screen
 * reader meets it exactly where a sighted reader does.
 */
export function Definition({ term, children, className }: {
  term: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <dfn className="not-italic">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          className={cn("cursor-pointer underline decoration-dotted underline-offset-2",
            open && "decoration-solid font-medium", className)}>
          {term}
        </button>
      </dfn>
      {open ? (
        <span className="mx-1 rounded-sm bg-muted px-1.5 py-0.5 text-[0.9em] text-muted-foreground">
          {children}
        </span>
      ) : null}
    </>
  );
}
