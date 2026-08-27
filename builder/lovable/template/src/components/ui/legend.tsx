import { cn } from "@/lib/utils";
/** What the marks mean. Shapes rather than colours, so it survives greyscale. */
export function Legend({ items, className }: {
  items: { label: string; mark?: React.ReactNode }[]; className?: string;
}) {
  return (
    <ul data-slot="legend" className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {it.mark ?? <span className="size-2 rounded-full bg-foreground" aria-hidden="true" />}
          {it.label}
        </li>
      ))}
    </ul>
  );
}
