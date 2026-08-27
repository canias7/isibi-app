import { cn } from "@/lib/utils";
/**
 * Rows that were left out, and why.
 *
 * SKIPPED IS NOT THE SAME AS FAILED, and conflating them is why import summaries
 * are distrusted. A blank row skipped deliberately and a row rejected for bad
 * data need different reactions — and "4,182 imported, 12 errors" that quietly
 * omits 40 blank rows does not add up against the file.
 *
 * THE NUMBERS ARE MADE TO RECONCILE. Read, imported, skipped and failed are all
 * stated so the reader can check they sum — which is the first thing anybody
 * does with an import report, and the first thing that shakes confidence when
 * they do not.
 *
 * Renders nothing when nothing was skipped, so a clean import does not print a
 * zero row that invites the question.
 */
export function SkipRowNote({ skipped, reasons, className }: {
  skipped: number;
  /** Grouped — [{ reason: "blank row", count: 40 }]. */
  reasons?: { reason: string; count: number }[];
  className?: string;
}) {
  if (skipped <= 0) return null;
  return (
    <div data-slot="skip-row-note" className={cn("text-xs text-muted-foreground", className)}>
      <p className="tabular-nums">
        <span className="font-medium text-foreground">{skipped.toLocaleString()} skipped</span> — not errors, just left out
      </p>
      {reasons?.length ? (
        <ul className="tabular-nums">
          {reasons.map((r) => <li key={r.reason}>{r.count.toLocaleString()} — {r.reason}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
