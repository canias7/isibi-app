import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The little bar that appears over selected text.
 *
 * Positioned from the selection's own rectangle and CLAMPED to the viewport,
 * so a selection at the left edge does not push the toolbar off screen — the
 * usual bug, and it makes the buttons unreachable exactly where people select
 * most.
 *
 * It hides on scroll rather than following, because a bar chasing the text is
 * more distracting than one that gets out of the way.
 */
export function SelectionToolbar({ containerRef, children, className }: {
  containerRef: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode; className?: string;
}) {
  const [box, setBox] = React.useState<{ top: number; left: number } | null>(null);
  React.useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      const host = containerRef.current;
      if (!sel || sel.isCollapsed || !sel.rangeCount || !host) return setBox(null);
      if (!host.contains(sel.anchorNode)) return setBox(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) return setBox(null);
      const half = 110;
      setBox({
        top: r.top + window.scrollY - 44,
        left: Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8),
      });
    };
    document.addEventListener("selectionchange", update);
    const hide = () => setBox(null);
    window.addEventListener("scroll", hide, true);
    return () => { document.removeEventListener("selectionchange", update); window.removeEventListener("scroll", hide, true); };
  }, [containerRef]);
  if (!box) return null;
  return (
    <div style={{ top: box.top, left: box.left }}
      onMouseDown={(e) => e.preventDefault()}
      className={cn("absolute z-40 -translate-x-1/2 rounded-md border border-border bg-popover p-1 shadow-md", className)}>
      {children}
    </div>
  );
}
