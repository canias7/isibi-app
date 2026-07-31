import * as React from "react";
import { useSeen } from "@/components/ui/hint-dot";
import { cn } from "@/lib/utils";
/**
 * "Something changed here" — a dot keyed to a VERSION.
 *
 * THE SEEN-STATE KEY INCLUDES THE VERSION, which is the difference from
 * hint-dot: a hint is seen once and gone forever; a what's-new dot must
 * COME BACK when the thing changes again. Ship v2 of the exports screen,
 * bump the version, everyone's dot reappears once.
 *
 * PRESSING IT TELLS YOU WHAT CHANGED, in one line, in place — a dot that
 * only links to a changelog makes somebody leave their task to find out
 * they did not care. Opening the note marks it seen; the ambient dot
 * never nags twice.
 *
 * Builds on hint-dot's useSeen (one storage convention for "seen this"),
 * and is invisible when seen — absence is the steady state.
 */
export function WhatsNewDot({ feature, version, note, className }: {
  feature: string;
  version: string | number;
  note: React.ReactNode;
  className?: string;
}) {
  const { seen, markSeen } = useSeen(`whats-new-${feature}-v${version}`);
  const [open, setOpen] = React.useState(false);
  if (seen && !open) return null;
  return (
    <span className={cn("motion-fade relative inline-flex", className)}>
      <button
        type="button"
        aria-label="What changed here"
        onClick={() => { setOpen((v) => !v); if (!open) markSeen(); }}
        className="cursor-pointer p-0.5"
      >
        <span className="block size-2 rounded-full bg-foreground" />
      </button>
      {open ? (
        <span className="absolute left-1/2 top-full z-20 mt-1 w-48 -translate-x-1/2 rounded-md border border-border bg-background p-2 text-xs shadow-md">
          {note}
          <button type="button" onClick={() => setOpen(false)}
            className="mt-1.5 block cursor-pointer text-[11px] text-muted-foreground underline underline-offset-2">
            Got it
          </button>
        </span>
      ) : null}
    </span>
  );
}
