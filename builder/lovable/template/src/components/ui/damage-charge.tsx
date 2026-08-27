import { cn } from "@/lib/utils";
/**
 * A charge for damage — with the evidence and the challenge route attached.
 *
 * FAIR WEAR AND TEAR IS A NAMED CATEGORY AND IS NOT CHARGED. Every hire
 * agreement says so and almost no damage form has a box for it, which is how a
 * worn tyre and a cracked casing end up on the same invoice. Marking it is what
 * makes the rest of the charge credible.
 *
 * REPAIR OR REPLACE IS STATED, WITH THE FIGURE THAT FOLLOWS FROM IT. Charging a
 * replacement price for a repairable part is the commonest dispute in hire, and
 * saying which this is turns an argument into a question.
 *
 * IT REFERS BACK TO THE COLLECTION CHECK. A charge that cannot point at the
 * check saying the mark was not there when it went out is a charge that should
 * not be made, and the component says so rather than rendering it quietly.
 *
 * HOW TO CHALLENGE IT IS ON THE SAME SCREEN. A disputes process that has to be
 * searched for is a disputes process designed not to be used.
 */
export function DamageCharge({ what, amount, kind = "repair", fairWearAndTear, notedAtCollection, challengeWith, challengeWithin, currency = "GBP", locale = "en-GB", className }: {
  what: string;
  amount: number;
  kind?: "repair" | "replace" | "clean";
  /** Named, and not charged. */
  fairWearAndTear?: boolean;
  /** Whether the collection check recorded it as already there. */
  notedAtCollection?: boolean;
  challengeWith?: string;
  challengeWithin?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  if (fairWearAndTear) {
    return (
      <li data-slot="damage-charge" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
        <p>
          <span className="font-medium">{what}</span>
          <span className="text-muted-foreground"> · fair wear and tear</span>
        </p>
        <p className="text-xs text-muted-foreground">Not charged. This is what using it looks like.</p>
      </li>
    );
  }
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{what}</span>
        <span className="shrink-0 tabular-nums">{money(amount)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {kind === "replace"
          ? "Charged as a replacement, not a repair."
          : kind === "clean"
            ? "Charged as cleaning."
            : "Charged as a repair."}
      </p>
      {notedAtCollection ? (
        <p className="text-xs font-medium">
          This mark was already on the collection check. It should not be charged.
        </p>
      ) : notedAtCollection === false ? (
        <p className="text-xs text-muted-foreground">Not on the collection check, so it happened during the hire.</p>
      ) : (
        <p className="text-xs font-medium">
          No collection check to compare against. A charge that cannot point at one is hard to stand behind.
        </p>
      )}
      {challengeWith && (
        <p className="text-xs text-muted-foreground">
          Disagree? {challengeWith}
          {challengeWithin ? `, within ${challengeWithin}` : ""}.
        </p>
      )}
    </li>
  );
}
