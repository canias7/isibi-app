import { cn } from "@/lib/utils";
/**
 * The same date in several languages, so an ambiguous format is caught.
 *
 * 03/04/2026 IS TWO DIFFERENT DAYS and this is the component that makes that
 * visible. A product that formats dates numerically is read wrongly by half its
 * customers, and nothing about the code reveals it — only seeing 3 April beside
 * 4 March does.
 *
 * IT USES A DELIBERATELY AMBIGUOUS SAMPLE by default. A date like the 25th
 * cannot be misread, so a preview built on today's date passes three weeks out
 * of four and proves nothing.
 *
 * `Intl.DateTimeFormat` PER LOCALE, so ordering, separators and month names are
 * the platform's rather than ours. A hand-built table of formats is wrong for
 * some locale immediately.
 *
 * THE LONG FORM IS SHOWN BESIDE THE NUMERIC ONE, because the recommendation
 * that follows from this component is almost always "use the month name" — and
 * seeing both makes the argument without a paragraph.
 */
export function DateFormatPreview({ date = "2026-04-03", locales, className }: {
  /** ISO date. Defaults to one that is ambiguous. */
  date?: string;
  locales: { id: string; label: string }[];
  className?: string;
}) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">
        The same day, <time dateTime={date}>{date}</time>, in each language:
      </p>
      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        {locales.map((l) => {
          let numeric = "", long = "";
          try {
            numeric = new Intl.DateTimeFormat(l.id, { dateStyle: "short" }).format(d);
            long = new Intl.DateTimeFormat(l.id, { dateStyle: "long" }).format(d);
          } catch { return null; }
          return (
            <div key={l.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className="text-right" lang={l.id}>
                <span className="tabular-nums">{numeric}</span>
                <span className="block text-xs text-muted-foreground">{long}</span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-xs text-muted-foreground">
        The numeric forms are not interchangeable — prefer the month name where there is room.
      </p>
    </div>
  );
}
