import { cn } from "@/lib/utils";
/**
 * A change going out across sites — with the ones it has not reached.
 *
 * THE LAGGARDS ARE THE CONTENT. "38 of 42 sites live" is a comfortable
 * headline; the four are the work, and a progress bar makes them a rounding
 * error. Naming them is the whole reason anybody opens this.
 *
 * BLOCKED IS DIFFERENT FROM NOT-STARTED. A site waiting on hardware, a lease
 * negotiation or a franchisee's refusal is not a site that has been slow, and
 * chasing them the same way wastes everybody's time.
 *
 * A SITE THAT ADOPTED AND REVERTED IS ITS OWN STATE. It is the most
 * informative outcome in any rollout and the one no dashboard tracks — a
 * revert means something about the change, not about the site.
 *
 * NO PERCENTAGE AS THE HEADLINE. 90% complete on a rollout that has been stuck
 * at 90% for two months is a number that stops anybody asking why.
 */
export type RolloutSite = {
  id: string;
  site: string;
  state: "live" | "in-progress" | "blocked" | "not-started" | "reverted";
  note?: string;
  since?: string;
};

const WORDS: Record<RolloutSite["state"], string> = {
  live: "Live",
  "in-progress": "In progress",
  blocked: "Blocked",
  "not-started": "Not started",
  reverted: "Went back",
};

export function RolloutStatus({ change, sites, className }: {
  change?: string;
  sites: RolloutSite[];
  className?: string;
}) {
  const live = sites.filter((s) => s.state === "live");
  const outstanding = sites.filter((s) => s.state !== "live");
  const reverted = sites.filter((s) => s.state === "reverted");
  const blocked = sites.filter((s) => s.state === "blocked");
  return (
    <div data-slot="rollout-status" className={cn("space-y-1.5", className)}>
      {change && <p className="text-sm">{change}</p>}
      <p className="text-sm tabular-nums">
        <span className="text-muted-foreground">{live.length} of {sites.length} live · </span>
        <span className="font-medium">{outstanding.length} to go</span>
      </p>
      {outstanding.length === 0 ? (
        <p className="text-xs text-muted-foreground">Everywhere, with nothing reverted.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {outstanding.map((s) => (
            <li key={s.id} className="space-y-0.5 px-3 py-1.5">
              <p className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1">{s.site}</span>
                <span className={cn("shrink-0 text-xs", s.state === "in-progress" ? "text-muted-foreground" : "font-medium")}>
                  {WORDS[s.state]}
                </span>
              </p>
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              {s.since && <p className="text-xs text-muted-foreground">Since {s.since}.</p>}
            </li>
          ))}
        </ul>
      )}
      {blocked.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Blocked sites are waiting on something, not being slow. Chasing them does nothing.
        </p>
      )}
      {reverted.length > 0 && (
        <p className="text-xs font-medium">
          {reverted.length} {reverted.length === 1 ? "site went" : "sites went"} back. That says something about the change, not about them.
        </p>
      )}
    </div>
  );
}
