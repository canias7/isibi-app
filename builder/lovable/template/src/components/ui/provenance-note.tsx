import { cn } from "@/lib/utils";
/**
 * Where an item has been — including the gaps, which are the point.
 *
 * GAPS ARE SHOWN, NOT SMOOTHED OVER. An unbroken-looking chain that quietly
 * omits 1933 to 1945 is the specific failure that provenance research exists to
 * catch. An unknown period is stated as unknown, in sequence, at its correct
 * place.
 *
 * "HOW IT WAS ACQUIRED" IS SEPARATE FROM "WHO HELD IT". Purchase, gift,
 * bequest, excavation and transfer carry entirely different questions, and a
 * list of names without them answers none of them.
 *
 * A DISPUTED OR RESEARCHED PERIOD IS FLAGGED WITHOUT BEING RESOLVED HERE. The
 * component's job is to say a question exists and where the institution's
 * statement is, not to adjudicate it.
 *
 * DATES ARE FREE TEXT because provenance dates are ranges, circas and
 * before/afters far more often than they are days, and forcing a date type
 * invents precision that the record does not have.
 */
export type ProvenanceStep = {
  id: string;
  /** Free text — "1911–1937", "by 1950", "unknown". */
  period: string;
  holder?: string;
  /** "Purchased from", "Bequest of", "Excavated at". */
  how?: string;
  place?: string;
  /** True where nothing is known about this period. */
  gap?: boolean;
};

export function ProvenanceNote({ steps, researchNote, disputed, statementAt, className }: {
  steps: ProvenanceStep[];
  /** Where the institution's research stands. */
  researchNote?: string;
  disputed?: boolean;
  /** Where the full statement can be read. */
  statementAt?: string;
  className?: string;
}) {
  const gaps = steps.filter((s) => s.gap).length;
  return (
    <div className={cn("space-y-1", className)}>
      <ol className="space-y-1 text-sm">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3">
            <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{s.period}</span>
            <span className="min-w-0 flex-1">
              {s.gap ? (
                <span className="text-xs font-medium">Not known where it was.</span>
              ) : (
                <>
                  <span className="block text-sm">{s.holder ?? "Holder not recorded"}</span>
                  {(s.how || s.place) && (
                    <span className="block text-xs text-muted-foreground">
                      {[s.how, s.place].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
      {gaps > 0 && (
        <p className="text-xs text-muted-foreground">
          {gaps === 1 ? "One period is" : `${gaps} periods are`} unaccounted for. Gaps are shown rather than closed over.
        </p>
      )}
      {disputed && <p className="text-xs font-medium">Ownership of this item has been questioned.</p>}
      {researchNote && <p className="text-xs">{researchNote}</p>}
      {statementAt && <p className="text-xs text-muted-foreground">Full statement: {statementAt}</p>}
    </div>
  );
}
