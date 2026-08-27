import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The whole form, held while it submits.
 *
 * A `<fieldset disabled>`, which is the one thing in HTML that disables every
 * control inside it in a single attribute — including ones added later, and
 * including the submit button. Reaching into children to disable each is what
 * every hand-rolled version does, and it misses whatever it was not told about.
 *
 * `aria-busy` on the wrapper is what tells assistive technology something is in
 * flight; visually greying out the form says nothing to somebody not looking at
 * it.
 *
 * It does NOT cover the form with a spinner overlay. The values stay readable
 * while the save is in flight, which matters when it fails and somebody has to
 * decide whether to retry — an overlay hides the very thing they need to see.
 *
 * Note `fieldset[disabled]` also stops the browser SUBMITTING those fields, so
 * this is for a JavaScript submit, not a plain HTML post.
 */
export function FormLock({ locked, children, message, className }: {
  locked: boolean;
  children: React.ReactNode;
  message?: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset data-slot="form-lock" disabled={locked} aria-busy={locked || undefined}
      className={cn("min-w-0 border-0 p-0 transition-opacity", locked && "opacity-60", className)}>
      {children}
      {locked && message ? (
        <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">{message}</p>
      ) : null}
    </fieldset>
  );
}
