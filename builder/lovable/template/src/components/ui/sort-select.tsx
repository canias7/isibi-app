import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/** Sort order for a list. A plain select, because six orderings is not a menu worth building. */
export function SortSelect({ value, onChange, options, id = "sort", className }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; id?: string; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">Sort</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-auto text-xs">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}
