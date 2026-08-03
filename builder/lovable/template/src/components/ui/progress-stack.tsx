import { cn } from "@/lib/utils";
/**
 * A segmented progress bar — steps done, in progress, and left.
 *
 * Different from `RatioBar`, which is a breakdown of a whole: this one is
 * ordered, so the segments always run in the same direction and the labels
 * sit under their own section.
 *
 * THE VALUES ARE FORMATTED, never interpolated raw. A stack whose segments are
 * money read "28280 Spent · 84120 Held · 67600 Still to raise" on a real page —
 * the same defect as the meter family, and for the same reason: the numbers
 * this draws are precisely the large ones. `unit` exists because a bare
 * "28,280" under a bar about pounds is a number with no idea what it is.
 */
export function ProgressStack({ segments, total, unit = "", className }: {
  segments: { label: string; value: number; tone?: "done" | "active" | "rest" }[];
  total?: number;
  /** Prefixed to every value — "£", "kg". Omit for a plain count. */
  unit?: string;
  className?: string;
}) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  if (!sum) return null;
  const tone = { done: "bg-foreground", active: "bg-foreground/45", rest: "bg-muted" };
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-2 gap-px overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <span key={s.label} className={cn(tone[s.tone ?? "done"])}
            style={{ width: `${(s.value / sum) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="tabular-nums">{unit}{s.value.toLocaleString()} {s.label}</span>
        ))}
      </div>
    </div>
  );
}
