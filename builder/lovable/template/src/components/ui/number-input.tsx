import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/** A number field. Clamped on change, so the value can never leave its range. */
export function NumberInput({ value, onChange, min, max, step = 1, id, className }: {
  value: number | ""; onChange: (n: number | "") => void;
  min?: number; max?: number; step?: number; id?: string; className?: string;
}) {
  return (
    <Input id={id} type="number" inputMode="numeric" value={value} min={min} max={max} step={step}
      className={cn("tabular-nums", className)}
      onChange={(e) => {
        if (e.target.value === "") return onChange("");
        let n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        onChange(n);
      }} />
  );
}
