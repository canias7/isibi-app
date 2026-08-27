import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The error message under one field, wired up properly.
 *
 * THREE THINGS TOGETHER OR IT DOES NOT WORK: a stable id the input points at
 * with `aria-describedby`, `aria-invalid` on the input, and `role="alert"` here.
 * Hand-written forms usually manage one of the three, which means the message is
 * visible and unannounced.
 *
 * IT SCROLLS ITSELF INTO VIEW on appearing. A validation error on a field two
 * screens up is the reason people press submit repeatedly — nothing visibly
 * happens, because the thing that happened is off-screen.
 *
 * Renders null when there is no error, so the layout does not reserve a gap that
 * shifts the moment one appears.
 */
export function ErrorAnchor({ message, id, scrollIntoView = true, className }: {
  message?: string | null;
  /** The id the input's aria-describedby points at. */
  id: string;
  scrollIntoView?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  React.useEffect(() => {
    if (message && scrollIntoView) ref.current?.scrollIntoView({ block: "nearest" });
  }, [message, scrollIntoView]);
  if (!message) return null;
  return (
    <p data-slot="error-anchor" ref={ref} id={id} role="alert" className={cn("text-sm font-medium", className)}>{message}</p>
  );
}
