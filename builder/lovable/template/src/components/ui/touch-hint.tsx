import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * "Swipe to see more" — the gesture hint, shown only where the gesture exists.
 *
 * AN UNDISCOVERABLE GESTURE IS AN ABSENT FEATURE. A horizontally scrolling row
 * that fits neatly on screen gives no sign there is anything to the right, and
 * on touch there is no scrollbar to reveal it. This is the one line that turns
 * a hidden half of the content into a visible one.
 *
 * IT DISAPPEARS THE FIRST TIME THE GESTURE IS USED, which is what stops it
 * being clutter. A permanent "swipe" label under every carousel is noise after
 * the first second; the hint has done its job the moment somebody scrolls.
 *
 * COARSE POINTER ONLY. On a desktop the gesture is a scrollbar or a wheel, and
 * "swipe" is meaningless — the same class of mistake as telling somebody at a
 * desk to rotate their monitor.
 *
 * `aria-hidden`, because a screen reader user does not scroll by swiping and
 * announcing a visual affordance is noise. The scrollable region itself needs a
 * proper label from the caller — that is what carries the meaning for them.
 */
export function TouchHint({ message = "Swipe to see more", onUsed, className }: {
  message?: string;
  /** Called the first time the hint is dismissed by use. */
  onUsed?: () => void;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    setShow(true);
    const hide = () => { setShow(false); onUsed?.(); };
    window.addEventListener("touchmove", hide, { once: true, passive: true });
    return () => window.removeEventListener("touchmove", hide);
  }, [onUsed]);
  if (!show) return null;
  return (
    <p aria-hidden="true" className={cn("text-xs text-muted-foreground", className)}>
      {message}
    </p>
  );
}
