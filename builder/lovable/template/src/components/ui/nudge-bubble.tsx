import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A small unrequested suggestion — "you can drag these to reorder".
 *
 * IT APPEARS ONCE AND STAYS DISMISSED, keyed by name like `hint-dot`. A
 * suggestion that returns is an advertisement, and the second showing is where
 * goodwill is spent.
 *
 * It NEVER covers the thing it is about. Anchored above or below with a small
 * arrow, and it does not take pointer events on anything but its own close
 * button, so the feature being suggested stays usable while the suggestion is
 * on screen. A nudge that blocks the button it recommends is the joke version
 * of this pattern.
 *
 * It waits a beat before appearing. Arriving in the same frame as the page it
 * belongs to, it is part of the loading noise and gets closed without being
 * read.
 *
 * `role="status"`, so it is announced when it arrives and never interrupts.
 */
export function NudgeBubble({
  name, children, side = "bottom", delay = 900, onDismiss, className,
}: {
  name?: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  delay?: number;
  onDismiss?: () => void;
  className?: string;
}) {
  const [gone, setGone] = React.useState(true);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    let dismissed = false;
    try { dismissed = !!name && localStorage.getItem(`nudge:${name}`) === "1"; }
    catch { dismissed = false; }
    setGone(dismissed);
    if (dismissed) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [name, delay]);

  const close = () => {
    setShown(false);
    setGone(true);
    try { if (name) localStorage.setItem(`nudge:${name}`, "1"); } catch { /* private mode */ }
    onDismiss?.();
  };

  if (gone || !shown) return null;

  return (
    <span
      role="status"
      className={cn("motion-enter pointer-events-none absolute left-0 z-40 w-56",
        side === "bottom" ? "top-full mt-2" : "bottom-full mb-2", className)}
    >
      <span className="pointer-events-auto flex items-start gap-2 rounded-lg border border-border bg-popover p-2.5 shadow-lg">
        <span className="min-w-0 flex-1 text-xs">{children}</span>
        <button type="button" onClick={close} aria-label="Got it"
          className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X aria-hidden className="size-3" />
        </button>
      </span>
    </span>
  );
}
