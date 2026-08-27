import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The A-Z rail beside a long alphabetical list.
 *
 * A LETTER WITH NOTHING UNDER IT IS DISABLED, not hidden. Removing empty
 * letters makes the rail a different length for every list, so the position of
 * M moves and the muscle memory that makes this control fast is gone.
 *
 * Targets are at least 24px. This is a column of thirty tap targets down the
 * edge of a phone screen, and the standard mistake is making it so tight that
 * every press lands on a neighbour.
 *
 * Jumping moves FOCUS as well as scroll, like `scroll-spy`, so the keyboard
 * continues from the section rather than the rail.
 *
 * It is `<nav>` with real buttons, so it is reachable and announced — most
 * implementations of this are a div of spans and unavailable to anybody not
 * using a pointer.
 */
export function JumpTo({ letters, available, onJump, active, className }: {
  letters?: string[];
  available: string[];
  onJump: (letter: string) => void;
  active?: string;
  className?: string;
}) {
  const all = letters ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const has = new Set(available.map((l) => l.toUpperCase()));
  return (
    <nav data-slot="jump-to" aria-label="Jump to a letter" className={cn("flex flex-col items-center", className)}>
      {all.map((l) => {
        const on = has.has(l.toUpperCase());
        return (
          <button
            key={l}
            type="button"
            disabled={!on}
            onClick={() => onJump(l)}
            aria-current={active === l ? "true" : undefined}
            aria-label={on ? `Jump to ${l}` : `${l} — nothing here`}
            className={cn("flex size-6 cursor-pointer items-center justify-center rounded text-[11px] tabular-nums",
              !on && "cursor-default text-muted-foreground/40",
              active === l ? "bg-foreground font-semibold text-background" : on && "hover:bg-muted")}
          >
            {l}
          </button>
        );
      })}
    </nav>
  );
}
