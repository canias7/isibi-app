import { cn } from "@/lib/utils";
/** What to read next. Numbered, because a "top five" is a ranking. */
export function RelatedList({ title = "Read next", items, ordered, className }: {
  title?: string; items: { label: string; href: string; meta?: string }[];
  ordered?: boolean; className?: string;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <section data-slot="related-list" className={className}>
      <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{title}</h3>
      <List className={cn("flex flex-col", ordered && "list-inside list-decimal")}>
        {items.map((r) => (
          <li key={r.href} className="border-b border-border py-2 last:border-0">
            <a href={r.href} className="text-sm hover:underline underline-offset-4">{r.label}</a>
            {r.meta && <span className="ms-2 text-xs text-muted-foreground">{r.meta}</span>}
          </li>
        ))}
      </List>
    </section>
  );
}
