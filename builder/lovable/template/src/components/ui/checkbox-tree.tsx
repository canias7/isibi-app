import { TreeSelect, type TreeNode } from "@/components/ui/tree-select";
import { cn } from "@/lib/utils";
/**
 * A tree of checkboxes with a count and a clear-all.
 *
 * `tree-select` is the control; this is the panel around it — the header that
 * says how many are ticked and the way to undo it all in one press.
 *
 * That count matters more than it looks: a collapsed tree can hide forty
 * ticked boxes, and without a total nobody can tell a filter is on.
 */
export function CheckboxTree({ nodes, value, onChange, label, className }: {
  nodes: TreeNode[]; value: string[]; onChange: (v: string[]) => void;
  label?: string; className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-xs font-medium">
          {label ?? "Filter"}
          {value.length > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground">{value.length} selected</span>}
        </p>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        <TreeSelect nodes={nodes} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
