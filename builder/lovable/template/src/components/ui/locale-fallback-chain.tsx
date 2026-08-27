import { cn } from "@/lib/utils";
/**
 * Which language a string will actually come from, step by step.
 *
 * FALLBACK IS INVISIBLE AND SURPRISING. Somebody sets their language to
 * Canadian French, sees European French, and reports it as a bug — when it is
 * the chain working correctly. Showing the chain turns an apparent fault into
 * an explanation, and shows exactly where to add the missing strings.
 *
 * IT MARKS WHERE THE SEARCH STOPS. The steps after a match are never consulted,
 * and a chain rendered as a flat list implies all of them contribute — which is
 * how somebody translates a string into the wrong file and wonders why nothing
 * changed.
 *
 * IT COUNTS WHAT EACH STEP SUPPLIES where the caller knows. "fr-CA covers 12
 * strings, fr covers the other 940" tells somebody whether a regional variant
 * is worth maintaining at all.
 *
 * `<ol>` because the order is the whole meaning, with `lang` on each tag so the
 * names are pronounced correctly.
 */
export type FallbackStep = { id: string; label: string; strings?: number; missing?: boolean };

export function LocaleFallbackChain({ steps, className }: {
  /** In order — most specific first. */
  steps: FallbackStep[];
  className?: string;
}) {
  if (!steps.length) return null;
  const stopAt = steps.findIndex((s) => !s.missing);
  return (
    <ol data-slot="locale-fallback-chain" className={cn("space-y-0.5 text-sm", className)}>
      {steps.map((s, i) => {
        const used = !s.missing;
        const after = stopAt >= 0 && i > stopAt;
        return (
          <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
            <code className={cn("font-mono text-xs", after && "text-muted-foreground")} lang={s.id}>{s.id}</code>
            <span className={cn(after && "text-muted-foreground")}>{s.label}</span>
            {s.strings !== undefined && (
              <span className="text-xs tabular-nums text-muted-foreground">{s.strings.toLocaleString()} strings</span>
            )}
            <span className="text-xs text-muted-foreground">
              {after ? "never reached" : used ? "used first" : "nothing here"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
