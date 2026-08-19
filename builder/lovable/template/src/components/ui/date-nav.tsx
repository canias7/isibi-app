import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Previous / Today / Next above a calendar.
 *
 * Today is a button and not a label, and it stays enabled on today's own
 * page: it is also how somebody gets back after paging six months out, and
 * disabling it there is disabling the escape hatch.
 */
export function DateNav({ label, onPrev, onNext, onToday, unit = "day", className }: {
  label: string; onPrev: () => void; onNext: () => void; onToday?: () => void;
  unit?: "day" | "week" | "month"; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button size="icon-sm" variant="outline" onClick={onPrev} aria-label={`Previous ${unit}`}>
        <ChevronLeft className="size-4" />
      </Button>
      <Button size="icon-sm" variant="outline" onClick={onNext} aria-label={`Next ${unit}`}>
        <ChevronRight className="size-4" />
      </Button>
      {onToday && <Button size="sm" variant="outline" onClick={onToday}>Today</Button>}
      <h2 className="ms-1 text-sm font-medium" aria-live="polite">{label}</h2>
    </div>
  );
}
