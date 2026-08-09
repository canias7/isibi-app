import * as React from "react";
import { Loader } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The full-screen "please wait" that stops everything.
 *
 * USE IT ALMOST NEVER. Blocking the whole interface is right for exactly one
 * situation: something is in flight that would be corrupted by a second action,
 * and there is nothing else useful to do. For a save, `form-lock` is the right
 * answer; for a background job, `progress-toast` is. This is a last resort and
 * the header says so because a component this easy to reach for gets reached
 * for.
 *
 * It says WHAT it is waiting for. A featureless spinner over a greyed page is
 * indistinguishable from a hang, and a hang is what people assume after four
 * seconds.
 *
 * There is a WAY OUT after a while. Anything that can block the whole interface
 * can also fail to unblock it — a promise that never settles, a socket that
 * dropped — and without an escape the only remedy is a reload, which loses
 * everything. The button appears on a timer rather than immediately, so it is
 * not an invitation to interrupt a normal wait.
 *
 * Focus is moved onto the overlay, or a keyboard user tabs through a page they
 * cannot see or use.
 */
export function BlockingOverlay({ show, message, detail, onCancel, cancelAfter = 8000, className }: {
  show: boolean;
  message: React.ReactNode;
  detail?: React.ReactNode;
  onCancel?: () => void;
  cancelAfter?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [canCancel, setCanCancel] = React.useState(false);

  React.useEffect(() => {
    if (!show) { setCanCancel(false); return; }
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = onCancel ? setTimeout(() => setCanCancel(true), cancelAfter) : null;
    return () => {
      document.body.style.overflow = prev;
      if (t) clearTimeout(t);
    };
  }, [show, onCancel, cancelAfter]);

  if (!show) return null;

  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-live="assertive"
      aria-busy="true"
      tabIndex={-1}
      className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-popover/90 p-6 text-center outline-none", className)}
    >
      <Loader aria-hidden className="size-5 motion-safe:animate-spin" />
      <p className="text-sm font-medium">{message}</p>
      {detail ? <p className="max-w-sm text-xs text-muted-foreground">{detail}</p> : null}
      {canCancel && onCancel ? (
        <button type="button" onClick={onCancel}
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Taking too long? Stop waiting
        </button>
      ) : null}
    </div>
  );
}
