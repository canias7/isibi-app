import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The thing is not here — and here is where to go instead.
 *
 * A 404 WITH NO ROUTE OUT IS A DEAD END, and the back button is not one: people
 * arrive at these from a search result or an old link, so there is nothing
 * behind them. Suggestions are the whole component.
 *
 * IT DOES NOT SAY "404". The number means nothing to most readers and everything
 * it does say is already in the sentence above it.
 *
 * `searched` echoes what was looked for, because half of these are typos and
 * seeing the term back is what reveals it — far more useful than a generic
 * apology.
 */
export function NotFoundPanel({ what = "page", searched, suggestions, action, className }: {
  what?: string;
  /** What they were looking for, echoed back. */
  searched?: string;
  suggestions?: { label: string; href: string }[];
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <section aria-label="Not found" className={cn("flex flex-col items-start gap-3 rounded-md border border-border p-6", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">That {what} isn&apos;t here</h2>
        <p className="text-sm text-muted-foreground">
          {searched ? <>Nothing matches “{searched}”. It may have moved or been removed.</> : "It may have moved or been removed."}
        </p>
      </div>
      {suggestions?.length ? (
        <div className="text-sm">
          <p className="mb-1 font-medium">Try one of these</p>
          <ul className="flex flex-col gap-0.5">
            {suggestions.map((s) => (
              <li key={s.href}><a href={s.href} className="underline underline-offset-4">{s.label}</a></li>
            ))}
          </ul>
        </div>
      ) : null}
      {action && (
        <Button size="sm" asChild={!!action.href} onClick={action.onClick}>
          {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
        </Button>
      )}
    </section>
  );
}
