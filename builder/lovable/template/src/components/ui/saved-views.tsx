import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/** Named filter sets — "Today", "Unconfirmed". Counts where they are known. */
export function SavedViews({ views, active, onSelect, className }: {
  views: { key: string; label: string; count?: number }[];
  active?: string; onSelect: (key: string) => void; className?: string;
}) {
  return (
    <div data-slot="saved-views" className={cn("flex flex-wrap items-center gap-1", className)} role="group" aria-label="Views">
      {views.map((v) => (
        <Button key={v.key} size="sm" variant={active === v.key ? "secondary" : "ghost"}
          onClick={() => onSelect(v.key)}>
          {v.label}
          {v.count != null && <span className="ms-1.5 tabular-nums text-muted-foreground">{v.count}</span>}
        </Button>
      ))}
    </div>
  );
}
