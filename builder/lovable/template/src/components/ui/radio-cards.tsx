import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Radios as pickable cards.
 *
 * Still a real RadioGroup underneath, so arrow keys work — the usual
 * div-with-onClick version is unreachable by keyboard.
 */
export function RadioCards({ options, value, onChange, columns = 2, className }: {
  options: { value: string; label: string; description?: string }[];
  value?: string; onChange: (v: string) => void; columns?: 1 | 2 | 3; className?: string;
}) {
  const c = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];
  return (
    <RadioGroup value={value} onValueChange={onChange} className={cn("grid gap-2", c, className)}>
      {options.map((o) => (
        <Label key={o.value} htmlFor={"rc-" + o.value}
          className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
            value === o.value && "border-foreground bg-muted/50")}>
          <RadioGroupItem id={"rc-" + o.value} value={o.value} className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{o.label}</span>
            {o.description && <span className="text-xs text-muted-foreground">{o.description}</span>}
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}
