import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A number with buttons. Clamped, so the value can never leave its range. */
export function QuantityInput({
  value, onChange, min = 1, max = 99, className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
  return (
    <div data-slot="quantity-input" className={cn("flex items-center gap-1", className)}>
      <Button type="button" size="icon-sm" variant="outline" aria-label="Fewer"
        disabled={value <= min} onClick={() => set(value - 1)}><Minus /></Button>
      <Input type="number" inputMode="numeric" value={value} min={min} max={max}
        onChange={(e) => set(parseInt(e.target.value, 10))}
        className="h-8 w-14 text-center tabular-nums" aria-label="Quantity" />
      <Button type="button" size="icon-sm" variant="outline" aria-label="More"
        disabled={value >= max} onClick={() => set(value + 1)}><Plus /></Button>
    </div>
  );
}
