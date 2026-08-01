import { cn } from "@/lib/utils";
/**
 * The filters in force, as one readable sentence.
 *
 * THE DIFFERENCE FROM `filter-bar` IS THAT THIS IS PROSE, NOT CONTROLS. Chips
 * you can remove belong above a list somebody is working in; a sentence belongs
 * where the filters have to travel — an export header, a printed report, an
 * email summary, the top of a saved view. "Unpaid invoices over £500 since
 * March" is a thing you can read aloud on a call, and a row of chips is not.
 *
 * IT NAMES THE FIELD AS WELL AS THE VALUE. "Cancelled" alone is ambiguous the
 * moment two fields can hold it; "Status: cancelled" survives being read six
 * months later in a document with no interface around it.
 *
 * NO FILTERS IS SAID EXPLICITLY. An empty summary line under a report reads as
 * a rendering failure, and "everything, no filters" is a meaningful and
 * important thing to record on an export.
 *
 * `<dl>` when it is a block, an inline sentence when `inline` — the same facts,
 * shaped for the two places they are needed.
 */
export type FilterFact = { field: string; value: string };

export function FilterSummary({ filters, inline, noneNote = "No filters — everything is included", className }: {
  filters: FilterFact[];
  inline?: boolean;
  noneNote?: string;
  className?: string;
}) {
  if (!filters.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{noneNote}</p>;
  }
  if (inline) {
    return (
      <p className={cn("text-sm", className)}>
        {filters.map((f, i) => (
          <span key={`${f.field}-${i}`}>
            {i > 0 && <span className="text-muted-foreground">, </span>}
            <span className="text-muted-foreground">{f.field}: </span>
            <span className="font-medium">{f.value}</span>
          </span>
        ))}
      </p>
    );
  }
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm", className)}>
      {filters.map((f, i) => (
        <div key={`${f.field}-${i}`} className="contents">
          <dt className="text-muted-foreground">{f.field}</dt>
          <dd className="font-medium">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
