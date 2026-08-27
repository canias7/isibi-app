import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * The checkbox cell of a selectable table.
 *
 * `label` is required and visually hidden: a column of unlabelled checkboxes is
 * read out as "checkbox, checkbox, checkbox" and nobody can tell which row they
 * are about to act on.
 */
export function RowSelect({ checked, onCheckedChange, label, className }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label: string; className?: string;
}) {
  return (
    <div data-slot="row-select" className={cn("flex items-center", className)}>
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-label={`Select ${label}`} />
    </div>
  );
}
