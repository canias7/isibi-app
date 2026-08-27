import { cn } from "@/lib/utils";
/**
 * Who is on it — with acknowledged and available kept apart.
 *
 * BEING PAGED IS NOT BEING AVAILABLE AND ACKNOWLEDGING IS NOT ARRIVING. Three
 * states, and every incident tool collapses them into a green dot. The gap
 * between "paged" and "acknowledged" is the one where nobody is coming, and it
 * is the only gap that matters in the first ten minutes.
 *
 * THE UNACKNOWLEDGED ARE NAMED AT THE TOP. A list where you have to scan for the
 * absence is a list nobody scans, and "6 of 8 responding" hides which two.
 *
 * SOMEBODY IS MARKED AS RUNNING IT. An incident with four responders and no
 * named lead is four people doing the same first thing, and the field is
 * routinely absent because everyone assumes it is obvious.
 *
 * TIME SINCE PAGED IS SHOWN PER PERSON, not as one incident clock. Somebody
 * paged eleven minutes ago and silent is a different problem from the incident
 * being eleven minutes old.
 */
export type Responder = {
  id: string;
  who: string;
  role?: string;
  state?: "paged" | "acknowledged" | "on scene" | "unavailable";
  minutesSincePaged?: number;
  lead?: boolean;
};

export function ResponderList({ responders, className }: { responders: Responder[]; className?: string }) {
  const silent = responders.filter((r) => (r.state ?? "paged") === "paged");
  const lead = responders.find((r) => r.lead);
  return (
    <div data-slot="responder-list" className={cn("space-y-1.5 text-sm", className)}>
      <p className={cn(silent.length > 0 ? "font-medium" : "text-muted-foreground")}>
        {silent.length === 0
          ? "Everybody paged has answered."
          : `No answer yet from ${silent.map((r) => r.who).join(", ")}.`}
      </p>
      <p className={cn("text-xs", lead ? "text-muted-foreground" : "font-medium")}>
        {lead ? `${lead.who} is running it.` : "Nobody is named as running this. Everybody will do the same first thing."}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {responders.map((r) => {
          const state = r.state ?? "paged";
          return (
            <li key={r.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {r.who}
                {r.role && <span className="text-xs text-muted-foreground"> · {r.role}</span>}
                {r.minutesSincePaged !== undefined && (
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    Paged {r.minutesSincePaged} {r.minutesSincePaged === 1 ? "minute" : "minutes"} ago
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  state === "paged" || state === "unavailable" ? "font-medium" : "text-muted-foreground",
                )}
              >
                {state === "paged"
                  ? "No answer"
                  : state === "acknowledged"
                    ? "Answered"
                    : state === "on scene"
                      ? "On scene"
                      : "Unavailable"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
