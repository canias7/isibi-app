import { cn } from "@/lib/utils";
/**
 * The limits on one workspace, with the ones set by hand marked.
 *
 * OVERRIDES ARE MARKED AND SHOW THE PLAN DEFAULT BESIDE THEM. A workspace with
 * a hand-raised limit is invisible otherwise — somebody upgrades the plan,
 * expects the limit to follow, and it does not because a manual value is
 * winning. The default in the same row is what makes it explicable.
 *
 * IT IS ORDERED WITH THE OVERRIDDEN ONES FIRST, since a list of twenty limits
 * is read for exceptions and nothing else.
 *
 * EACH ROW SAYS WHO SET THE OVERRIDE. "Raised to 50,000" with no author is a
 * mystery six months later, and this is the sort of thing granted in a sales
 * conversation and never recorded anywhere else.
 *
 * READ-ONLY. Editing a tenant's limits is an administrative act with billing
 * consequences, and it belongs behind its own form rather than being a set of
 * inputs on a summary.
 */
export type TenantLimit = {
  id: string;
  label: string;
  value: number | null;
  /** The plan's own value, when this one is an override. */
  planValue?: number | null;
  unit?: string;
  setBy?: string;
};

export function TenantLimits({ limits, planName, className }: {
  limits: TenantLimit[];
  planName?: string;
  className?: string;
}) {
  const fmt = (n: number | null | undefined, unit?: string) =>
    n === null ? "Unlimited" : n === undefined ? "—" : `${n.toLocaleString()}${unit ? ` ${unit}` : ""}`;
  const overridden = limits.filter((l) => l.planValue !== undefined);
  const sorted = [...limits].sort((a, b) =>
    Number(b.planValue !== undefined) - Number(a.planValue !== undefined));
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">
        {planName && <span>{planName} · </span>}
        {overridden.length === 0
          ? "No limits changed by hand"
          : <><span className="font-medium text-foreground">{overridden.length}</span> changed by hand</>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {sorted.map((l) => {
          const custom = l.planValue !== undefined;
          return (
            <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                {l.label}
                {custom && (
                  <span className="block text-xs text-muted-foreground">
                    Plan gives {fmt(l.planValue, l.unit)}
                    {l.setBy && ` · changed by ${l.setBy}`}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-end">
                <span className={cn("block tabular-nums", custom && "font-medium")}>{fmt(l.value, l.unit)}</span>
                {custom && <span className="block text-xs font-medium">Set by hand</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
