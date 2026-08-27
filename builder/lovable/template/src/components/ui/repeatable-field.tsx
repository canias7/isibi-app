import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Add another" — a list of the same field repeated.
 *
 * Rows are rendered by INDEX from the caller's own array, and the remove
 * button names the row it removes. Two things fall out of that: the caller
 * keeps a stable key, and "Remove guest 2" is unambiguous where four
 * identical X buttons are not.
 *
 * The last row cannot be removed when `min` is 1, which is the usual case —
 * a form with zero of its own repeated field is a state nothing handles.
 */
export function RepeatableField({ label, count, min = 1, max = 10, addLabel, onAdd, onRemove, children, className }: {
  label: string; count: number; min?: number; max?: number; addLabel?: string;
  onAdd: () => void; onRemove: (index: number) => void;
  children: (index: number) => React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="repeatable-field" className={cn("space-y-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{children(i)}</div>
          {count > min && (
            <Button type="button" size="icon-sm" variant="ghost" className="mt-6"
              onClick={() => onRemove(i)} aria-label={`Remove ${label} ${i + 1}`}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {count < max && (
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="size-4" />{addLabel ?? `Add another ${label.toLowerCase()}`}
        </Button>
      )}
    </div>
  );
}
