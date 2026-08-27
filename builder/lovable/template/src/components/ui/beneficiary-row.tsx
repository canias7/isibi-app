import { cn } from "@/lib/utils";
/**
 * Who receives a payout — with the share, and whether the shares add up.
 *
 * SHARES ARE CHECKED AGAINST 100% AND THE FAILURE IS SHOWN. A nomination
 * totalling 90% is discovered at the worst possible moment by people who have
 * just been bereaved, and it is a one-line check that no form seems to make.
 *
 * A DATE OF BIRTH OR A RELATIONSHIP IS NOT AN IDENTIFIER. Beneficiaries are
 * routinely untraceable because a nomination says "my son"; enough to find
 * somebody is the difference between a payment and years in limbo.
 *
 * WHETHER THE NOMINATION IS BINDING IS SHOWN. Some are directions the insurer
 * must follow; some are wishes a trustee may depart from. They look identical on
 * a form and produce entirely different outcomes.
 *
 * WHEN IT WAS LAST REVIEWED IS SHOWN, because the commonest problem is not an
 * error — it is a nomination made before a divorce, a birth or a death, still
 * quietly in force twenty years later.
 */
export type Beneficiary = {
  id: string;
  name: string;
  relationship?: string;
  /** 0–100. */
  sharePercent: number;
  /** Enough to actually find them. */
  contact?: string;
  dateOfBirth?: string;
};

export function BeneficiaryRow({ beneficiaries, binding, lastReviewed, className }: {
  beneficiaries: Beneficiary[];
  /** True where the insurer must follow it. */
  binding?: boolean;
  /** Free text — "14 March 2011". */
  lastReviewed?: string;
  className?: string;
}) {
  const total = beneficiaries.reduce((n, b) => n + b.sharePercent, 0);
  const off = Math.abs(total - 100) > 0.01;
  const untraceable = beneficiaries.filter((b) => !b.contact && !b.dateOfBirth);
  return (
    <div data-slot="beneficiary-row" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {beneficiaries.map((b) => (
          <li key={b.id} className="flex items-baseline gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              {b.name}
              {(b.relationship || b.contact || b.dateOfBirth) && (
                <span className="block text-xs text-muted-foreground">
                  {[b.relationship, b.dateOfBirth, b.contact].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums">{b.sharePercent}%</span>
          </li>
        ))}
      </ul>
      <p className={cn("text-xs tabular-nums", off ? "font-medium" : "text-muted-foreground")}>
        {off
          ? `These add up to ${total}%, not 100% — that has to be corrected now, not by whoever is left.`
          : "Adds up to 100%."}
      </p>
      {untraceable.length > 0 && (
        <p className="text-xs font-medium">
          {untraceable.length} {untraceable.length === 1 ? "person has" : "people have"} nothing recorded that would let us find them.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {binding
          ? "This is binding — we must pay as written."
          : "This is a wish, not a direction — the trustees may depart from it."}
        {lastReviewed && ` Last reviewed ${lastReviewed}.`}
      </p>
    </div>
  );
}
