import * as React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
/**
 * The shell around a form split over several screens.
 *
 * Back is always available and never a browser-back instruction — a wizard
 * that relies on the browser's own back button loses everything typed, every
 * time, and people press it anyway.
 *
 * The heading is re-focused on each step, which is what tells a screen reader
 * the page changed. Without it a wizard is silent: the visible content swaps
 * and nothing is announced at all.
 */
export function MultiStepForm({ steps, current, onBack, onNext, onSubmit, nextLabel, busy, canContinue = true, children, className }: {
  steps: string[]; current: number; onBack?: () => void; onNext?: () => void;
  onSubmit?: () => void; nextLabel?: string; busy?: boolean; canContinue?: boolean;
  children?: React.ReactNode; className?: string;
}) {
  const head = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { head.current?.focus(); }, [current]);
  const last = current >= steps.length - 1;
  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Step {current + 1} of {steps.length}</p>
        <Progress value={((current + 1) / steps.length) * 100} className="h-1.5" />
        <h2 ref={head} tabIndex={-1} className="text-lg font-semibold outline-none">{steps[current]}</h2>
      </div>
      <div>{children}</div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={current === 0 || busy}>Back</Button>
        <Button disabled={busy || !canContinue} onClick={last ? onSubmit : onNext}>
          {busy ? "Working…" : nextLabel ?? (last ? "Finish" : "Continue")}
        </Button>
      </div>
    </div>
  );
}
