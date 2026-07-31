import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The counterpart to `field-error` — confirmation under a field that passed.
 *
 * It is for fields where the answer was genuinely IN DOUBT: a username that had
 * to be checked against the server, a discount code that had to be looked up, a
 * postcode that resolved to a real address. On an ordinary text field this is
 * clutter, and a form where every filled field sprouts a green tick trains
 * people to ignore the ticks, which is a problem when one of them matters.
 *
 * `aria-live="polite"`, never `role="alert"`. Alert interrupts whatever is
 * being read; a confirmation is not worth interrupting for, and it arrives
 * while somebody is still typing in the next field.
 *
 * It renders nothing when empty, for the same reason `field-error` does.
 */
export function FieldSuccess({ id, children, className }: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} aria-live="polite" className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Check aria-hidden className="mt-px size-3.5 shrink-0 text-foreground" />
      <span>{children}</span>
    </p>
  );
}
