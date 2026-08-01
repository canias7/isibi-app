import { cn } from "@/lib/utils";
/**
 * The measurements of a thing, read-only, as a definition list.
 *
 * A real `<dl>` rather than a two-column grid of divs, so a screen reader walks
 * it as label-and-value pairs — the one structure that makes "Length, 2.4
 * metres" arrive as a fact instead of two loose strings.
 *
 * NUMBERS ARE `tabular-nums` AND RIGHT-ALIGNED, which is what makes a column of
 * them comparable at a glance: proportional digits put 1.4 and 11.4 at
 * different offsets and the eye cannot line them up.
 *
 * A MISSING MEASUREMENT SAYS "not given" rather than rendering an empty cell.
 * A blank in a spec table reads as zero, or as a rendering failure, and neither
 * is what "we did not measure it" means.
 *
 * The unit sits with the value rather than in the label, so the label column
 * stays scannable and a row whose unit differs from its neighbours does not
 * hide it in small print at the far left.
 */
export type Measurement = { label: string; value?: number | string | null; unit?: string; note?: string };

export function MeasurementSummary({ items, missingNote = "not given", className }: {
  items: Measurement[];
  missingNote?: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <dl className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {items.map((m) => {
        const missing = m.value === null || m.value === undefined || m.value === "";
        return (
          <div key={m.label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="min-w-0 text-muted-foreground">
              {m.label}
              {m.note && <span className="block text-xs">{m.note}</span>}
            </dt>
            <dd className={cn("shrink-0 text-right tabular-nums", missing && "text-muted-foreground italic")}>
              {missing ? missingNote : <>{m.value}{m.unit ? ` ${m.unit}` : ""}</>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
