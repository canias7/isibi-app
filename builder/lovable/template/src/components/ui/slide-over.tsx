import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A single panel that slides in from the edge.
 *
 * It becomes a BOTTOM SHEET below `sm`. A 28rem panel on a 375px screen is the
 * whole viewport with a sliver of scrim beside it — which is a dialog wearing a
 * drawer's animation, and the sliver is the only way back. Bottom is where a
 * thumb is.
 *
 * FOCUS goes in on open and returns to the trigger on close. Returning is the
 * half everybody forgets: without it, closing drops focus on `<body>` and a
 * keyboard user restarts at the top of the page.
 *
 * The transform animation is `motion-safe`. It moves a full-height panel across
 * the screen, which is exactly the kind of large movement that causes trouble
 * for people with vestibular disorders — and the panel works identically
 * without it.
 *
 * The scrim is a real `<button>` labelled "Close", not a div with an onClick.
 * Otherwise the most obvious way out of the panel is invisible to a screen
 * reader.
 *
 * Every class is written out in full — never `sm:${side}-0`. Tailwind finds
 * classes by scanning the source as TEXT, so a name assembled at runtime is
 * never emitted into the stylesheet: it typechecks, it bundles, and the panel
 * silently ignores the rule. The first draft of this file did exactly that.
 */
export function SlideOver({ open, onClose, title, description, children, footer, side = "right", className }: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  className?: string;
}) {
  const panel = React.useRef<HTMLDivElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);

  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button, a, input, select, textarea, [tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div data-slot="slide-over" className="fixed inset-0 z-50">
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute inset-0 cursor-default bg-foreground/50" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "absolute flex flex-col border-border bg-popover shadow-xl",
          // A drawer on a phone is a bottom sheet; a 28rem panel is the whole screen.
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t",
          "sm:inset-x-auto sm:inset-y-0 sm:max-h-none sm:w-[28rem] sm:max-w-[calc(100vw-3rem)] sm:rounded-none sm:border-t-0",
          side === "right" ? "sm:end-0 sm:border-s" : "sm:start-0 sm:border-e",
          "motion-safe:animate-in motion-safe:slide-in-from-bottom sm:motion-safe:slide-in-from-right",
          className)}
      >
        <div className="flex items-start gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-3 border-t border-border p-3">{footer}</div> : null}
      </div>
    </div>
  );
}
