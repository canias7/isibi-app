import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Rows2, Rows3, Rows4 } from "lucide-react";
import { cn } from "@/lib/utils";
export type Density = "compact" | "normal" | "roomy";
/** Row height. Three steps, because two is not enough choice and five is a menu. */
export function DensityToggle({ value, onChange, className }: {
  value: Density; onChange: (d: Density) => void; className?: string;
}) {
  return (
    <ToggleGroup type="single" value={value} size="sm" className={cn(className)}
      onValueChange={(v) => { if (v) onChange(v as Density); }}>
      <ToggleGroupItem value="compact" aria-label="Compact rows"><Rows4 className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="normal" aria-label="Normal rows"><Rows3 className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="roomy" aria-label="Roomy rows"><Rows2 className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  );
}
/** The padding each density means, so a table and its toggle cannot disagree. */
export const DENSITY_CLASS: Record<Density, string> = {
  compact: "py-1",
  normal: "py-2.5",
  roomy: "py-4",
};
