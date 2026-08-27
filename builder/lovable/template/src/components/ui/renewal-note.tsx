import { cn } from "@/lib/utils";
/**
 * The outcome of trying to renew — the new date, or the real reason it failed.
 *
 * A REFUSAL NAMES THE CAUSE AND WHAT WOULD FIX IT. "Cannot renew" is where
 * people give up and keep the book; "another reader is waiting — bring it back
 * and we will reserve you the next copy" is an actual instruction.
 *
 * THE NEW DATE IS SHOWN AS A DATE, not as "extended by 3 weeks". The reader's
 * question is when they have to come in, and every relative phrasing makes them
 * compute it.
 *
 * A RENEWAL FROM THE DUE DATE RATHER THAN FROM TODAY IS SAID SO, because
 * renewing early then loses days, and readers who do not know that renew on day
 * one and are surprised.
 *
 * IT SAYS WHEN AN ACCOUNT BLOCK IS THE CAUSE. Blocks are usually clearable in
 * a minute, and presenting the failure as a property of the item sends somebody
 * away who could have fixed it at the desk.
 */
export type RenewalOutcome = "renewed" | "reserved-by-another" | "limit-reached" | "account-blocked" | "not-renewable";

export function RenewalNote({ title, outcome, newDueOn, renewalsLeft, fromDueDate, blockReason, className }: {
  title?: string;
  outcome: RenewalOutcome;
  /** Free text — "4 September". */
  newDueOn?: string;
  renewalsLeft?: number;
  /** True where the extension runs from the old due date, not today. */
  fromDueDate?: boolean;
  /** What is blocking the account. */
  blockReason?: string;
  className?: string;
}) {
  const ok = outcome === "renewed";
  return (
    <div data-slot="renewal-note" className={cn("space-y-0.5 text-sm", className)}>
      {title && <p className="text-xs text-muted-foreground">{title}</p>}
      <p className={cn(!ok && "font-medium")}>
        {ok
          ? newDueOn ? `Renewed — now due ${newDueOn}` : "Renewed"
          : outcome === "reserved-by-another"
            ? "Not renewed — another reader is waiting for it"
            : outcome === "limit-reached"
              ? "Not renewed — you have reached the renewal limit for this item"
              : outcome === "account-blocked"
                ? "Not renewed — there is something on your account"
                : "This item cannot be renewed"}
      </p>
      {ok && fromDueDate && (
        <p className="text-xs text-muted-foreground">
          Renewals run from the original due date, so renewing early does not add extra days.
        </p>
      )}
      {ok && renewalsLeft !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {renewalsLeft === 0 ? "That was your last renewal." : `${renewalsLeft} left after this.`}
        </p>
      )}
      {outcome === "reserved-by-another" && (
        <p className="text-xs">Bring it back and we will put you in the queue for the next copy.</p>
      )}
      {outcome === "account-blocked" && (
        <p className="text-xs">{blockReason ?? "Ask at the desk — most blocks clear in a minute."}</p>
      )}
    </div>
  );
}
