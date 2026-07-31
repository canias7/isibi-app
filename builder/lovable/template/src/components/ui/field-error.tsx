import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The message under a field that failed.
 *
 * `role="alert"` is what makes it heard. A message that appears silently is
 * only an error to somebody watching that part of the screen — for anyone else
 * the form simply refuses to submit with no explanation, which is the single
 * most common accessibility failure in forms.
 *
 * It renders NOTHING when there is no message, so the caller can pass a
 * possibly-undefined error straight through without a ternary at every field.
 * Reserving the space instead would put a permanent empty line under every
 * input on the page.
 *
 * An ICON as well as the text, because the message sits in ordinary body colour
 * in this monochrome kit and would otherwise be indistinguishable from a hint.
 * The icon is `aria-hidden` — "alert circle" read before every message is noise.
 *
 * The id is what the input's `aria-describedby` points at, so it is a required
 * prop rather than generated: generated, the caller has nothing to point at and
 * the association silently does not exist.
 */
export function FieldError({ id, children, className }: {
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn("flex items-start gap-1.5 text-xs font-medium", className)}>
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
