import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/** How many people. Buttons up to a point, then a "more" that means call us. */
export function PartySize({ max = 8, value, onChange, onMore, className }: {
  max?: number; value?: number | null; onChange: (n: number) => void;
  onMore?: () => void; className?: string;
}) {
  return (
    <div data-slot="party-size" className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Party size">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <Button key={n} type="button" size="icon-sm" variant={value === n ? "default" : "outline"}
          onClick={() => onChange(n)} className="tabular-nums"
          aria-label={`${n} ${n === 1 ? "person" : "people"}`}>{n}</Button>
      ))}
      {onMore && <Button type="button" size="sm" variant="ghost" onClick={onMore}>{max}+</Button>}
    </div>
  );
}
