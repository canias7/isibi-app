import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The current state of a record, from a declared set.
 *
 * THE STATES ARE A CLOSED LIST supplied by the caller, and an unknown value
 * renders as itself with a dashed outline rather than as nothing. A badge that
 * silently disappears for a state somebody added to the backend is how a table
 * grows blank cells nobody can explain.
 *
 * TERMINAL STATES LOOK DIFFERENT from in-progress ones — filled versus
 * outlined — because "done" and "still going" is the distinction people scan
 * for, and it is a different question from which state it is.
 *
 * The tone is FILL AND WEIGHT, never colour. A status column is the classic
 * place colour-only coding fails, and it is scanned down rather than read.
 *
 * The state's MEANING is available as a title when the caller supplies one.
 * "Pending" means different things in different systems and the badge is where
 * somebody asks.
 */
export type StateSpec = { key: string; label: string; terminal?: boolean; meaning?: string };

export function StateBadge({ state, states, className }: {
  state: string;
  states: StateSpec[];
  className?: string;
}) {
  const spec = states.find((s) => s.key === state);
  if (!spec) {
    // Never nothing: a blank cell is unexplainable.
    return (
      <span data-slot="state-badge" className={cn("inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground", className)}
        title="This state is not one the app knows about">
        {state}
      </span>
    );
  }
  return (
    <span title={spec.meaning}
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
        spec.terminal ? "bg-foreground font-medium text-background" : "border border-foreground text-foreground",
        className)}>
      {spec.label}
      <span className="sr-only">{spec.terminal ? " — finished" : " — still in progress"}</span>
    </span>
  );
}
