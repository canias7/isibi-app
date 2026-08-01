import { cn } from "@/lib/utils";
/**
 * The same number in several languages — the separators are not decoration.
 *
 * "1.234" IS ONE THOUSAND IN GERMAN AND ONE POINT TWO IN ENGLISH. That is a
 * factor of a thousand, in a price, and it is invisible until the two are shown
 * side by side. This is the number equivalent of `date-format-preview` and the
 * more expensive of the two mistakes.
 *
 * IT INCLUDES A CURRENCY ROW, because symbol position differs as well —
 * €1.234,56 and £1,234.56 differ in three ways at once, and a product that
 * concatenates a symbol onto a formatted number gets it wrong everywhere but
 * home.
 *
 * `Intl.NumberFormat` PER LOCALE, which is also the argument for using `money`
 * and `compact-number` rather than string-building. The preview and the
 * components agree because they call the same platform API.
 *
 * A DELIBERATELY AWKWARD SAMPLE — enough digits to show grouping and a decimal
 * part. A round number formats identically everywhere and proves nothing.
 */
export function NumberFormatPreview({ value = 1234.56, currency, locales, className }: {
  value?: number;
  /** ISO code — "EUR". Adds a money row. */
  currency?: string;
  locales: { id: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">
        The same number, <span className="tabular-nums">{value}</span>, in each language:
      </p>
      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        {locales.map((l) => {
          let plain = "", money = "";
          try {
            plain = new Intl.NumberFormat(l.id).format(value);
            if (currency) money = new Intl.NumberFormat(l.id, { style: "currency", currency }).format(value);
          } catch { return null; }
          return (
            <div key={l.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className="text-right tabular-nums" lang={l.id}>
                {plain}
                {money && <span className="block text-xs text-muted-foreground">{money}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-xs text-muted-foreground">
        Never build these by hand — the separators swap meaning between languages.
      </p>
    </div>
  );
}
