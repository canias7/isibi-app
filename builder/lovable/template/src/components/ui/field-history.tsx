import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * What this one field used to say.
 *
 * SCOPED TO A FIELD, unlike `action-history` which covers a record. On the
 * screens where this matters — a price, a dosage, a due date — the question is
 * never "what happened to this record" but "what was this number before, and who
 * changed it".
 *
 * OLD VALUES ARE STRUCK THROUGH, so the current one is unmistakable in a column
 * of similar-looking numbers. Weight and strikethrough rather than colour, so it
 * survives print and greyscale — and these are exactly the screens that get
 * printed.
 *
 * Newest first and capped, with the count stated, because a field edited forty
 * times should say so rather than rendering forty rows.
 */
export function FieldHistory({ entries, max = 5, className }: {
  /** Newest first. */
  entries: { value: string; by?: string; at: string | number | Date }[];
  max?: number;
  className?: string;
}) {
  if (!entries.length) return null;
  const shown = entries.slice(0, max);
  const rest = entries.length - shown.length;
  return (
    <ol data-slot="field-history" className={cn("flex flex-col gap-0.5 text-xs", className)}>
      {shown.map((e, i) => (
        <li key={i} className="flex flex-wrap gap-x-2">
          <span className={cn("tabular-nums", i > 0 && "text-muted-foreground line-through")}>{e.value}</span>
          <span className="text-muted-foreground">
            {e.by ? `${e.by} · ` : ""}
            <DateFormat date={e.at} />
          </span>
        </li>
      ))}
      {rest > 0 && <li className="text-muted-foreground tabular-nums">and {rest} earlier</li>}
    </ol>
  );
}
