import { cn } from "@/lib/utils";
/**
 * How a block of time is made up — 20 min cut, 10 min wash, 15 min finish.
 *
 * Every segment carries a written minute count, not just a width. Segments
 * under about 8% of the total are unreadable at any size, and a bar whose
 * short steps are invisible is one where somebody plans a 45-minute
 * appointment for a 70-minute job.
 */
export function DurationBar({ segments, className }: {
  segments: { label: string; minutes: number }[]; className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.minutes, 0);
  if (!total) return null;
  const tone = ["bg-foreground/80", "bg-foreground/55", "bg-foreground/35", "bg-foreground/20"];
  return (
    <div data-slot="duration-bar" className={cn("space-y-2", className)}>
      <div className="flex h-3 gap-px overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <span key={s.label} className={tone[i % tone.length]} style={{ width: `${(s.minutes / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-[2px]", tone[i % tone.length])} aria-hidden="true" />
            {s.label} <span className="tabular-nums text-muted-foreground">{s.minutes} min</span>
          </li>
        ))}
        <li className="ms-auto font-medium tabular-nums">{total} min total</li>
      </ul>
    </div>
  );
}
