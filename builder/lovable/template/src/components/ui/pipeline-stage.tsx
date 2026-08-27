import { cn } from "@/lib/utils";
/**
 * How many candidates are at each stage — and where they are dropping out.
 *
 * THE PASS RATE BETWEEN STAGES IS THE OUTPUT, not the headcount. A stage that
 * rejects 95% is either the wrong filter or an advert attracting the wrong
 * people, and a bar chart of totals cannot say which — the ratio can.
 *
 * TIME IN STAGE IS SHOWN because the slowest stage is where candidates accept
 * other offers, and it is almost never the stage anybody assumes.
 *
 * A STAGE WITH NOBODY IN IT IS SHOWN, not skipped. An empty final stage on a
 * role open for two months is the whole story, and a list of non-empty stages
 * hides it.
 *
 * THE NUMBERS ARE IN TEXT AND THE BARS ARE `aria-hidden`, because this gets
 * read out in a meeting and pasted into a document as often as it is looked at.
 */
export type Stage = { id: string; name: string; count: number; medianDays?: number };

export function PipelineStage({ stages, className }: { stages: Stage[]; className?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const slowest = stages.reduce<Stage | null>(
    (a, s) => (s.medianDays === undefined ? a : !a || (a.medianDays ?? 0) < s.medianDays ? s : a),
    null,
  );
  return (
    <div data-slot="pipeline-stage" className={cn("space-y-2.5", className)}>
      <ul className="space-y-2.5">
        {stages.map((s, i) => {
          const prev = stages[i - 1];
          const rate = prev && prev.count > 0 ? s.count / prev.count : undefined;
          return (
            <li key={s.id} className="space-y-0.5">
              <p className="flex items-baseline gap-3 text-sm">
                <span className="min-w-0 flex-1">{s.name}</span>
                <span className="shrink-0 tabular-nums">{s.count}</span>
                {rate !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {Math.round(rate * 100)}% went through
                  </span>
                )}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-border" aria-hidden="true">
                <span className="block h-full bg-foreground" style={{ width: `${(s.count / max) * 100}%` }} />
              </div>
              {s.medianDays !== undefined && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {s.medianDays} {s.medianDays === 1 ? "day" : "days"} here, typically
                </p>
              )}
              {s.count === 0 && <p className="text-xs font-medium">Nobody has reached this stage.</p>}
            </li>
          );
        })}
      </ul>
      {slowest && slowest.medianDays !== undefined && (
        <p className="text-xs text-muted-foreground">
          {slowest.name} is the slowest stage — that is where offers elsewhere get accepted.
        </p>
      )}
    </div>
  );
}
