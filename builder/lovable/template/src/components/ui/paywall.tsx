import * as React from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Read this much free, then join.
 *
 * THE GATED CONTENT IS NOT IN THE DOM WHEN IT IS LOCKED, and that is the whole
 * design. The obvious implementation renders everything and hides the tail
 * under a gradient — which is defeated by scrolling the element, by reader
 * mode, by view-source, and by every crawler. So the two halves are separate
 * props: `preview` is what everybody gets, `children` is mounted only once
 * `unlocked` is true. If it is on the page, it was meant to be.
 *
 * That split is also why the fade is honest. It trails off the END of the
 * preview rather than pretending to cover something withheld.
 *
 * `remaining` is the metered case — "2 free articles left this month". The
 * COUNTING belongs to the caller: it is per-reader state with a reset window,
 * which is a data model, not a component. This displays whatever it is handed
 * and says nothing when handed nothing.
 *
 * Unlocked, it renders the children and NOTHING else — no wrapper, no border,
 * no leftover chrome. A reader who has paid should not be able to tell this
 * component was ever in the tree.
 */
export function Paywall({
  unlocked, preview, children, title = "Keep reading", message, remaining, action, secondary, className,
}: {
  unlocked?: boolean;
  /** The free portion. Always rendered. */
  preview?: React.ReactNode;
  /** The gated portion. Mounted only when `unlocked`. */
  children?: React.ReactNode;
  title?: string;
  message?: string;
  /** Free reads left, if this site meters. Omitted means it does not. */
  remaining?: number;
  action?: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  if (unlocked) return <>{children}</>;
  return (
    <div className={cn("flex flex-col", className)}>
      {preview ? (
        <div className="relative">
          {preview}
          <div aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
        </div>
      ) : null}
      <section aria-label={title}
        className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 px-6 py-8 text-center">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {message && <p className="max-w-prose text-sm text-muted-foreground text-balance">{message}</p>}
        {typeof remaining === "number" && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {remaining > 0
              ? `${remaining} free ${remaining === 1 ? "read" : "reads"} left`
              : "You have used your free reads"}
          </p>
        )}
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {action && (
            <Button asChild={!!action.href} onClick={action.onClick}>
              {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
            </Button>
          )}
          {secondary && (
            <Button variant="outline" asChild={!!secondary.href} onClick={secondary.onClick}>
              {secondary.href ? <a href={secondary.href}>{secondary.label}</a> : <span>{secondary.label}</span>}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
