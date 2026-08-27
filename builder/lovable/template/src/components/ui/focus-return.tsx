import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Says where focus went after something closed.
 *
 * Closing a dialog, deleting a row, finishing a wizard — each leaves focus
 * somewhere, and if nothing says where, a screen reader user is silently
 * relocated. The usual outcome is focus falling back to `<body>`, where the
 * next Tab starts from the top of the page and the reader has to walk the whole
 * interface again to get back.
 *
 * IT ANNOUNCES AND THEN GOES QUIET. The message is rendered into a live region
 * and cleared after a moment, because a permanent "Back on the services list"
 * is read out again on every unrelated update to the same region.
 *
 * `role="status"` and `aria-live="polite"` together: some screen readers honour
 * one and some the other, and the pair is what actually gets announced
 * everywhere.
 *
 * Visually hidden by default — this is information a sighted reader already has
 * from watching the dialog close.
 */
export function FocusReturn({ message, visible, clearAfterMs = 4000, className }: {
  /** Where focus landed — "Back on the services list". Empty says nothing. */
  message?: string;
  /** Show it on screen as well as announcing it. */
  visible?: boolean;
  clearAfterMs?: number;
  className?: string;
}) {
  const [shown, setShown] = React.useState(message ?? "");
  React.useEffect(() => {
    setShown(message ?? "");
    if (!message) return;
    const t = setTimeout(() => setShown(""), clearAfterMs);
    return () => clearTimeout(t);
  }, [message, clearAfterMs]);

  return (
    <p data-slot="focus-return" role="status" aria-live="polite"
      className={cn(visible ? "text-sm text-muted-foreground" : "sr-only", className)}>
      {shown}
    </p>
  );
}
