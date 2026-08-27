import { cn } from "@/lib/utils";

export type Step = { title: string; description?: string };

/**
 * How it works, numbered.
 *
 * The numbering is the content here — these are a real sequence, so the markers
 * carry information rather than decorating.
 */
export function Steps({ items, columns = 3, className }: {
  items: Step[];
  /** How many across at the widest. The parent knows its room; the CSS cannot. */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <ol data-slot="steps" className={cn("grid gap-6", cols, className)}>
      {items.map((s, i) => (
        <li key={s.title || i} className="flex flex-col gap-2">
          <span className="grid size-8 place-items-center rounded-full border text-sm font-medium tabular-nums">
            {i + 1}
          </span>
          <span className="font-medium">{s.title}</span>
          {s.description && <span className="text-sm text-muted-foreground">{s.description}</span>}
        </li>
      ))}
    </ol>
  );
}
