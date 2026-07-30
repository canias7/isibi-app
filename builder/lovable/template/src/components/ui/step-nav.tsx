import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/** Back and Continue for a multi-step form. Continue carries the weight. */
export function StepNav({ onBack, onNext, backLabel = "Back", nextLabel = "Continue",
  nextDisabled, busy, className }: {
  onBack?: () => void; onNext?: () => void; backLabel?: string; nextLabel?: string;
  nextDisabled?: boolean; busy?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t pt-4", className)}>
      {onBack ? <Button type="button" variant="ghost" onClick={onBack}>{backLabel}</Button> : <span />}
      <Button type="button" onClick={onNext} disabled={nextDisabled || busy}>{nextLabel}</Button>
    </div>
  );
}
