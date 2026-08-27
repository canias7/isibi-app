import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The filters currently applied, each removable, with a clear-all.
 *
 * Filters that are only visible inside a dropdown are how somebody concludes
 * their data has vanished. Showing them as chips is the fix.
 */
export function FilterBar({ filters, onRemove, onClear, children, className }: {
  filters: { key: string; label: string }[];
  onRemove?: (key: string) => void; onClear?: () => void;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="filter-bar" className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {filters.map((f) => (
        <Badge key={f.key} variant="secondary" className="gap-1">
          {f.label}
          {onRemove && (
            <button type="button" aria-label={`Remove ${f.label}`} onClick={() => onRemove(f.key)}
              className="cursor-pointer"><X className="size-3" /></button>
          )}
        </Badge>
      ))}
      {filters.length > 0 && onClear && (
        <Button size="sm" variant="ghost" onClick={onClear}>Clear all</Button>
      )}
    </div>
  );
}
