import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A step in a product tour, pointing at something on the page.
 *
 * "SKIP" IS AS PROMINENT AS "NEXT", and it is on every step. A tour that can
 * only be finished is a tour people abandon by reloading the page — which loses
 * the state they were in — and the ones who wanted it are not put off by an
 * escape hatch.
 *
 * The step count is stated. "Next" with no denominator gives no way to judge
 * whether this is worth two more taps or eleven, and eleven is what makes
 * somebody leave.
 *
 * It RE-MEASURES EVERY FRAME while it is open, which sounds wasteful and is
 * the only thing that works. Two cheaper versions were tried and measured
 * failing on the same page: listening for scroll and resize left the ring 34
 * pixels above its button when a banner appeared a moment after load, and a
 * `ResizeObserver` did not help either — the button MOVED, it did not change
 * size, and that observer only fires on size. Positioning libraries fall back
 * to exactly this for the same reason.
 *
 * The cost is one `getBoundingClientRect` per frame, for the few seconds a tour
 * step is on screen, and the box is compared before it is stored so an
 * unchanged position causes no re-render at all.
 *
 * If the target is not on the page it renders NOTHING rather than floating in
 * the corner. A tour step about a button that a particular account does not
 * have is worse than a missing step.
 */
export function CoachMark({
  targetRef, open, step, total, title, children, onNext, onBack, onSkip, className,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  step: number;
  total: number;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  className?: string;
}) {
  const [box, setBox] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = targetRef.current?.getBoundingClientRect() ?? null;
      setBox((old) =>
        old && r && old.top === r.top && old.left === r.left && old.width === r.width && old.height === r.height
          ? old
          : r);
    };
    measure();
    if (typeof requestAnimationFrame === "undefined") return;
    let frame = requestAnimationFrame(function tick() {
      measure();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, targetRef, step]);

  if (!open || !box) return null;

  return (
    <>
      <div aria-hidden
        style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
        className="pointer-events-none fixed z-50 rounded-lg outline-2 outline-offset-2 outline-foreground" />
      <div
        role="dialog"
        aria-label={typeof title === "string" ? title : `Step ${step} of ${total}`}
        style={{ top: box.bottom + 14, left: Math.max(12, Math.min(box.left, window.innerWidth - 312)) }}
        className={cn("fixed z-50 flex w-72 flex-col gap-2 rounded-lg border border-border bg-background p-3 shadow-xl", className)}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {title ? <p className="text-sm font-semibold">{title}</p> : null}
            {children ? <p className="mt-0.5 text-xs text-muted-foreground">{children}</p> : null}
          </div>
          {onSkip ? (
            <button type="button" onClick={onSkip} aria-label="Skip the tour"
              className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">{step} of {total}</span>
          <span className="flex-1" />
          {onSkip ? (
            <button type="button" onClick={onSkip}
              className="cursor-pointer text-xs underline underline-offset-2">Skip</button>
          ) : null}
          {onBack && step > 1 ? (
            <button type="button" onClick={onBack}
              className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Back</button>
          ) : null}
          {onNext ? (
            <button type="button" onClick={onNext}
              className="cursor-pointer rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90">
              {step === total ? "Done" : "Next"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
