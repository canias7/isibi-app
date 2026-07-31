import { cn } from "@/lib/utils";
/**
 * A segmented progress bar — steps done, in progress, and left.
 *
 * Different from `RatioBar`, which is a breakdown of a whole: this one is
 * ordered, so the segments always run in the same direction and the labels
 * sit under their own section.
 */
export function ProgressStack({ segments, total, className }: {
  segments: { label: string; value: number; tone?: "done" | "active" | "rest" }[];
  total?: number; className?: string;
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
          <span key={s.label} className="tabular-nums">{s.value} {s.label}</span>
        ))}
      </div>
    </div>
  );
}
