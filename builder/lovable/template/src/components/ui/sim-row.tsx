import { cn } from "@/lib/utils";
/**
 * A SIM on an account — physical or embedded, and who is using it.
 *
 * WHO USES IT IS THE FIELD THAT MAKES A MULTI-SIM ACCOUNT READABLE. A list of
 * numbers is unusable to the person paying for six of them; "Ravi's phone" is
 * how anybody actually refers to a line, and without it every management action
 * is performed against a number somebody has to look up first.
 *
 * A SPARE OR UNUSED SIM IS FLAGGED. Lines nobody is using are the commonest
 * quiet waste on a business account, and they are invisible in a list sorted by
 * number.
 *
 * AN EMBEDDED SIM SAYS SO AND SAYS WHAT THAT CHANGES. It cannot be moved by
 * swapping a card, which matters at exactly the moment somebody's phone dies and
 * they expect to put the card in another one.
 *
 * THE NUMBER IS SHOWN IN FULL, NEVER MASKED. Masking a number the account holder
 * owns protects nobody and makes the one identifying field unusable.
 */
export function SimRow({ number, usedBy, embedded, active, lastUsed, unusedDays, plan, className }: {
  number: string;
  /** How anybody actually refers to a line. */
  usedBy?: string;
  /** Cannot be moved between handsets by swapping a card. */
  embedded?: boolean;
  active?: boolean;
  lastUsed?: string;
  /** Quiet waste on a business account. */
  unusedDays?: number;
  plan?: string;
  className?: string;
}) {
  const idle = unusedDays !== undefined && unusedDays >= 30;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{usedBy ?? "Nobody assigned"}</span>
          <span className="block text-xs tabular-nums text-muted-foreground">{number}</span>
        </span>
        <span className={cn("shrink-0 text-xs", active === false ? "font-medium" : "text-muted-foreground")}>
          {active === false ? "Not active" : "Active"}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {[plan, embedded ? "Embedded SIM" : "Physical card", lastUsed && `last used ${lastUsed}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {/* "Still being paid for" is only true of a live line. Asserting it on a
          deactivated one is the component inventing a charge. */}
      {idle && (
        <p className="text-xs font-medium tabular-nums">
          Nothing on this line for {unusedDays} days
          {active === false ? ", and it is no longer active" : " — and it is still being paid for"}.
        </p>
      )}
      {embedded && (
        <p className="text-xs text-muted-foreground">
          There is no card to move. Putting this line in another handset means transferring it, not swapping a SIM.
        </p>
      )}
    </li>
  );
}
