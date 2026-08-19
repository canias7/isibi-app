import * as React from "react";
import { ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Panels that slide in from the side, one on top of another, with a way back.
 *
 * THE BACK BUTTON IS THE POINT. A stack of sheets with only a close button
 * makes going one level back impossible — the only escape is closing
 * everything and starting again, which on a settings screen three levels deep
 * is where people give up.
 *
 * Only the TOP sheet is interactive; the ones underneath are `inert`. Without
 * that, a tab from the top sheet walks into the panel behind it and focus
 * disappears somewhere the reader cannot see.
 *
 * The stack has a MAXIMUM. Past about three, each sheet has less width than the
 * last and the navigation is worse than a page; the cap makes that a design
 * decision rather than something discovered by a customer.
 *
 * Sheets underneath are offset by a few pixels and dimmed, so the depth is
 * visible. A stack that hides completely gives no signal that Back exists.
 */
export function SheetStack({ sheets, onBack, onCloseAll, side = "right", className }: {
  sheets: { id: string; title?: React.ReactNode; content: React.ReactNode }[];
  onBack: () => void;
  onCloseAll: () => void;
  side?: "right" | "left";
  className?: string;
}) {
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const top = sheets.length - 1;

  const backRef = React.useRef(onBack);
  backRef.current = onBack;
  React.useEffect(() => {
    if (sheets.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); backRef.current(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheets.length]);

  React.useEffect(() => {
    refs.current[top]?.querySelector<HTMLElement>("button, a, input, [tabindex]")?.focus();
  }, [top]);

  if (sheets.length === 0) return null;

  return (
    <>
      <div aria-hidden onClick={onCloseAll} className="fixed inset-0 z-40 bg-foreground/50" />
      {sheets.map((s, i) => {
        const back = top - i;
        return (
          <div
            key={s.id}
            ref={(el) => { refs.current[i] = el; }}
            role="dialog"
            aria-modal={i === top}
            aria-label={typeof s.title === "string" ? s.title : undefined}
            // `inert` keeps focus out of the panels underneath.
            {...(i === top ? {} : { inert: true })}
            style={{ [side]: `${back * 12}px`, zIndex: 41 + i }}
            className={cn("fixed inset-y-0 flex w-[min(28rem,calc(100vw-3rem))] flex-col border-border bg-popover shadow-xl",
              side === "right" ? "border-s" : "border-e",
              i !== top && "opacity-60", className)}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
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
        );
      })}
    </>
  );
}
