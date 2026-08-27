import { cn } from "@/lib/utils";
/**
 * Money held against a hire — with when it comes back stated plainly.
 *
 * WHEN IT IS RELEASED AND HOW LONG THE BANK TAKES ARE TWO DIFFERENT ANSWERS AND
 * BOTH ARE SHOWN. "Released on return" is true and useless: the customer sees
 * nothing for several more working days, assumes it has not been done, and
 * telephones. Two sentences remove the call entirely.
 *
 * A HELD AMOUNT AND A TAKEN AMOUNT ARE NOT THE SAME THING. A pre-authorisation
 * reserves money without moving it; a charge moves it. Customers plan around
 * their balance and the distinction decides whether their rent clears.
 *
 * ANY DEDUCTION IS ITEMISED WITH A REASON. A deposit returned short by an
 * unexplained amount is the complaint that ends a customer relationship, and the
 * itemisation costs nothing at the moment it is decided.
 *
 * THE COMPONENT WILL NOT RENDER A DEDUCTION WITHOUT A REASON. It shows the
 * missing reason instead, because an unexplained deduction is the defect.
 */
export function DepositHold({ amount, taken, releasedOn, bankDays = "3–5 working days", deductions = [], currency = "GBP", locale = "en-GB", className }: {
  amount: number;
  /** True where the money moved rather than being reserved. */
  taken?: boolean;
  releasedOn?: string;
  bankDays?: string;
  deductions?: { id: string; what: string; amount: number; reason?: string }[];
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
  const deducted = deductions.reduce((n, d) => n + d.amount, 0);
  const back = amount - deducted;
  const unexplained = deductions.filter((d) => !d.reason);
  return (
    <div data-slot="deposit-hold" className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{money(amount)}</span>
        <span className="text-muted-foreground">
          {" "}
          {taken ? "taken from your account" : "reserved on your card, not taken"}
        </span>
      </p>
      {deductions.length > 0 && (
        <dl className="space-y-0.5 text-xs tabular-nums text-muted-foreground">
          {deductions.map((d) => (
            <div key={d.id} className="flex justify-between gap-4">
              <dt className={cn(!d.reason && "font-medium text-foreground")}>
                {d.what}
                {d.reason ? (
                  <span className="block text-muted-foreground">{d.reason}</span>
                ) : (
                  <span className="block">No reason recorded — this cannot be charged as it stands.</span>
                )}
              </dt>
              <dd>−{money(d.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="tabular-nums">
        <span className="font-medium">{money(back)} back to you</span>
        {releasedOn && <span className="text-muted-foreground"> · released {releasedOn}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {releasedOn
          ? `Released on our side ${releasedOn}. Your bank takes another ${bankDays} to show it, which is why it looks like nothing has happened.`
          : `Once released it takes your bank about ${bankDays} to show it.`}
      </p>
      {unexplained.length > 0 && (
        <p className="text-xs font-medium">
          {unexplained.length} {unexplained.length === 1 ? "deduction has" : "deductions have"} no reason against{" "}
          {unexplained.length === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}
