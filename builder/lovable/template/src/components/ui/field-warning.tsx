import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A caution under a field that does NOT block submitting.
 *
 * A WARNING IS NOT AN ERROR AND MUST NOT DRESS LIKE ONE. "That looks
 * like a PO box — couriers may refuse it" is information the person can
 * overrule; styling it like the errors teaches them that red text is
 * ignorable, which is the most expensive lesson a form can teach. So:
 * outline glyph, ordinary ink, and the submit button never gates on it.
 *
 * NOT `role="alert"` — an alert interrupts, and a warning that interrupts
 * on every keystroke is a nag. It ties to the field with
 * `aria-describedby` (the caller passes id), so it is read WITH the
 * field, in order, once.
 *
 * If the caller finds themselves wanting to block on it, it is an error
 * and belongs in the error path — the type name is the reminder.
 */
export function FieldWarning({ id, children, className }: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p data-slot="field-warning" id={id} className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
