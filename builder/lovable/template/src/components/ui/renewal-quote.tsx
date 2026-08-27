import { cn } from "@/lib/utils";
/**
 * The renewal price — shown against what was paid last year.
 *
 * LAST YEAR'S PREMIUM IS PRINTED BESIDE THIS YEAR'S. It is required in some
 * markets precisely because renewal pricing relies on people not comparing, and
 * a renewal notice without it is the single clearest example of a design that
 * profits from inattention.
 *
 * THE INCREASE IS STATED IN BOTH MONEY AND PERCENTAGE. A 9% rise sounds
 * ordinary and £74 does not, and which one lands depends entirely on the
 * reader.
 *
 * WHAT CHANGED IS EXPLAINED WHERE IT IS KNOWN — a claim, a change of address, a
 * new car. An unexplained rise is the one that makes people leave, sometimes for
 * a worse policy.
 *
 * AUTO-RENEWAL AND THE DEADLINE TO STOP IT ARE SHOWN TOGETHER. The mechanism
 * only works against the customer when the date to act is not on the same page
 * as the price.
 */
export function RenewalQuote({ newPremium, previousPremium, period = "a year", renewsOn, autoRenews, cancelBy, reasons = [], coverChanged, currency = "GBP", locale = "en-GB", className }: {
  newPremium: number;
  previousPremium?: number;
  period?: string;
  /** Free text — "14 September". */
  renewsOn?: string;
  autoRenews?: boolean;
  /** The last date to stop it. */
  cancelBy?: string;
  /** Why it changed. */
  reasons?: string[];
  /** True where the cover itself is different this year. */
  coverChanged?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  const diff = previousPremium !== undefined ? newPremium - previousPremium : undefined;
  const pct = diff !== undefined && previousPremium ? Math.round((diff / previousPremium) * 100) : undefined;
  return (
    <div data-slot="renewal-quote" className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{money(newPremium)}</span>
        <span className="text-muted-foreground"> {period}</span>
      </p>
      {previousPremium !== undefined && (
        <p className={cn("text-xs tabular-nums", diff && diff > 0 ? "font-medium" : "text-muted-foreground")}>
          You paid {money(previousPremium)} last year
          {diff !== undefined && diff !== 0 && (
            <> — {money(Math.abs(diff))} {diff > 0 ? "more" : "less"}{pct !== undefined ? `, ${Math.abs(pct)}%` : ""}</>
          )}
          {diff === 0 && " — unchanged"}
        </p>
      )}
      {reasons.length > 0 ? (
        <ul className="text-xs text-muted-foreground">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{r}</span></li>
          ))}
        </ul>
      ) : diff !== undefined && diff > 0 ? (
        <p className="text-xs text-muted-foreground">No reason for the increase has been given. Ask for one.</p>
      ) : null}
      {coverChanged && <p className="text-xs font-medium">The cover is not the same as last year — check what changed.</p>}
      {renewsOn && (
        <p className="text-xs">
          Renews {renewsOn}
          {autoRenews && ` automatically${cancelBy ? ` unless you tell us by ${cancelBy}` : ""}`}.
        </p>
      )}
    </div>
  );
}
