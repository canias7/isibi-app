import { Button } from "@/components/ui/button";
import { OverflowScroller } from "@/components/ui/overflow-scroller";
import { cn } from "@/lib/utils";
/** Filter by category. Scrolls sideways rather than wrapping into three rows. */
export function CategoryNav({ items, active, onSelect, allLabel = "All", className }: {
  items: { key: string; label: string; count?: number }[];
  active?: string | null; onSelect: (key: string | null) => void;
  allLabel?: string; className?: string;
}) {
  return (
    <OverflowScroller data-slot="category-nav" className={className}>
      <div className="flex gap-1.5 pb-1">
        <Button size="sm" variant={!active ? "secondary" : "ghost"} onClick={() => onSelect(null)}>{allLabel}</Button>
        {items.map((c) => (
          <Button key={c.key} size="sm" variant={active === c.key ? "secondary" : "ghost"}
            className="shrink-0" onClick={() => onSelect(c.key)}>
            {c.label}
            {c.count != null && <span className={cn("ms-1.5 tabular-nums text-muted-foreground")}>{c.count}</span>}
          </Button>
        ))}
      </div>
    </OverflowScroller>
  );
}
