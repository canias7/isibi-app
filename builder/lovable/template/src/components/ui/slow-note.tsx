import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "This is taking longer than usual."
 *
 * It appears only after `afterMs` — 4 seconds by default — so a fast request
 * never shows it. The point is the difference between a page that is working
 * and a page that has hung: without it, three seconds of spinner and thirty
 * seconds of spinner look identical and people reload, which starts the slow
 * request again.
 */
export function SlowNote({ loading, afterMs = 4000, message, className }: {
  loading: boolean; afterMs?: number; message?: string; className?: string;
}) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!loading) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), afterMs);
    return () => clearTimeout(t);
  }, [loading, afterMs]);
  if (!show) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)} aria-live="polite">
      {message ?? "This is taking longer than usual — still working."}
    </p>
  );
}
