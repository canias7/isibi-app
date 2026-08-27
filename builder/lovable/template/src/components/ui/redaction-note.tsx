import { cn } from "@/lib/utils";
/**
 * "Three passages have been removed."
 *
 * REDACTION MUST BE DISCLOSED OR IT IS DECEPTION. A document with sections
 * silently cut reads as complete, and somebody relies on it — the count and the
 * reason are what make a redacted document usable rather than misleading.
 *
 * IT STATES THE REASON, not just the fact. "Removed under the confidentiality
 * clause" and "removed pending review" mean entirely different things to
 * whoever is reading, and both are better than a black rectangle.
 *
 * IT DOES NOT RENDER THE REDACTED CONTENT AT ALL. Anything that draws a black
 * box over text still present in the DOM is not redaction — it is selectable,
 * copyable and in the page source, which is how redaction failures make the
 * news.
 */
export function RedactionNote({ count, reason, by, className }: {
  count: number;
  /** "the confidentiality clause" */
  reason?: string;
  by?: string;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <p data-slot="redaction-note" className={cn("rounded-md border border-dashed border-border px-3 py-2 text-xs", className)}>
      <span className="font-medium tabular-nums">
        {count} {count === 1 ? "passage has" : "passages have"} been removed
      </span>
      <span className="text-muted-foreground">
        {reason ? ` under ${reason}` : ""}{by ? ` by ${by}` : ""}.
      </span>
    </p>
  );
}
