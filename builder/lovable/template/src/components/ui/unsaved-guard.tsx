import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Stops the tab closing on top of unsaved work.
 *
 * `beforeunload` is the only hook a browser gives for this, and it comes with
 * rules worth knowing: the browser writes its own wording and IGNORES any
 * message passed to it, and it only fires at all if the reader has interacted
 * with the page. So the prop is `dirty` and not a message — a message argument
 * would be a lie about what this can control.
 *
 * The listener is REMOVED as soon as `dirty` goes false. Left attached, a form
 * that has just saved successfully still nags on the way out, which trains
 * people to click through the dialog without reading it — at which point it
 * protects nothing.
 *
 * It also renders a visible line, because the dialog only covers closing the
 * tab. In-app navigation is the router's business and gets no browser prompt at
 * all, so without something on the page the reader has no warning for the far
 * more common way of leaving.
 */
export function UnsavedGuard({ dirty, note = "You have unsaved changes.", silent, className }: {
  dirty: boolean;
  note?: string;
  /** Guard the tab, show nothing on the page. */
  silent?: boolean;
  className?: string;
}) {
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (!dirty || silent) return null;
  return (
    <p role="status" className={cn("text-sm text-muted-foreground", className)}>{note}</p>
  );
}
