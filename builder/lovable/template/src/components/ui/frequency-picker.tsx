import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Weekly, fortnightly and monthly priced SIDE BY SIDE, because recurring is
 * the product.
 *
 * THE THREE ARE SHOWN AT ONCE, never behind a toggle. A cleaner is not selling
 * a clean, they are selling a standing Tuesday — and a customer comparing
 * "£48 weekly" against "£62 monthly" can see in one glance that the monthly
 * visit costs more per hour, which is the true and slightly awkward fact this
 * layout does not let anybody hide. A toggle makes the comparison a memory
 * test, which is how the dearer option gets picked by accident.
 *
 * THE PER-VISIT PRICE AND THE MONTHLY COST ARE BOTH SHOWN, because they are
 * different questions. "What does a visit cost" decides whether it is worth it;
 * "what leaves my account each month" decides whether it is affordable, and a
 * page that answers only one of them gets a phone call about the other.
 * Weekly's monthly figure uses 52/12, NOT 4 — four weeks a month is eleven
 * months a year, and understating a standing order is the worst possible
 * rounding error to make in the customer's favour.
 *
 * ONE-OFF IS OFFERED WHERE IT EXISTS, and priced honestly higher rather than
 * being hidden. Somebody who wants an end-of-tenancy clean is not going to be
 * argued into a standing order, and refusing to price it just sends them
 * elsewhere for a job worth more than three regular visits.
 *
 * NOTHING IS "MOST POPULAR" UNLESS THE CALLER SAYS SO, and when they do it is
 * a word at weight rather than a coloured ribbon.
 */
export type Frequency = {
  /** "Every week", "Every two weeks", "Once a month", "One-off". */
  label: string;
  /** Visits per year. 52, 26, 12, or 0 for a one-off. Drives the monthly figure. */
  perYear: number;
  pricePerVisit: number;
  /** "2 hours", "3 hours". */
  duration?: string | null;
  /** What is different about this one: "Includes the oven every third visit". */
  note?: string | null;
  /** The one the business would like picked. Exactly one, or none. */
  suggested?: boolean;
};
const COLS = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;
export function FrequencyPicker({
  options, value, defaultValue, onChange, onBook,
  currency = "GBP", locale = "en-GB", className, columns = 4, }: {
  options: Frequency[];
  /** Controlled when supplied; otherwise it manages its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (label: string) => void;
  onBook?: (f: Frequency) => void;
  currency?: string;
  locale?: string;
  /** How many across at the widest. The parent knows its room; the CSS cannot. */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const [own, setOwn] = React.useState(defaultValue ?? options.find((o) => o.suggested)?.label ?? options[0]?.label ?? "");
  const picked = value ?? own;
  const set = (l: string) => (onChange ? onChange(l) : setOwn(l));
  const id = React.useId();
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  if (!options.length) return null;
  const chosen = options.find((o) => o.label === picked) ?? options[0];
  return (
    <div className={cn("", className)}>
      <fieldset>
        <legend className="sr-only">How often</legend>
        <div className={cn("grid gap-4", COLS[columns])}>
          {options.map((o) => {
            const on = o.label === picked;
            // 52/12, never 4. Four weeks a month is eleven months a year, and
            // understating a standing order is the rounding error you never
            // want to make in the customer's favour.
            const monthly = o.perYear > 0 ? (o.pricePerVisit * o.perYear) / 12 : null;
            return (
              <label key={o.label} className={cn(
                "flex cursor-pointer flex-col rounded-lg border p-5",
                on ? "border-foreground ring-1 ring-foreground" : "border-border",
              )}>
                <input type="radio" name={`${id}-freq`} className="sr-only" checked={on} onChange={() => set(o.label)} />
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{o.label}</span>
                  {o.suggested && <span className="text-[11px] font-medium uppercase tracking-widest">Most pick this</span>}
                </span>
                <span className="mt-3 block text-2xl font-semibold tabular-nums">{money(o.pricePerVisit)}</span>
                <span className="block text-xs text-muted-foreground">
                  a visit{o.duration ? ` · ${o.duration}` : ""}
                </span>
                <span className="mt-3 block text-sm tabular-nums">
                  {monthly != null
                    ? <>{money(monthly)} <span className="text-muted-foreground">a month</span></>
                    : <span className="text-muted-foreground">Nothing standing</span>}
                </span>
                {o.note && <span className="mt-2 block text-xs leading-snug text-muted-foreground">{o.note}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={() => onBook?.(chosen)}>
          Book {chosen.label.toLowerCase()}
        </Button>
        <p className="text-sm text-muted-foreground">
          Cancel or change it any time, with a week's notice. No contract and no minimum term.
        </p>
      </div>
    </div>
  );
}
