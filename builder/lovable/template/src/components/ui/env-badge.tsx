import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Staging" — the marker that stops somebody doing a real thing in the wrong
 * place.
 *
 * PRODUCTION RENDERS NOTHING. That is deliberate and it is the whole design: a
 * badge on every environment is a badge nobody reads, and the value here is
 * entirely in the surprise of seeing one. The absence of a badge is what
 * production looks like.
 *
 * It is `role="status"` and permanently visible, not a toast. Somebody arrives
 * on a staging tab an hour after opening it, and a notification that appeared
 * once is long gone by the time they type into a form.
 *
 * The name is shown VERBATIM, whatever it is. A team that calls it "preprod" or
 * "sandbox-2" means something specific by that, and normalising it into three
 * blessed words loses the distinction that made them name it.
 *
 * `bar` puts it across the top of the viewport, which is the right answer for
 * anything where a mistaken action is expensive — it cannot be scrolled past
 * or covered by a modal.
 */
export function EnvBadge({ env, production = "production", bar, note, className }: {
  env: string;
  production?: string;
  bar?: boolean;
  note?: React.ReactNode;
  className?: string;
}) {
  if (!env || env.toLowerCase() === production.toLowerCase()) return null;

  if (bar) {
    return (
      <div role="status"
        className={cn("sticky top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-3 py-1 text-center text-xs font-medium text-background", className)}>
        <span className="uppercase">{env}</span>
        {note ? <span className="font-normal opacity-80">{note}</span> : null}
      </div>
    );
  }
  return (
    <span role="status"
      className={cn("inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium tracking-wide text-background uppercase", className)}>
      {env}
      {note ? <span className="font-normal normal-case opacity-80">{note}</span> : null}
    </span>
  );
}
