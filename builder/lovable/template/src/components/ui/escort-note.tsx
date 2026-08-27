import { cn } from "@/lib/utils";
/**
 * Somebody who may only be in a building accompanied.
 *
 * THE ESCORT IS A NAMED PERSON WHO IS PRESENT, not a role. "Escorted by
 * facilities" means escorted by nobody: when it matters, the question is which
 * individual was with them, and a role cannot answer it.
 *
 * AN ESCORT WHO HAS SIGNED OUT LEAVES AN UNESCORTED VISITOR IN THE BUILDING,
 * which is the failure this exists to catch. It is invisible in a system that
 * treats the two records separately, and it happens at the end of every day.
 *
 * A HANDOVER IS A RECORDED EVENT. Escorts change over lunch and at shift end,
 * and an unrecorded handover produces a period nobody is accountable for —
 * exactly the period anybody investigating will ask about.
 *
 * THE AREAS ARE LISTED because escorting is usually specific to a zone, and an
 * escort walking a contractor into a server room they are not cleared for is a
 * breach committed with the best of intentions.
 */
export function EscortNote({ visitor, escort, escortPresent = true, since, areas = [], handovers = [], className }: {
  visitor: string;
  /** A named individual, never a team. */
  escort?: string;
  /** False once the escort has signed out. */
  escortPresent?: boolean;
  /** Free text — "10:15". */
  since?: string;
  /** Where they may go, accompanied. */
  areas?: string[];
  /** Previous escorts, in order. */
  handovers?: { at: string; from: string; to: string }[];
  className?: string;
}) {
  const stranded = !escort || !escortPresent;
  return (
    <div data-slot="escort-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{visitor}</span>
        <span className="text-muted-foreground"> · must be accompanied</span>
      </p>
      <p className={cn("text-xs", stranded ? "font-medium" : "text-muted-foreground")}>
        {!escort
          ? "No escort named — this visitor is in the building unaccompanied."
          : !escortPresent
            ? `${escort} has signed out. This visitor is now unaccompanied.`
            : `With ${escort}${since ? ` since ${since}` : ""}.`}
      </p>
      {areas.length > 0 && (
        <p className="text-xs text-muted-foreground">Cleared for {areas.join(", ")} — accompanied only.</p>
      )}
      {handovers.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {handovers.map((h, i) => (
            <li key={i} className="tabular-nums">{h.at} — handed from {h.from} to {h.to}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
