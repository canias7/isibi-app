import { cn } from "@/lib/utils";
/**
 * A row of intensity cells — busiest hours, activity per day.
 *
 * Five steps of opacity, not a continuous ramp: adjacent shades of one grey
 * stop being distinguishable long before a smooth scale does, and a legend
 * with five swatches can actually be read.
 */
export function HeatStrip({ values, labels, label, className }: {
  values: number[]; labels?: string[]; label?: string; className?: string;
}) {
  if (!values.length) return null;
  const hi = Math.max(...values) || 1;
  const step = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.floor((v / hi) * 4.999) + 1));
  const tone = ["bg-muted", "bg-foreground/15", "bg-foreground/30", "bg-foreground/50", "bg-foreground/75"];
  return (
    <div data-slot="heat-strip" className={cn("space-y-1", className)}>
      <div className="flex gap-0.5" role="img" aria-label={label ?? `Activity across ${values.length} periods`}>
        {values.map((v, i) => (
          <span key={i} title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
            className={cn("h-5 flex-1 rounded-[2px]", tone[step(v)])} />
        ))}
      </div>
      {labels && (
        <div className="flex gap-0.5 text-[10px] text-muted-foreground">
          {labels.map((l, i) => <span key={i} className="flex-1 truncate text-center">{l}</span>)}
        </div>
      )}
    </div>
  );
}
