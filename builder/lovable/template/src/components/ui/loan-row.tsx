import { cn } from "@/lib/utils";
/**
 * One item on loan — when it is due, and whether it can be kept longer.
 *
 * "CANNOT BE RENEWED" IS SHOWN BEFORE THE DUE DATE MATTERS, not at the moment
 * somebody tries. An item another reader has reserved will not renew, and
 * discovering that on the due date is how a fine happens to someone who was
 * planning to renew.
 *
 * FINES ARE SHOWN AS ACCRUING, WITH THE DAILY RATE. A single total is a
 * surprise; a rate and a running figure is a reason to come in today. Where a
 * service has no fines, saying so is worth as much — fear of fines is a
 * documented reason people avoid libraries entirely.
 *
 * OVERDUE IS COUNTED IN DAYS, not marked by colour. A red row is invisible in
 * print and to a significant minority of readers, and "4 days over" is more
 * useful anyway.
 *
 * THE ITEM IS NAMED, not just its barcode. A list of numbers cannot be checked
 * against the pile of books by the door, which is what somebody is doing while
 * reading this.
 */
export function LoanRow({ title, barcode, dueOn, daysOverdue = 0, renewable = true, whyNotRenewable, renewalsLeft, finePerDay, fineSoFar, currency = "GBP", locale = "en-GB", noFines, className }: {
  title: string;
  barcode?: string;
  /** Free text — "14 August". */
  dueOn?: string;
  daysOverdue?: number;
  renewable?: boolean;
  /** "Another reader has reserved it." */
  whyNotRenewable?: string;
  renewalsLeft?: number;
  /** In major units. */
  finePerDay?: number;
  fineSoFar?: number;
  currency?: string;
  locale?: string;
  /** True where the service charges nothing. */
  noFines?: boolean;
  className?: string;
}) {
  // Pennies only where there are pennies, decided PER VALUE. A blanket
  // minimumFractionDigits of 0 renders a 0.80 fine as "£0.8", which reads as a
  // typo rather than as eighty pence.
  const money = (v: number) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
  const over = daysOverdue > 0;
  return (
    <li data-slot="loan-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {title}
          {barcode && <span className="block font-mono text-xs text-muted-foreground">{barcode}</span>}
        </span>
        <span className={cn("shrink-0 text-xs tabular-nums", over && "font-medium")}>
          {over ? `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} over` : dueOn ? `Due ${dueOn}` : "No due date"}
        </span>
      </p>
      {!renewable && (
        <p className="text-xs font-medium">
          Cannot be renewed{whyNotRenewable ? ` — ${whyNotRenewable}` : ""}
        </p>
      )}
      {renewable && renewalsLeft !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {renewalsLeft === 0 ? "No renewals left." : `${renewalsLeft} ${renewalsLeft === 1 ? "renewal" : "renewals"} left.`}
        </p>
      )}
      {noFines ? (
        <p className="text-xs text-muted-foreground">There are no fines here — just bring it back when you can.</p>
      ) : over && (fineSoFar !== undefined || finePerDay !== undefined) ? (
        <p className="text-xs tabular-nums">
          {fineSoFar !== undefined && `${money(fineSoFar)} so far`}
          {fineSoFar !== undefined && finePerDay !== undefined ? " · " : ""}
          {finePerDay !== undefined && `${money(finePerDay)} a day`}
        </p>
      ) : null}
    </li>
  );
}
