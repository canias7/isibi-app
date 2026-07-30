import { cn } from "@/lib/utils";
/**
 * A share-of-total bar with a written legend.
 *
 * The legend is not optional and the segments carry a hatch as well as a
 * shade, because four greys side by side are told apart by their order in
 * the legend and nothing else.
 */
const TONE = ["bg-foreground/80", "bg-foreground/55", "bg-foreground/35", "bg-foreground/20", "bg-foreground/10"];
export function RatioBar({ parts, className }: {
  parts: { label: string; value: number }[]; className?: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <span key={p.label} className={cn(TONE[i % TONE.length])}
            style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-[2px]", TONE[i % TONE.length])} aria-hidden="true" />
            <span>{p.label}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
