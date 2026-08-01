import { cn } from "@/lib/utils";
/**
 * How many animals there are, and whether the count agrees with the register.
 *
 * THE DISCREPANCY IS THE COMPONENT. A counted number and a registered number
 * that disagree is the finding at every inspection, and the difference is
 * usually a movement not recorded rather than a missing animal — which is a
 * paperwork fix if caught and a penalty if not.
 *
 * IT BREAKS DOWN BY CATEGORY, because that is how holdings are described and
 * how stocking limits are written. A single total cannot be checked against a
 * limit expressed per category.
 *
 * BOTH DIRECTIONS ARE REPORTED. More animals than registered is as much a
 * problem as fewer — usually births not notified — and a component that only
 * looks for losses misses half of them.
 *
 * THE COUNT DATE IS SHOWN, since a herd changes weekly and a month-old count
 * proves nothing about today.
 */
export type HerdCategory = { label: string; counted: number; registered?: number };

export function HerdCount({ categories, countedOn, className }: {
  categories: HerdCategory[];
  /** Free text — "yesterday". */
  countedOn?: string;
  className?: string;
}) {
  const counted = categories.reduce((n, c) => n + c.counted, 0);
  const registered = categories.reduce((n, c) => n + (c.registered ?? c.counted), 0);
  const diff = counted - registered;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{counted.toLocaleString()}</span>
        <span className="text-muted-foreground"> counted</span>
        {diff !== 0 && (
          <span className="block text-xs font-medium">
            {Math.abs(diff)} {diff > 0 ? "more" : "fewer"} than the register says
            <span className="font-normal text-muted-foreground">
              {diff > 0 ? " — births may not have been notified" : " — a movement may not have been recorded"}
            </span>
          </span>
        )}
        {countedOn && <span className="block text-xs text-muted-foreground">Counted {countedOn}</span>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {categories.map((c) => {
          const d = c.registered !== undefined ? c.counted - c.registered : 0;
          return (
            <li key={c.label} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span>{c.label}</span>
              <span className="shrink-0 text-right">
                <span className={cn("tabular-nums", d !== 0 && "font-medium")}>{c.counted.toLocaleString()}</span>
                {d !== 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground"> of {c.registered!.toLocaleString()}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
