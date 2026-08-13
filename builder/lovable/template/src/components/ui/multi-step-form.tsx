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
  // NO STEPS IS NOT A ZERO-STEP WIZARD, it is a wizard whose steps have not
  // arrived — `steps={sections.map((s) => s.name)}` is `[]` before the query
  // settles and on every site whose owner has added nothing yet. Rendered
  // anyway it read "Step 4 of 0" over a bar at Infinity% with an empty heading
  // and a button offering to Finish. `children` is `sections[current]` in the
  // same call, so it is undefined here too: nothing real is being hidden.
  if (!steps.length) return null;
  // `current` COMES FROM OUTSIDE — a URL search param, a stored draft — so it
  // can be past the end or negative, which blanks the heading and puts the bar
  // past full. Clamped into the range that exists rather than trusted.
  const at = Math.min(Math.max(0, Math.trunc(current) || 0), steps.length - 1);
  const last = at >= steps.length - 1;
  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Step {at + 1} of {steps.length}</p>
        <Progress value={((at + 1) / steps.length) * 100} className="h-1.5" />
        <h2 ref={head} tabIndex={-1} className="text-lg font-semibold outline-none">{steps[at]}</h2>
      </div>
      <div>{children}</div>
      <div className="flex items-center justify-between gap-3">
        {/* The CLAMPED index, or a `current` of -1 leaves Back enabled on the
            first step and the wizard offers to go somewhere that is not there. */}
        <Button variant="ghost" onClick={onBack} disabled={at === 0 || busy}>Back</Button>
        <Button disabled={busy || !canContinue} onClick={last ? onSubmit : onNext}>
          {busy ? "Working…" : nextLabel ?? (last ? "Finish" : "Continue")}
        </Button>
      </div>
    </div>
  );
}
