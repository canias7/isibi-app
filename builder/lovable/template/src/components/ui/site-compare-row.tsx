import { cn } from "@/lib/utils";
/**
 * One branch against the group — normalised, or the comparison is meaningless.
 *
 * A RAW TOTAL COMPARES SIZE, NOT PERFORMANCE. The biggest branch always wins a
 * revenue league and always loses a cost-per-unit one, and a table of totals
 * tells a group nothing except which shop is largest. The per-unit basis —
 * per head, per square metre, per opening hour — is what makes branches
 * comparable at all.
 *
 * THE BASIS IS PRINTED beside the number, because "£412" means four different
 * things depending on what it is divided by, and the divisor is the argument.
 *
 * A NEW OR DISRUPTED SITE IS EXCLUDED FROM THE COMPARISON, VISIBLY. A branch
 * open three weeks or trading through building work will sit bottom of every
 * table for reasons nobody there can fix, and leaving it in is how a good
 * manager is judged badly.
 *
 * THE GROUP FIGURE IS A MEDIAN, NOT A MEAN, where the caller supplies one —
 * one enormous branch drags a mean upward and puts most sites below "average",
 * which is arithmetic rather than a finding.
 */
export function SiteCompareRow({ site, value, unit, basis, groupMedian, rank, ofSites, excluded, excludedReason, className }: {
  site: string;
  /** Already normalised by the caller. */
  value: number;
  /** Pre-formatted — "£", "%". */
  unit?: string;
  /** What it is divided by — "per opening hour". */
  basis?: string;
  /** The group's middle value, not its mean. */
  groupMedian?: number;
  rank?: number;
  ofSites?: number;
  /** True where this site should not be compared yet. */
  excluded?: boolean;
  excludedReason?: string;
  className?: string;
}) {
  const diff = groupMedian !== undefined ? value - groupMedian : undefined;
  const u = unit ?? "";
  return (
    <li data-slot="site-compare-row" className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className={cn("min-w-0 flex-1", excluded && "text-muted-foreground")}>
          {site}
          {basis && <span className="block text-xs text-muted-foreground">{basis}</span>}
        </span>
        <span className="shrink-0 tabular-nums">{u}{value.toLocaleString()}</span>
        {rank !== undefined && !excluded && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {rank}{ofSites !== undefined ? ` of ${ofSites}` : ""}
          </span>
        )}
      </p>
      {excluded ? (
        <p className="text-xs font-medium">
          Not compared{excludedReason ? ` — ${excludedReason}` : ""}.
        </p>
      ) : diff !== undefined && diff !== 0 ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          {u}{Math.abs(Number(diff.toFixed(2))).toLocaleString()} {diff > 0 ? "above" : "below"} the group median of {u}{groupMedian?.toLocaleString()}.
        </p>
      ) : null}
    </li>
  );
}
