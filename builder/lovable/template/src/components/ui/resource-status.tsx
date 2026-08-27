import { cn } from "@/lib/utils";
/**
 * What is available to send — and how long until it is there.
 *
 * AVAILABLE AND AVAILABLE-NEARBY ARE DIFFERENT ANSWERS. Six vehicles free forty
 * minutes away is not the same as one free round the corner, and a count with no
 * travel time attached gets committed against and then discovered.
 *
 * COMMITTED RESOURCE STAYS VISIBLE WITH WHAT IT IS ON. Knowing that the nearest
 * unit is on something smaller is what lets somebody make the decision to move
 * it, and a list showing only what is free hides the option entirely.
 *
 * THE RESOURCE THAT IS ALMOST FREE IS SHOWN. Something clearing in five minutes
 * is frequently the right answer and is invisible on a binary free-or-not
 * display.
 *
 * NO MAP. A map needs a tile provider and a key, redraws under a poor
 * connection, and the answer here is a travel time and a name — both of which
 * read aloud correctly down a radio.
 */
export type Resource = {
  id: string;
  what: string;
  state?: "free" | "committed" | "clearing" | "out of service";
  /** How long until it is where it is needed. */
  minutesAway?: number;
  onWhat?: string;
  clearingInMinutes?: number;
};

export function ResourceStatus({ resources, className }: { resources: Resource[]; className?: string }) {
  const free = resources.filter((r) => (r.state ?? "free") === "free");
  const nearest = [...free].sort((a, b) => (a.minutesAway ?? 999) - (b.minutesAway ?? 999))[0];
  const clearing = resources.filter((r) => r.state === "clearing");
  return (
    <div data-slot="resource-status" className={cn("space-y-1.5 text-sm", className)}>
      <p className={cn(free.length === 0 ? "font-medium" : "")}>
        {free.length === 0
          ? "Nothing free."
          : nearest?.minutesAway !== undefined
            ? `${free.length} free — nearest is ${nearest.what}, ${nearest.minutesAway} minutes away.`
            : `${free.length} free.`}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {resources.map((r) => {
          const state = r.state ?? "free";
          return (
            <li key={r.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {r.what}
                <span className="block text-xs text-muted-foreground">
                  {[
                    r.minutesAway !== undefined && `${r.minutesAway} min away`,
                    r.onWhat && `on ${r.onWhat}`,
                    r.clearingInMinutes !== undefined && `clear in about ${r.clearingInMinutes} min`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs", state === "free" ? "font-medium" : "text-muted-foreground")}>
                {state === "free"
                  ? "Free"
                  : state === "committed"
                    ? "Committed"
                    : state === "clearing"
                      ? "Clearing"
                      : "Out of service"}
              </span>
            </li>
          );
        })}
      </ul>
      {clearing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {clearing.length} {clearing.length === 1 ? "resource is" : "resources are"} nearly free. Often the right
          answer, and invisible on a free-or-not list.
        </p>
      )}
    </div>
  );
}
