import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * The rate used, and when it was taken.
 *
 * A RATE WITHOUT A TIMESTAMP IS UNCHECKABLE. Rates move all day; quoting one as
 * a bare number implies a precision and a permanence it does not have, and it is
 * the first thing queried when a figure looks wrong.
 *
 * IT SAYS WHETHER THE RATE IS FIXED OR INDICATIVE, which is the material
 * difference: a locked rate is a promise and a live one is an estimate, and
 * showing them identically is how a customer feels misled by a correct number.
 *
 * The rate is printed in full rather than rounded to two places, because a
 * two-decimal rate on a large amount is visibly not what was applied.
 */
export function ExchangeRateNote({ from, to, rate, at, locked, className }: {
  from: string; to: string;
  rate: number;
  at?: string | number | Date;
  /** True when this rate is held for the transaction. */
  locked?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      1 {from} = {rate} {to}
      {at && (
        <> · <DateFormat date={at} withTime /></>
      )}
      {" · "}
      <span className={locked ? "font-medium text-foreground" : undefined}>
        {locked ? "held for this payment" : "indicative — may change before you pay"}
      </span>
    </p>
  );
}
