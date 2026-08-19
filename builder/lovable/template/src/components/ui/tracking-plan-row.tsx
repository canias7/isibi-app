import { cn } from "@/lib/utils";
/**
 * One event in a tracking plan — and whether it is actually arriving.
 *
 * PLANNED VERSUS SEEN IS THE ENTIRE VALUE. A tracking plan is a document that
 * agrees with reality on the day it is written and drifts thereafter: events
 * get removed in a refactor, or fire from somewhere nobody expected. Comparing
 * the two turns the plan from a wish into a check.
 *
 * "PLANNED BUT NEVER SEEN" IS THE IMPORTANT ROW. It means the instrumentation
 * was never added or has been removed, and every dashboard built on that event
 * is quietly empty — which reads as "nobody does this" rather than "we are not
 * measuring it".
 *
 * "SEEN BUT NOT PLANNED" MATTERS TOO. An undocumented event is one nobody owns,
 * frequently with a name that duplicates a planned one, and it is how a
 * tracking plan stops being trusted.
 *
 * THE OWNER IS NAMED, because an event with no owner is one nobody fixes when
 * it breaks — and analytics breakage is always somebody else's job.
 */
export function TrackingPlanRow({ name, purpose, owner, state, lastSeen, volume, className }: {
  name: string;
  /** What question it answers. */
  purpose?: string;
  owner?: string;
  state: "healthy" | "missing" | "undocumented" | "retired";
  /** Free text — "2 minutes ago", or absent if never. */
  lastSeen?: string;
  /** Events in the recent window. */
  volume?: number;
  className?: string;
}) {
  const WORD = {
    healthy: "Arriving",
    missing: "Never seen",
    undocumented: "Not in the plan",
    retired: "Retired",
  } as const;
  const bad = state === "missing" || state === "undocumented";
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <code className={cn("font-mono text-xs", state === "retired" && "text-muted-foreground")}>{name}</code>
        {purpose && <span className="block text-xs">{purpose}</span>}
        <span className="block text-xs text-muted-foreground">
          {owner ? `Owned by ${owner}` : "Nobody owns this"}
          {lastSeen && ` · last seen ${lastSeen}`}
          {state === "missing" && " · anything built on it is empty"}
        </span>
      </span>
      <span className="shrink-0 text-end text-xs">
        <span className={cn("block", bad ? "font-medium" : "text-muted-foreground")}>{WORD[state]}</span>
        {volume !== undefined && <span className="block tabular-nums text-muted-foreground">{volume.toLocaleString()}</span>}
      </span>
    </li>
  );
}
