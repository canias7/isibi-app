import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Applied — undo" after an automated change, on a countdown.
 *
 * THE COUNTDOWN IS VISIBLE, and that is the whole difference between this and a
 * toast. An undo that vanishes silently makes somebody who looked away for four
 * seconds believe they missed their only chance; a number ticking down tells
 * them exactly how long they have, and whether to hurry.
 *
 * IT DOES NOT DISAPPEAR ON ITS OWN when `onExpire` is absent — it goes quiet
 * instead, leaving "Applied" on screen. A row that had a change applied to it
 * and now shows nothing at all is indistinguishable from a row nothing happened
 * to.
 *
 * `role="status"` and NOT `alert`: applying a change the person just asked for
 * is not an emergency, and `alert` interrupts whatever a screen reader was
 * saying — often the very content that just changed.
 *
 * The timer clears on unmount and restarts when the `seconds` prop changes, so
 * two changes in quick succession cannot leave a stale interval running.
 */
export function AiUndo({ message = "Applied", onUndo, seconds = 10, onExpire, className }: {
  message?: string;
  onUndo: () => void;
  /** Countdown length. Pass 0 for no countdown. */
  seconds?: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (!seconds) return;
    const t = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  // Out of the deps, and this one really fired twice: with `onExpire` in the
  // list, every parent render re-ran an effect whose condition was still
  // true, so the caller was told the undo had expired again and again.
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    if (seconds && left === 0) expireRef.current?.();
  }, [left, seconds]);
  const done = Boolean(seconds) && left === 0;
  return (
    <div role="status"
      className={cn("flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm", className)}>
      <span>{message}</span>
      {!done && (
        <button type="button" onClick={onUndo}
          className="ml-auto inline-flex items-center gap-1 font-medium underline underline-offset-2">
          <Undo2 className="size-3.5" aria-hidden="true" />
          Undo
          {Boolean(seconds) && <span className="tabular-nums text-muted-foreground">{left}s</span>}
        </button>
      )}
    </div>
  );
}
