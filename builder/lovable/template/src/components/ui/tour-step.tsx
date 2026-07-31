import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/** One step of a walkthrough, with its position and a way out. */
export function TourStep({ step, total, title, children, onNext, onSkip, className }: {
  step: number; total: number; title: string; children?: React.ReactNode;
  onNext?: () => void; onSkip?: () => void; className?: string;
}) {
  return (
    <div className={cn("w-72 rounded-lg border bg-popover p-4 shadow-md", className)} role="dialog" aria-label={title}>
      <div className="text-xs tabular-nums text-muted-foreground">Step {step} of {total}</div>
      <div className="mt-1 font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      <div className="mt-3 flex items-center justify-between">
        {onSkip ? <Button size="sm" variant="ghost" onClick={onSkip}>Skip</Button> : <span />}
        {onNext && <Button size="sm" onClick={onNext}>{step === total ? "Done" : "Next"}</Button>}
      </div>
    </div>
  );
}
