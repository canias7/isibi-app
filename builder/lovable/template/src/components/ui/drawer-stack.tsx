import * as React from "react";
import { ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Bottom sheets stacked on a phone — the touch counterpart to `sheet-stack`.
 *
 * IT HAS A DRAG HANDLE AND SWIPE-DOWN TO DISMISS, because on a phone that is
 * the gesture people try first and a sheet that only closes by a small X in the
 * corner feels stuck. The handle is also a real button, so the gesture is not
 * the only way.
 *
 * DISMISS IS ON RELEASE PAST A THRESHOLD, never during the drag. Closing as the
 * finger passes a line means a scroll that starts near the top of the sheet
 * throws it away mid-read.
 *
 * Each sheet is `max-h-[85vh]`, never full height, so the layer underneath
 * stays visible. That strip is the only thing telling somebody there is
 * something behind this and that Back exists.
 *
 * Only the top sheet is interactive; the rest are `inert`, or a tab walks into
 * a panel the reader cannot see. Same rule as `sheet-stack`.
 */
export function DrawerStack({ sheets, onBack, onCloseAll, className }: {
  sheets: { id: string; title?: React.ReactNode; content: React.ReactNode }[];
  onBack: () => void;
  onCloseAll: () => void;
  className?: string;
}) {
  const [drag, setDrag] = React.useState(0);
  const start = React.useRef<number | null>(null);
  const top = sheets.length - 1;

  React.useEffect(() => {
    if (sheets.length === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onBack(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheets.length, onBack]);

  if (sheets.length === 0) return null;

  return (
    <>
      <div aria-hidden onClick={onCloseAll} className="fixed inset-0 z-40 bg-foreground/50" />
      {sheets.map((s, i) => (
        <div
          key={s.id}
          role="dialog"
          aria-modal={i === top}
          aria-label={typeof s.title === "string" ? s.title : undefined}
          {...(i === top ? {} : { inert: true })}
          style={{
            zIndex: 41 + i,
            transform: i === top ? `translateY(${drag}px)` : `translateY(${(top - i) * -8}px) scale(${1 - (top - i) * 0.02})`,
          }}
          className={cn("fixed inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-popover shadow-xl",
            i !== top && "opacity-70", drag === 0 && "transition-transform", className)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onCloseAll}
            onPointerDown={(e) => { start.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (start.current != null) setDrag(Math.max(0, e.clientY - start.current)); }}
            onPointerUp={() => {
              // Only on release, or a scroll near the top throws the sheet away.
              if (drag > 90) onBack();
              start.current = null;
              setDrag(0);
            }}
            onPointerCancel={() => { start.current = null; setDrag(0); }}
            className="flex cursor-grab touch-none justify-center py-2"
          >
            <span aria-hidden className="h-1 w-9 rounded-full bg-muted-foreground/40" />
          </button>
          <div className="flex items-center gap-2 border-b border-border px-3 pb-2">
            {i > 0 ? (
              <button type="button" onClick={onBack} aria-label="Back"
                className="cursor-pointer rounded p-1 hover:bg-muted">
                <ChevronLeft aria-hidden className="size-4" />
              </button>
            ) : null}
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{s.title}</h2>
            <button type="button" onClick={onCloseAll} aria-label="Close"
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{s.content}</div>
        </div>
      ))}
    </>
  );
}
