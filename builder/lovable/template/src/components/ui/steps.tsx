import { cn } from "@/lib/utils";

export type Step = { title: string; description?: string };

/**
 * How it works, numbered.
 *
 * The numbering is the content here — these are a real sequence, so the markers
 * carry information rather than decorating.
 */
export function Steps({ items, className }: { items: Step[]; className?: string }) {
  return (
    <ol className={cn("grid gap-6 sm:grid-cols-3", className)}>
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
