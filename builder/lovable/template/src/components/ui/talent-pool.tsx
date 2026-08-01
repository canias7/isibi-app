import { cn } from "@/lib/utils";
/**
 * Candidates kept on file — with the consent that makes that lawful.
 *
 * KEEPING SOMEBODY'S DATA REQUIRES THEIR AGREEMENT AND AN END DATE. A pool with
 * no expiry is a permanent file on people who applied once for something they
 * did not get, and the retention date is the field that makes it a pool rather
 * than a hoard.
 *
 * EXPIRING ENTRIES ARE SURFACED, because the useful moment is before consent
 * lapses — that is when somebody can be asked whether they want to stay, which
 * is both lawful and a better contact than a cold one.
 *
 * WHY EACH PERSON IS HERE IS RECORDED. "Strong second choice for the Tuesday
 * role" is worth keeping; an unlabelled pool is a list nobody ever searches
 * because nobody trusts what is in it.
 *
 * REMOVING SOMEBODY IS ONE ACTION, always available. A pool people cannot leave
 * is the thing that makes candidates stop applying anywhere.
 */
export type PoolEntry = {
  id: string;
  name: string;
  reason?: string;
  addedOn?: string;
  consentUntil?: string;
  daysLeft?: number;
  consented?: boolean;
};

export function TalentPool({ entries, onRemove, className }: {
  entries: PoolEntry[];
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const expiring = entries.filter((e) => e.daysLeft !== undefined && e.daysLeft <= 30);
  const unconsented = entries.filter((e) => e.consented === false);
  return (
    <div className={cn("space-y-1.5", className)}>
      {unconsented.length > 0 && (
        <p className="text-sm font-medium">
          {unconsented.length} {unconsented.length === 1 ? "person is" : "people are"} held without recorded consent — remove them.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {entries.map((e) => (
          <li key={e.id} className="space-y-0.5 px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 flex-1">{e.name}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  className="shrink-0 text-xs underline underline-offset-2"
                >
                  Remove<span className="sr-only"> {e.name}</span>
                </button>
              )}
            </p>
            {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
            <p className={cn("text-xs", e.consented === false ? "font-medium" : "text-muted-foreground")}>
              {e.consented === false
                ? "No consent recorded"
                : e.consentUntil
                  ? `Agreed to be kept until ${e.consentUntil}`
                  : "No end date recorded — that is not a pool, it is a file"}
              {e.addedOn && ` · added ${e.addedOn}`}
            </p>
          </li>
        ))}
      </ul>
      {expiring.length > 0 && (
        <p className="text-xs">
          {expiring.length} {expiring.length === 1 ? "entry expires" : "entries expire"} within a month — ask them now, while you still may.
        </p>
      )}
    </div>
  );
}
