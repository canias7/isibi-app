import { cn } from "@/lib/utils";
/**
 * Meeting-room credits — with expiry made impossible to miss.
 *
 * EXPIRING CREDITS ARE THE HEADLINE, NOT A FOOTNOTE. Credits that lapse
 * unnoticed at the end of a month are the whole reason members resent this kind
 * of allowance, and every layout that leads with the balance buries the only
 * time-sensitive fact on the screen.
 *
 * WHETHER THEY ROLL OVER IS STATED EXPLICITLY, because members assume they do
 * and they usually do not. One sentence removes an entire category of complaint.
 *
 * WHAT A CREDIT BUYS IS SHOWN. A balance of 8 means nothing without knowing
 * whether the room somebody wants costs 1 or 4, and that conversion is normally
 * on a different page from the balance.
 *
 * NO AUTOMATIC TOP-UP. Buying more credits is a deliberate act, and an allowance
 * that silently bills for extra is the pattern this component refuses.
 */
export function BookingCredits({ balance, expiring, expiresOn, rollsOver, unit = "credit", rates = [], className }: {
  balance: number;
  /** How many go at the end of the period. */
  expiring?: number;
  expiresOn?: string;
  rollsOver?: boolean;
  unit?: string;
  /** What a credit actually buys. */
  rates?: { id: string; what: string; costs: number }[];
  className?: string;
}) {
  const plural = (n: number) => `${n} ${n === 1 ? unit : `${unit}s`}`;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {expiring !== undefined && expiring > 0 && (
        <p className="font-medium">
          {plural(expiring)} {expiring === 1 ? "goes" : "go"}
          {expiresOn ? ` on ${expiresOn}` : " at the end of this period"}. Use them or lose them.
        </p>
      )}
      <p className="tabular-nums">
        <span className="text-lg font-medium">{plural(balance)}</span>
        <span className="text-muted-foreground"> left</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {rollsOver
          ? "Unused credits carry over to the next period."
          : "Unused credits do not carry over. Most people assume they do."}
      </p>
      {rates.length > 0 && (
        <dl className="space-y-0.5 text-xs tabular-nums text-muted-foreground">
          {rates.map((r) => (
            <div key={r.id} className="flex justify-between gap-4">
              <dt>{r.what}</dt>
              <dd>{plural(r.costs)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
