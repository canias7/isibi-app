import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The bar that appears when rows are selected.
 *
 * Says the COUNT, because acting on "all" when you meant the visible page is the
 * expensive mistake this pattern causes.
 */
export function BulkActions({ count, onClear, actions, className }: {
  count: number; onClear?: () => void;
  actions: { label: string; onSelect: () => void; destructive?: boolean }[];
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2", className)}
      role="status">
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant={a.destructive ? "outline" : "secondary"}
            className={a.destructive ? "border-destructive/40 text-destructive hover:bg-destructive/10" : undefined}
            onClick={a.onSelect}>{a.label}</Button>
        ))}
        {onClear && <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>}
      </div>
    </div>
  );
}
