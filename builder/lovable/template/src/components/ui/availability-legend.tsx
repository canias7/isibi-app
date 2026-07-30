import { cn } from "@/lib/utils";
/**
 * What the shading on a rota or a booking grid means.
 *
 * Each key repeats the exact swatch the grid uses — a legend drawn with its
 * own approximations of those styles is one that stops matching the moment
 * either side is restyled, and then it is worse than none.
 *
 * Required rather than optional whenever a grid encodes anything beyond
 * free-or-taken. A block of greys with no key is a picture, not information.
 */
export function AvailabilityLegend({ items, className }: {
  items: { label: string; swatch: string }[]; className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className={cn("size-3 shrink-0 rounded-[2px] border border-border", it.swatch)} aria-hidden="true" />
          <span className="text-muted-foreground">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
