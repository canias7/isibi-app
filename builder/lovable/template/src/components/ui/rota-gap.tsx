import { cn } from "@/lib/utils";
/**
 * The unfilled shifts — ordered by how soon they bite.
 *
 * SOONEST FIRST, ALWAYS. A rota gap list sorted by anything else buries
 * tomorrow's uncovered shift beneath one in six weeks, and the whole purpose is
 * to answer "what do I have to solve today".
 *
 * A SHIFT THAT CANNOT RUN IS SEPARATED FROM ONE THAT IS MERELY SHORT. Some
 * roles have a minimum — two people for a lone-working policy, one first-aider
 * — and below it the session is cancelled rather than uncomfortable. That is a
 * different decision and a different phone call.
 *
 * IT SAYS WHO HAS ALREADY BEEN ASKED. Repeat asks to the same willing people
 * are how volunteers burn out, and an organiser under pressure reaches for the
 * same names every time without noticing.
 *
 * THE COUNT IS THE HEADLINE, because "eleven gaps this week" is what gets
 * somebody to send the message at all.
 */
export type Gap = {
  id: string;
  role: string;
  /** Free text — "tomorrow, 09:00". */
  when: string;
  daysAway?: number;
  filled?: number;
  needed?: number;
  /** Below this the session cannot run. */
  minimum?: number;
  alreadyAsked?: string[];
};

export function RotaGap({ gaps, className }: { gaps: Gap[]; className?: string }) {
  // Soonest first: any other order buries tomorrow's uncovered shift.
  const ordered = [...gaps].sort((a, b) => (a.daysAway ?? 9999) - (b.daysAway ?? 9999));
  const cannotRun = ordered.filter((g) => g.minimum !== undefined && (g.filled ?? 0) < g.minimum);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium">{gaps.length} {gaps.length === 1 ? "gap" : "gaps"}</span>
        {cannotRun.length > 0 && (
          <span className="font-medium">
            {" "}· {cannotRun.length} {cannotRun.length === 1 ? "session cannot" : "sessions cannot"} run as things stand
          </span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {ordered.map((g) => {
          const below = g.minimum !== undefined && (g.filled ?? 0) < g.minimum;
          return (
            <li key={g.id} className="space-y-0.5 px-3 py-1.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="min-w-0 flex-1">
                  {g.role}
                  <span className="block text-xs text-muted-foreground">{g.when}</span>
                </span>
                {g.needed !== undefined && (
                  <span className={cn("shrink-0 text-xs tabular-nums", below && "font-medium")}>
                    {g.filled ?? 0} of {g.needed}
                  </span>
                )}
              </p>
              {below && g.minimum !== undefined && (
                <p className="text-xs font-medium tabular-nums">
                  Needs at least {g.minimum} — below that this does not run at all.
                </p>
              )}
              {g.alreadyAsked && g.alreadyAsked.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Already asked: {g.alreadyAsked.join(", ")}. Try somebody else before asking again.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
