import { cn } from "@/lib/utils";
/**
 * A card issued to somebody — and whether it should still work.
 *
 * A CARD BELONGING TO A LEAVER IS THE HEADLINE FAILURE. Access lists outlive
 * employment by months because deactivation depends on somebody remembering,
 * and a card that still opens doors for a person who left in March is the
 * finding in every access audit ever conducted.
 *
 * LAST USED IS SHOWN because a card unused for six months is either lost or
 * belongs to somebody who has gone, and both are worth revoking before anybody
 * else finds it.
 *
 * THE CARD NUMBER IS NOT THE PERSON. Cards get reissued and reassigned, so the
 * pairing is a fact with a date on it rather than an identity, and history
 * belongs to the card.
 *
 * REVOKING IS ONE ACTION AND IS ALWAYS PRESENT. A control buried two screens
 * deep is a control not used at the moment it matters, which is the phone call
 * saying a card has been lost.
 */
export function BadgeRow({ badge, holder, issuedOn, lastUsed, lastUsedDaysAgo, active = true, holderLeft, onRevoke, className }: {
  badge: string;
  holder?: string;
  /** Free text — "14 March 2026". */
  issuedOn?: string;
  lastUsed?: string;
  lastUsedDaysAgo?: number;
  active?: boolean;
  /** True where the holder no longer works here. */
  holderLeft?: boolean;
  onRevoke?: () => void;
  className?: string;
}) {
  const dangerous = active && holderLeft;
  const dormant = active && (lastUsedDaysAgo ?? 0) >= 90;
  return (
    <li data-slot="badge-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {holder ?? "Not assigned"}
          <span className="block font-mono text-xs text-muted-foreground">{badge}</span>
        </span>
        <span className={cn("shrink-0 text-xs", active ? "text-muted-foreground" : "")}>
          {active ? "Active" : "Revoked"}
        </span>
        {onRevoke && active && (
          <button type="button" onClick={onRevoke} className="shrink-0 text-xs underline underline-offset-2">
            Revoke<span className="sr-only"> card {badge}</span>
          </button>
        )}
      </p>
      {/* Joined, not interleaved: the separator was conditional on `lastUsed`
          while its fallback always renders, so an issued card never used read
          as "Issued 14 Marchnever used". */}
      <p className="text-xs tabular-nums text-muted-foreground">
        {[
          issuedOn ? `Issued ${issuedOn}` : null,
          lastUsed ? `last used ${lastUsed}` : "never used",
        ].filter(Boolean).join(" · ")}
      </p>
      {dangerous && (
        <p className="text-xs font-medium">
          This person has left and the card still works. Revoke it now.
        </p>
      )}
      {!dangerous && dormant && (
        <p className="text-xs font-medium tabular-nums">
          Not used for {lastUsedDaysAgo} days — either lost, or belongs to somebody who has gone.
        </p>
      )}
    </li>
  );
}
