import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Rows2, Rows3, Rows4 } from "lucide-react";
import { cn } from "@/lib/utils";
export type ListDensityValue = "compact" | "normal" | "roomy";
/**
 * Row height for a LIST, and the classes that go with it.
 *
 * `density-toggle` is the table version and this is the list one; they are
 * separate because the padding a table row wants and the padding a list row
 * wants are different numbers, and one component covering both ends up
 * correct for neither.
 *
 * The classes are exported alongside the control so a list and its toggle
 * cannot disagree about what "compact" means.
 */
export const LIST_DENSITY: Record<ListDensityValue, string> = {
  compact: "py-1.5 text-sm",
  normal: "py-3 text-sm",
  roomy: "py-5 text-base",
};
export function ListDensity({ value, onChange, className }: {
  value: ListDensityValue; onChange: (v: ListDensityValue) => void; className?: string;
}) {
  return (
    <ToggleGroup type="single" value={value} size="sm" className={cn(className)}
      onValueChange={(v) => { if (v) onChange(v as ListDensityValue); }} aria-label="Row height">
      <ToggleGroupItem value="compact" aria-label="Compact rows"><Rows4 className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="normal" aria-label="Normal rows"><Rows3 className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="roomy" aria-label="Roomy rows"><Rows2 className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  );
}
