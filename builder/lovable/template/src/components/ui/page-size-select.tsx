import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/** Rows per page. Sits beside a pager, so it is labelled inline rather than above. */
export function PageSizeSelect({ value, onChange, options = [10, 25, 50, 100], id = "page-size", className }: {
  value: number; onChange: (n: number) => void; options?: number[]; id?: string; className?: string;
}) {
  return (
    <div data-slot="page-size-select" className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">Rows</Label>
      <NativeSelect id={id} value={String(value)} onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-auto text-xs">
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </NativeSelect>
    </div>
  );
}
