import { cn } from "@/lib/utils";
/**
 * One dependency's health, with what breaks when it is down.
 *
 * THE CONSEQUENCE IS THE COLUMN THAT MATTERS. "Mail service: degraded" tells an
 * operator nothing about urgency; "reminders are not going out" tells them
 * whether to wake somebody. Every status board omits it and every incident
 * begins by working it out.
 *
 * DEGRADED IS DISTINCT FROM DOWN, because they need different responses — a
 * slow dependency is often survivable and a dead one is not, and collapsing
 * them makes every wobble look like an outage.
 *
 * OPTIONAL DEPENDENCIES ARE MARKED. Half the things on a health board are not
 * on the critical path, and an operator paging on a failed analytics collector
 * at 3am has been misled by the layout.
 *
 * THE CHECK'S OWN AGE IS SHOWN. A green row from a check that last ran forty
 * minutes ago is not evidence of anything now, and a stalled checker is the
 * quietest failure on any status page.
 */
export function HealthCheckRow({ name, state, breaks, optional, checkedAt, detail, className }: {
  name: string;
  state: "ok" | "degraded" | "down" | "unknown";
  /** What stops working — "reminders are not going out". */
  breaks?: string;
  optional?: boolean;
  /** Free text — "20 seconds ago". */
  checkedAt?: string;
  detail?: string;
  className?: string;
}) {
  const WORD = { ok: "Working", degraded: "Slow", down: "Down", unknown: "No answer" } as const;
  const bad = state === "down" || state === "degraded" || state === "unknown";
  return (
    <li data-slot="health-check-row" className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className={cn("block", bad && !optional && "font-medium")}>
          {name}
          {optional && <span className="ms-1.5 text-xs font-normal text-muted-foreground">not critical</span>}
        </span>
        <span className="block text-xs text-muted-foreground">
          {bad && breaks ? breaks : detail}
          {checkedAt && <span>{(bad && breaks) || detail ? " · " : ""}checked {checkedAt}</span>}
        </span>
      </span>
      <span className={cn("shrink-0 text-xs", bad && !optional ? "font-medium" : "text-muted-foreground")}>
        {WORD[state]}
      </span>
    </li>
  );
}
