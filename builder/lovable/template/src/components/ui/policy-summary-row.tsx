import { cn } from "@/lib/utils";
/**
 * A policy at a glance — including whether it is actually in force.
 *
 * "IN FORCE" IS A SEPARATE FACT FROM THE DATES. A policy inside its term can be
 * lapsed for non-payment, suspended, or cancelled from inception, and a card
 * showing only the renewal date tells somebody they are covered when they are
 * not. That is the failure this component exists to prevent.
 *
 * THE INSURED THING IS NAMED, not just the policy number. People hold four
 * policies and cannot tell which is which from a reference, which is why they
 * ring.
 *
 * AUTO-RENEWAL IS DISCLOSED WITH THE DATE. It is the mechanism by which prices
 * drift upward without a decision, and the useful moment to see it is a month
 * before, not on the invoice.
 *
 * THE POLICY DOCUMENT IS ALWAYS REACHABLE, because every real question — is
 * this covered, what is my excess — is answered there and nowhere else.
 */
export function PolicySummaryRow({ product, insures, number, inForce = true, notInForceReason, startsOn, renewsOn, premium, premiumPeriod = "a year", autoRenews, documentNote, currency = "GBP", locale = "en-GB", className }: {
  /** "Home insurance". */
  product: string;
  /** What it covers — "18 Bristol Road". */
  insures?: string;
  number?: string;
  inForce?: boolean;
  /** "Lapsed — payment missed on 1 July." */
  notInForceReason?: string;
  /** Free text — "14 August 2026". */
  startsOn?: string;
  renewsOn?: string;
  premium?: number;
  premiumPeriod?: string;
  autoRenews?: boolean;
  documentNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = premium !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(premium) ? 0 : 2, maximumFractionDigits: 2 }).format(premium)
    : undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {product}
          {insures && <span className="block text-xs text-muted-foreground">{insures}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", inForce ? "text-muted-foreground" : "font-medium")}>
          {inForce ? "In force" : "Not covered"}
        </span>
      </p>
      {!inForce && (
        <p className="text-xs font-medium">{notInForceReason ?? "This policy is not currently providing cover."}</p>
      )}
      <p className="text-xs tabular-nums text-muted-foreground">
        {number && <span className="font-mono">{number}</span>}
        {number && (startsOn || renewsOn) ? " · " : ""}
        {startsOn && `from ${startsOn}`}
        {startsOn && renewsOn ? " · " : ""}
        {renewsOn && `renews ${renewsOn}`}
      </p>
      {money && (
        <p className="text-xs tabular-nums">
          {money} {premiumPeriod}
          {autoRenews && <span className="text-muted-foreground"> · renews automatically unless you say otherwise</span>}
        </p>
      )}
      {documentNote && <p className="text-xs text-muted-foreground">{documentNote}</p>}
    </li>
  );
}
