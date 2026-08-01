import { cn } from "@/lib/utils";
/**
 * Somebody coming to look at the damage — and what to have ready.
 *
 * WHO THE ASSESSOR WORKS FOR IS STATED PLAINLY. A loss adjuster is instructed
 * by the insurer, however friendly the visit; a claimant who believes they are
 * neutral answers differently, and that asymmetry is exactly what a fair
 * process should disclose rather than exploit.
 *
 * WHAT TO HAVE READY IS LISTED BEFORE THE DATE. A visit that ends with "send me
 * the receipts" is a wasted week, and the list is known in advance every time.
 *
 * NOT CLEARING UP IS SAID EXPLICITLY, because the instinct is to tidy, tidying
 * destroys the evidence the claim rests on, and nobody thinks to say so.
 *
 * THE RIGHT TO HAVE SOMEBODY PRESENT IS MENTIONED. A claimant may bring their
 * own builder or a friend, and the visits where that would have helped most are
 * the ones where it did not occur to anybody.
 */
export function AssessorVisit({ name, company, actingFor = "the insurer", when, expectedMinutes, haveReady = [], canBringSomeone = true, doNotClear = true, className }: {
  name?: string;
  company?: string;
  /** Who instructed them. */
  actingFor?: string;
  /** Free text — "Tuesday 12 August, between 10:00 and 12:00". */
  when?: string;
  expectedMinutes?: number;
  haveReady?: string[];
  canBringSomeone?: boolean;
  doNotClear?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{name ?? "An assessor"}{company ? `, ${company}` : ""}</span>
        {when && <span className="block">{when}</span>}
        {expectedMinutes !== undefined && (
          <span className="block text-xs tabular-nums text-muted-foreground">About {expectedMinutes} minutes</span>
        )}
      </p>
      <p className="text-xs">
        They are instructed by {actingFor} and paid by {actingFor} — they are not independent of us, and you should know that going in.
      </p>
      {doNotClear && (
        <p className="text-xs font-medium">
          Do not clear up or throw anything away before the visit, however tempting.
        </p>
      )}
      {haveReady.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Have ready</p>
          <ul className="text-xs">
            {haveReady.map((h, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-muted-foreground">—</span><span>{h}</span></li>
            ))}
          </ul>
        </div>
      )}
      {canBringSomeone && (
        <p className="text-xs text-muted-foreground">
          You may have somebody with you — a builder, a friend, anyone you like.
        </p>
      )}
    </div>
  );
}
