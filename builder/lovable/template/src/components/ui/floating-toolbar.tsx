import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A small toolbar that follows the current selection or the canvas.
 *
 * IT IS CLAMPED TO THE VIEWPORT. Positioned naively at the selection, it hangs
 * off the right edge on anything near the margin and off the top for a
 * selection in the first line — where it is unreachable, because the page
 * cannot scroll above its own top.
 *
 * It FLIPS below the target when there is no room above, which is the one case
 * clamping alone cannot fix: pinned to the top edge it would cover the very
 * thing it is acting on.
 *
 * It does NOT steal focus. A toolbar that focuses itself on appearing destroys
 * the text selection it exists to act on — which is the bug that makes a
 * formatting bar unusable.
 *
 * `position: fixed` and viewport coordinates throughout, so it does not have to
 * know about any scroll container it happens to sit inside — the thing that
 * breaks every absolutely-positioned version.
 */
export function FloatingToolbar({ anchor, open, children, gap = 8, className }: {
  anchor: DOMRect | null;
  open: boolean;
  children: React.ReactNode;
  gap?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !anchor) { setPos(null); return; }
    const el = ref.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 36;
    const above = anchor.top - h - gap;
    // Flip below when there is no room above; the top edge is unreachable.
    const top = above > 8 ? above : anchor.bottom + gap;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, anchor.left + anchor.width / 2 - w / 2));
    setPos({ top, left });
  }, [open, anchor, gap]);

  if (!open || !pos) return null;
  return (
    <div
      ref={ref}
      role="toolbar"
      style={{ top: pos.top, left: pos.left }}
      // Never focus this: it would destroy the selection it acts on.
      onMouseDown={(e) => e.preventDefault()}
      className={cn("fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg", className)}
    >
      {children}
    </div>
  );
}

/** The current text selection's rectangle, or null. */
export function useSelectionRect(within?: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useEffect(() => {
    const read = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setRect(null);
      const range = sel.getRangeAt(0);
      if (within?.current && !within.current.contains(range.commonAncestorContainer)) return setRect(null);
      const r = range.getBoundingClientRect();
      setRect(r.width || r.height ? r : null);
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [within]);
  return rect;
}
