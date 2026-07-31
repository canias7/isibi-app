import * as React from "react";
/**
 * A custom image under the cursor while dragging.
 *
 * THE NODE MUST BE IN THE DOCUMENT AND VISIBLE when setDragImage reads it —
 * the browser snapshots it synchronously during dragstart, so
 * `display:none` yields an empty ghost. The trick every implementation
 * lands on: park it at fixed -10000px (rendered, but off screen), and
 * point setDragImage at it.
 *
 * WHY BOTHER: the default ghost is a translucent screenshot of the whole
 * dragged row — dragging a 900px table row shows a 900px ghost that hides
 * the drop target. A compact preview ("3 bookings") says what is being
 * carried without covering where it is going.
 *
 * `onDragStart` is spread onto the draggable; the preview renders once,
 * off screen, whatever is being dragged.
 */
export function useDragPreview() {
  const ref = React.useRef<HTMLDivElement>(null);
  const onDragStart = React.useCallback((e: React.DragEvent) => {
    if (ref.current) e.dataTransfer.setDragImage(ref.current, 12, 12);
  }, []);
  const preview = React.useCallback(
    (children: React.ReactNode) => (
      <div ref={ref} aria-hidden style={{ position: "fixed", top: -10000, left: -10000 }}>
        {children}
      </div>
    ),
    [],
  );
  return { onDragStart, preview };
}
