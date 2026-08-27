import { cn } from "@/lib/utils";
/**
 * A set of replicates — with the spread, which is the point of running them.
 *
 * THE COEFFICIENT OF VARIATION IS THE OUTPUT, not the mean. Replicates exist to
 * measure precision, and a component reporting only their average has discarded
 * the entire reason they were run — while making the result look more certain
 * than it is.
 *
 * TECHNICAL AND BIOLOGICAL REPLICATES ARE NOT INTERCHANGEABLE and the component
 * says which these are. Three technical replicates of one sample say nothing
 * about biological variation, and treating them as an n of 3 is the commonest
 * statistical error in the literature.
 *
 * AN EXCLUDED REPLICATE STAYS VISIBLE WITH ITS REASON. Dropping an outlier and
 * showing only the survivors is indistinguishable from having run two — and the
 * reason is what makes the exclusion defensible rather than convenient.
 *
 * A CV OVER THE ACCEPTANCE LIMIT IS STATED IN WORDS, because that is a decision
 * to repeat the run and it must not depend on somebody reading a colour.
 */
export type Replicate = { id: string; value: number; excluded?: boolean; reason?: string };

export function ReplicateGroup({ label, replicates, unit, kind = "technical", cvLimitPercent, className }: {
  label?: string;
  replicates: Replicate[];
  unit?: string;
  kind?: "technical" | "biological";
  /** The acceptance limit for the CV. */
  cvLimitPercent?: number;
  className?: string;
}) {
  const used = replicates.filter((r) => !r.excluded);
  const n = used.length;
  const mean = n > 0 ? used.reduce((s, r) => s + r.value, 0) / n : undefined;
  const sd = n > 1 && mean !== undefined
    ? Math.sqrt(used.reduce((s, r) => s + (r.value - mean) ** 2, 0) / (n - 1))
    : undefined;
  const cv = sd !== undefined && mean ? (sd / mean) * 100 : undefined;
  const overLimit = cv !== undefined && cvLimitPercent !== undefined && cv > cvLimitPercent;
  const u = unit ? ` ${unit}` : "";
  return (
    <div data-slot="replicate-group" className={cn("space-y-0.5 text-sm", className)}>
      {label && <p>{label}</p>}
      <p className="tabular-nums">
        {mean !== undefined ? `Mean ${mean.toFixed(2).replace(/\.?0+$/, "")}${u}` : "No usable replicates"}
        {cv !== undefined && (
          <span className={cn(overLimit ? "font-medium" : "text-muted-foreground")}>
            {" · "}CV {cv.toFixed(1)}%
          </span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {n} {kind} {n === 1 ? "replicate" : "replicates"}
        {replicates.length !== n && ` · ${replicates.length - n} excluded`}
      </p>
      {kind === "technical" && (
        <p className="text-xs text-muted-foreground">
          Technical replicates measure the assay, not biological variation — this is not an n of {n}.
        </p>
      )}
      {n === 1 && <p className="text-xs font-medium">One replicate gives no measure of precision at all.</p>}
      {overLimit && cvLimitPercent !== undefined && (
        <p className="text-xs font-medium">Above the {cvLimitPercent}% acceptance limit — repeat the run.</p>
      )}
      {replicates.some((r) => r.excluded) && (
        <ul className="text-xs text-muted-foreground">
          {replicates.filter((r) => r.excluded).map((r) => (
            <li key={r.id} className="tabular-nums">
              Excluded {r.value}{u}{r.reason ? ` — ${r.reason}` : " — no reason recorded"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
