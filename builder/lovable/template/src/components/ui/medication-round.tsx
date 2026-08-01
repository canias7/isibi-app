import { cn } from "@/lib/utils";
/**
 * Medicines given on a round — with the three outcomes kept apart.
 *
 * GIVEN, REFUSED AND OMITTED ARE THREE DIFFERENT THINGS AND MOST CHARTS HAVE
 * ONE BLANK BOX FOR ALL OF THEM. A refusal is the person exercising a choice; an
 * omission is the medicine not being there, or nobody getting to it. A blank is
 * a chart that cannot be relied on and a question nobody can answer a week later.
 *
 * A REFUSAL IS NOT AN ERROR. It is recorded neutrally and is not counted in the
 * problem tally — the pattern of refusals is clinically interesting and treating
 * each as a failure is how staff stop recording them honestly.
 *
 * "AS REQUIRED" MEDICINES ARE SEPARATED FROM SCHEDULED ONES. A round that is
 * complete when every scheduled dose is done is complete; counting the ones that
 * are only given when needed makes every round look unfinished.
 *
 * THE PERSON WHO GAVE IT IS NAMED PER MEDICINE, not per round. A round signed
 * once at the end is a signature covering things somebody else did.
 */
export type RoundEntry = {
  id: string;
  medicine: string;
  dose?: string;
  /** As-required medicines are not part of "is the round finished". */
  asRequired?: boolean;
  outcome?: "given" | "refused" | "omitted";
  /** Required for a refusal or an omission to mean anything. */
  reason?: string;
  by?: string;
};

export function MedicationRound({ entries, round, className }: {
  entries: RoundEntry[];
  /** "Morning", "18:00". */
  round?: string;
  className?: string;
}) {
  const scheduled = entries.filter((e) => !e.asRequired);
  const outstanding = scheduled.filter((e) => !e.outcome);
  // A refusal is a choice, not a failure, and is deliberately not counted here.
  const omitted = entries.filter((e) => e.outcome === "omitted");
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className={cn("text-sm", outstanding.length > 0 ? "font-medium" : "text-muted-foreground")}>
        {round && <span>{round} · </span>}
        {outstanding.length === 0
          ? "Round finished."
          : `${outstanding.length} scheduled ${outstanding.length === 1 ? "medicine" : "medicines"} still to do.`}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {entries.map((e) => (
          <li key={e.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1">
                {e.medicine}
                {e.dose && <span className="text-muted-foreground"> · {e.dose}</span>}
                {e.asRequired && <span className="text-xs text-muted-foreground"> · only when needed</span>}
              </span>
              {/* An as-required medicine with no outcome is the normal state, not a
                  gap — shouting about it makes a finished round look unfinished on
                  every row that was never due. */}
              <span
                className={cn(
                  "shrink-0 text-xs",
                  e.outcome === "omitted" || (!e.outcome && !e.asRequired)
                    ? "font-medium"
                    : "text-muted-foreground",
                )}
              >
                {e.outcome === "given"
                  ? "Given"
                  : e.outcome === "refused"
                    ? "Refused"
                    : e.outcome === "omitted"
                      ? "Not given"
                      : e.asRequired
                        ? "Not needed"
                        : "Nothing recorded"}
              </span>
            </p>
            {e.outcome && e.outcome !== "given" && (
              <p className="text-xs text-muted-foreground">
                {e.reason ?? (e.outcome === "refused" ? "No reason recorded." : "No reason recorded — this one needs one.")}
              </p>
            )}
            {e.by && <p className="text-xs text-muted-foreground">{e.by}</p>}
          </li>
        ))}
      </ul>
      {omitted.length > 0 && (
        <p className="text-xs font-medium">
          {omitted.length} {omitted.length === 1 ? "medicine was" : "medicines were"} not given at all. A refusal is a
          choice; this is not.
        </p>
      )}
    </div>
  );
}
