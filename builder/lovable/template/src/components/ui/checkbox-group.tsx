import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/** Several checkboxes as one value. A real fieldset, so the group has a name. */
export function CheckboxGroup({ legend, options, value, onChange, columns = 1, className }: {
  legend?: string; options: { value: string; label: string; hint?: string }[];
  value: string[]; onChange: (next: string[]) => void; columns?: 1 | 2; className?: string;
}) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset data-slot="checkbox-group" className={className}>
      {legend && <legend className="mb-2 text-sm font-medium">{legend}</legend>}
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => (
          <div key={o.value} className="flex items-start gap-2">
            <Checkbox id={"cg-" + o.value} checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
            <div className="grid gap-0.5">
              <Label htmlFor={"cg-" + o.value} className="font-normal">{o.label}</Label>
              {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
