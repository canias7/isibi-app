import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Badges in a row, optionally filterable. */
export function TagList({ items, active, onSelect, className }: {
  items: string[];
  active?: string | null;
  onSelect?: (tag: string | null) => void;
  className?: string;
}) {
  return (
    <div data-slot="tag-list" className={cn("flex flex-wrap gap-2", className)}>
      {items.map((t) => {
        const on = active === t;
        return onSelect ? (
          <button key={t} type="button" className="cursor-pointer" onClick={() => onSelect(on ? null : t)} aria-pressed={on}>
            <Badge variant={on ? "default" : "secondary"}>{t}</Badge>
          </button>
        ) : (
          <Badge key={t} variant="secondary">{t}</Badge>
        );
      })}
    </div>
  );
}
