import { cn } from "@/lib/utils";
/**
 * Tabs that are LINKS, not panels.
 *
 * shadcn's `tabs` swaps content in place; this navigates between pages, so it is
 * an <a> with `aria-current` rather than a tablist. Using the wrong one is why
 * tabbed navigation often breaks the back button.
 */
export function TabNav({ items, active, className }: {
  items: { label: string; href: string; count?: number }[];
  active?: string; className?: string;
}) {
  return (
    <nav data-slot="tab-nav" className={cn("flex gap-1 overflow-x-auto border-b", className)}>
      {items.map((t) => {
        const on = active === t.href;
        return (
          <a key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              on ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.count != null && <span className="ms-1.5 tabular-nums text-muted-foreground">{t.count}</span>}
          </a>
        );
      })}
    </nav>
  );
}
