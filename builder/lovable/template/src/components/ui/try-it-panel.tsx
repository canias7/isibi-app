import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A safe place to have a go before doing it for real.
 *
 * IT SAYS NOTHING WILL BE SENT, prominently. The reason people do not try a
 * feature is fear of the consequence — mailing a customer, taking a payment,
 * publishing — and a sandbox whose safety is not stated is a sandbox nobody
 * trusts enough to use.
 *
 * THE RESET IS VISIBLE, because knowing you can start over is most of what makes
 * experimenting feel safe.
 *
 * `realAction` sits alongside, so the path from practice to doing it properly is
 * one press. A practice mode with no exit is a dead end that has to be navigated
 * out of.
 */
export function TryItPanel({ title = "Try it", safeNote = "Nothing is sent and nobody is charged.", children, onReset, realAction, className }: {
  title?: string;
  safeNote?: string;
  children?: React.ReactNode;
  onReset?: () => void;
  realAction?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <section data-slot="try-it-panel" aria-label={title}
      className={cn("flex flex-col gap-3 rounded-md border border-dashed border-border p-4", className)}>
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{safeNote}</p>
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        {realAction && (
          <Button size="sm" asChild={!!realAction.href} onClick={realAction.onClick}>
            {realAction.href ? <a href={realAction.href}>{realAction.label}</a> : <span>{realAction.label}</span>}
          </Button>
        )}
        {onReset && (
          <button type="button" onClick={onReset}
            className="cursor-pointer text-xs underline underline-offset-4">Start over</button>
        )}
      </div>
    </section>
  );
}
