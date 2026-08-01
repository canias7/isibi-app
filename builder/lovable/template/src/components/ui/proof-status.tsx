import { cn } from "@/lib/utils";
/**
 * Where a proof has got to — with who has not signed it off.
 *
 * SIGN-OFF IS PER PERSON, NOT A SINGLE STATE. Editorial, legal and the client
 * each approve separately, any one of them can hold a page, and a single
 * "approved" flag hides which. The list of who has not is the actionable half.
 *
 * A CHANGE AFTER SIGN-OFF INVALIDATES IT, and the component says so. That is
 * the rule everybody agrees to and nobody follows, and it is how a corrected
 * page goes to press with an uncorrected legal problem on it.
 *
 * THE PROOF ROUND IS COUNTED. Round four means something is wrong with the
 * process rather than with the page, and it is the number that predicts a
 * missed press slot.
 *
 * COLOUR PROOFS AND CONTENT PROOFS ARE DIFFERENT THINGS. Approving text on a
 * screen is not approving how it prints, and conflating them means a client
 * signs off colour they have never seen.
 */
export type Approver = { id: string; who: string; role?: string; signedOff?: boolean; on?: string };

export function ProofStatus({ page, round, approvers, changedSinceSignOff, kind = "content", className }: {
  page?: string;
  /** Which round of proofs. */
  round?: number;
  approvers: Approver[];
  /** True where the page has been edited after somebody approved it. */
  changedSinceSignOff?: boolean;
  /** A content proof is not a colour proof. */
  kind?: "content" | "colour";
  className?: string;
}) {
  const outstanding = approvers.filter((a) => !a.signedOff);
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm">
        {page && <span className="font-medium">{page}</span>}
        {round !== undefined && (
          <span className={cn("tabular-nums", round >= 4 ? "font-medium" : "text-muted-foreground")}>
            {page ? " · " : ""}round {round}
          </span>
        )}
      </p>
      {round !== undefined && round >= 4 && (
        <p className="text-xs font-medium">
          Round {round}. At this point the problem is usually the process, not the page.
        </p>
      )}
      <p className={cn("text-sm", outstanding.length > 0 ? "font-medium" : "text-muted-foreground")}>
        {outstanding.length === 0
          ? "Everybody has signed off."
          : `Waiting on ${outstanding.map((a) => a.who).join(", ")}.`}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {approvers.map((a) => (
          <li key={a.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {a.who}
              {a.role && <span className="text-xs text-muted-foreground"> · {a.role}</span>}
            </span>
            <span className={cn("shrink-0 text-xs", a.signedOff ? "text-muted-foreground" : "font-medium")}>
              {a.signedOff ? (a.on ? `Signed ${a.on}` : "Signed") : "Not signed"}
            </span>
          </li>
        ))}
      </ul>
      {changedSinceSignOff && (
        <p className="text-xs font-medium">
          This page has changed since it was signed off. Those approvals no longer apply.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {kind === "colour"
          ? "A colour proof — this is how it will print."
          : "A content proof. Approving this is not approving how it prints."}
      </p>
    </div>
  );
}
