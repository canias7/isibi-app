import { cn } from "@/lib/utils";

export type Moment = { title: string; when?: string; description?: string };

/** Things in order, down the page. */
export function Timeline({ items, className }: { items: Moment[]; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col gap-6 border-s border-border ps-6", className)}>
      {items.map((m, i) => (
        <li key={m.title + i} className="relative">
          <span className="absolute -start-[1.6875rem] top-1.5 size-2.5 rounded-full bg-foreground" aria-hidden="true" />
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-medium">{m.title}</span>
            {m.when && <span className="text-xs tabular-nums text-muted-foreground">{m.when}</span>}
          </div>
          {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
        </li>
      ))}
    </ol>
  );
}
