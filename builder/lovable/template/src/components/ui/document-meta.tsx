import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Version, status and date, for a document that has more than one of each.
 *
 * A `<dl>` rather than a row of pill badges: these are label-and-value pairs,
 * and a bare "v3" beside a bare "Draft" is two facts with nothing saying
 * which is which.
 */
export function DocumentMeta({ items, className }: {
  items: { label: string; value: string | number | Date; date?: boolean }[];
  className?: string;
}) {
  return (
    <dl data-slot="document-meta" className={cn("flex flex-wrap gap-x-6 gap-y-1 text-xs", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex gap-1.5">
          <dt className="text-muted-foreground">{it.label}</dt>
          <dd className="font-medium">
            {it.date ? <DateFormat date={it.value as string | number | Date} /> : String(it.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
