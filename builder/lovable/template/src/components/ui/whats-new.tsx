import { Badge } from "@/components/ui/badge";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/** A short list of recent changes. Newest first, dated, no version numbers. */
export function WhatsNew({ items, title = "What's new", className }: {
  items: { title: string; body?: string; at?: string | number | Date; tag?: string }[];
  title?: string; className?: string;
}) {
  return (
    <section data-slot="whats-new" className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.title} className="border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{it.title}</span>
              {it.tag && <Badge variant="secondary" className="text-[10px]">{it.tag}</Badge>}
              {it.at && <span className="text-xs text-muted-foreground"><DateFormat date={it.at} /></span>}
            </div>
            {it.body && <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
