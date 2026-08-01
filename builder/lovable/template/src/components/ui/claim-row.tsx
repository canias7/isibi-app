import { cn } from "@/lib/utils";
/**
 * A claim in a list — with whose move it is.
 *
 * "WAITING ON YOU" IS THE HEADLINE, as it is for any application. Claims stall
 * for weeks on a document the claimant does not know is outstanding, and the
 * stage name — "in assessment" — actively conceals that.
 *
 * THE AMOUNT SHOWN IS LABELLED AS CLAIMED, OFFERED OR PAID. Three different
 * numbers exist at different points and a single "amount" column is read as
 * whichever is most favourable, which sets up the complaint later.
 *
 * DAYS OPEN IS SHOWN because it is the only measure a claimant has of whether
 * their claim is going normally, and the answer is usually available and never
 * displayed.
 *
 * A DECLINED CLAIM CARRIES THE REASON IN THE ROW. Sending somebody to a letter
 * to find out why is the single most complained-about behaviour in claims
 * handling.
 */
export function ClaimRow({ reference, what, stage, waitingOn, needed, daysOpen, claimed, offered, paid, declinedReason, currency = "GBP", locale = "en-GB", className }: {
  reference?: string;
  /** "Escape of water, kitchen". */
  what: string;
  stage?: string;
  waitingOn?: "you" | "us" | "someone-else";
  /** What the claimant must supply. */
  needed?: string;
  daysOpen?: number;
  claimed?: number;
  offered?: number;
  paid?: number;
  declinedReason?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  const amount = paid !== undefined
    ? { label: "paid", value: paid }
    : offered !== undefined
      ? { label: "offered", value: offered }
      : claimed !== undefined
        ? { label: "claimed", value: claimed }
        : undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {what}
          {reference && <span className="block font-mono text-xs text-muted-foreground">{reference}</span>}
        </span>
        {amount && (
          <span className="shrink-0 tabular-nums">
            {money(amount.value)} <span className="text-xs text-muted-foreground">{amount.label}</span>
          </span>
        )}
      </p>
      {waitingOn && (
        <p className={cn("text-xs", waitingOn === "you" ? "font-medium" : "text-muted-foreground")}>
          {waitingOn === "you" ? "We are waiting for you" : waitingOn === "us" ? "With us" : "With a third party"}
          {stage && ` · ${stage}`}
        </p>
      )}
      {waitingOn === "you" && needed && <p className="text-xs font-medium">{needed}</p>}
      {daysOpen !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Open {daysOpen} {daysOpen === 1 ? "day" : "days"}.
        </p>
      )}
      {declinedReason && <p className="text-xs font-medium">Declined: {declinedReason}</p>}
    </li>
  );
}
