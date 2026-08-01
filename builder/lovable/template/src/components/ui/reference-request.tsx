import { cn } from "@/lib/utils";
/**
 * A reference being sought — with the candidate's consent shown.
 *
 * CONSENT IS SHOWN PER REFEREE, NOT ONCE. The referee who must not be contacted
 * yet is almost always the current employer, and approaching them before an
 * offer is accepted can cost somebody their existing job. It is the single most
 * damaging thing a recruitment system does by accident.
 *
 * WHAT THE REFEREE WILL BE ASKED IS DISCLOSED to the candidate. Many
 * organisations only confirm dates and job title; others ask for opinions. The
 * difference matters to the person being discussed and is rarely stated.
 *
 * A CHASE COUNT IS SHOWN, because unreturned references are the most common
 * cause of a start date slipping, and the candidate can usually resolve it in
 * one phone call if anybody tells them.
 *
 * THE RELATIONSHIP IS RECORDED. A reference from a direct manager and one from
 * a colleague carry different weight, and a form that does not ask gets a
 * friend.
 */
export type Referee = {
  id: string;
  name: string;
  relationship?: string;
  organisation?: string;
  consentGiven?: boolean;
  contactAfterOffer?: boolean;
  requestedOn?: string;
  received?: boolean;
  chases?: number;
};

export function ReferenceRequest({ referees, asksFor, className }: {
  referees: Referee[];
  /** What the referee is actually asked — dates only, or an opinion. */
  asksFor?: string;
  className?: string;
}) {
  const blocked = referees.filter((r) => r.contactAfterOffer && !r.received);
  return (
    <div className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {referees.map((r) => (
          <li key={r.id} className="space-y-0.5 px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 flex-1">
                {r.name}
                {(r.relationship || r.organisation) && (
                  <span className="block text-xs text-muted-foreground">
                    {[r.relationship, r.organisation].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.received ? "Received" : r.requestedOn ? "Requested" : "Not requested"}
              </span>
            </p>
            {r.contactAfterOffer && !r.received && (
              <p className="text-xs font-medium">
                Do not contact until an offer is accepted — this is their current employer.
              </p>
            )}
            {r.consentGiven === false && (
              <p className="text-xs font-medium">No consent recorded for this referee.</p>
            )}
            {!r.received && r.chases !== undefined && r.chases > 0 && (
              <p className="text-xs tabular-nums text-muted-foreground">
                Chased {r.chases} {r.chases === 1 ? "time" : "times"} — tell the candidate; they can usually fix it in a call.
              </p>
            )}
          </li>
        ))}
      </ul>
      {asksFor && <p className="text-xs text-muted-foreground">Referees are asked for {asksFor}.</p>}
      {blocked.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {blocked.length} of {referees.length} cannot be approached yet.
        </p>
      )}
    </div>
  );
}
