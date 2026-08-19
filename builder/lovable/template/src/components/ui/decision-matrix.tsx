import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Options down the side, criteria across the top, a score in each cell.
 *
 * THE SCALE IS STATED and every cell uses it. A matrix mixing 1-5 in one column
 * with 1-10 in another produces a total that means nothing, and it is the
 * mistake that makes these documents untrustworthy — so the scale is a prop,
 * shown in the header, and cells are clamped to it.
 *
 * A BLANK CELL IS NOT A ZERO. Unscored and scored-zero are different claims,
 * and averaging over the blanks quietly punishes an option nobody has finished
 * assessing. Blanks are excluded from the total and counted separately.
 *
 * THE TOTAL SAYS HOW COMPLETE IT IS — "34 of a possible 50, 2 not scored" —
 * because a leading total on a half-filled row is how a decision gets made
 * early.
 *
 * It does not weight the criteria; that is `weighted-score`, deliberately
 * separate, because unweighted totals are the honest default and weights are a
 * decision of their own.
 */
export function DecisionMatrix({ options, criteria, scores, scale = 5, onScore, className }: {
  options: { key: string; label: string }[];
  criteria: { key: string; label: string; hint?: React.ReactNode }[];
  scores: Record<string, Record<string, number | undefined>>;
  scale?: number;
  onScore?: (option: string, criterion: string, value: number | undefined) => void;
  className?: string;
}) {
  const totals = options.map((o) => {
    const row = scores[o.key] ?? {};
    const given = criteria.filter((c) => typeof row[c.key] === "number");
    return {
      key: o.key,
      total: given.reduce((n, c) => n + (row[c.key] ?? 0), 0),
      possible: given.length * scale,
      missing: criteria.length - given.length,
    };
  });
  const best = Math.max(...totals.map((t) => t.total), 0);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="pb-2 text-start text-xs text-muted-foreground">
          Scored 1 to {scale}. Blank means not scored, which is not the same as zero.
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 text-start font-medium">Option</th>
            {criteria.map((c) => (
              <th key={c.key} scope="col" className="px-2 py-2 text-center align-bottom font-medium">
                <span className="block text-xs">{c.label}</span>
                {c.hint ? <span className="block text-[11px] font-normal text-muted-foreground">{c.hint}</span> : null}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-end font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const t = totals.find((x) => x.key === o.key)!;
            return (
              <tr key={o.key} className="border-b border-border last:border-0">
                <th scope="row" className={cn("px-3 py-2 text-start font-normal", t.total === best && best > 0 && "font-medium")}>
                  {o.label}
                </th>
                {criteria.map((c) => {
                  const v = scores[o.key]?.[c.key];
                  return (
                    <td key={c.key} className="px-1 py-1 text-center">
                      {onScore ? (
                        <input
                          type="number" min={0} max={scale} inputMode="numeric"
                          value={v ?? ""}
                          placeholder="—"
                          aria-label={`${o.label}, ${c.label}`}
                          onChange={(e) => {
                            const raw = e.target.value;
                            onScore(o.key, c.key, raw === "" ? undefined : Math.max(0, Math.min(scale, Number(raw))));
                          }}
                          className="h-7 w-12 rounded border border-border bg-background text-center text-xs tabular-nums outline-none focus-visible:border-ring"
                        />
                      ) : (
                        <span className="text-sm tabular-nums">{v ?? <span className="text-muted-foreground">—</span>}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-end">
                  <span className="font-semibold tabular-nums">{t.total}</span>
                  <span className="text-xs text-muted-foreground tabular-nums"> / {t.possible}</span>
                  {t.missing ? (
                    <span className="block text-[11px] text-muted-foreground tabular-nums">{t.missing} not scored</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
