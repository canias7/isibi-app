import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The screen somebody sees once, before there is anything to look at.
 *
 * IT OFFERS A WAY TO SKIP, always. An onboarding with no exit is the fastest way
 * to lose somebody who already knows what they are doing — and the people most
 * likely to pay are the ones most likely to have used something similar.
 *
 * ONE PRIMARY ACTION. A first-run screen with four equally weighted buttons is a
 * decision, and a decision is exactly what somebody with an empty account cannot
 * make yet.
 *
 * `sample` is offered separately because "show me with example data" is a
 * genuinely different route from "set it up properly", and conflating them is
 * how people end up with a live site full of demo content.
 */
export function FirstRunPanel({ title, blurb, primary, sample, onSkip, className }: {
  title: string; blurb?: string;
  primary: { label: string; href?: string; onClick?: () => void };
  sample?: { label: string; onClick: () => void };
  onSkip?: () => void;
  className?: string;
}) {
  return (
    <section data-slot="first-run-panel" aria-label={title}
      className={cn("flex flex-col items-start gap-3 rounded-md border border-border p-6", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {blurb && <p className="max-w-prose text-sm text-muted-foreground">{blurb}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild={!!primary.href} onClick={primary.onClick}>
          {primary.href ? <a href={primary.href}>{primary.label}</a> : <span>{primary.label}</span>}
        </Button>
        {sample && <Button variant="outline" onClick={sample.onClick}>{sample.label}</Button>}
        {onSkip && (
          <button type="button" onClick={onSkip}
            className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4">Skip for now</button>
        )}
      </div>
    </section>
  );
}
