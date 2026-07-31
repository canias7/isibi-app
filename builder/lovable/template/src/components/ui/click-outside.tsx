import * as React from "react";
/**
 * Close-on-click-outside, with the three classic bugs closed.
 *
 * POINTERDOWN, NOT CLICK. A click fires where the mouse went UP — selecting
 * text inside a dialog and releasing outside it "clicks outside" and closes
 * the dialog mid-selection. Pointerdown is where the interaction began,
 * which is what "outside" means to a person.
 *
 * COMPOSEDPATH, NOT CONTAINMENT. A menu item rendered through a portal is
 * OUTSIDE the ref's DOM subtree while being inside the widget — containment
 * alone closes the menu on the very click that was choosing an item. The
 * event's composedPath still includes the portal content's own nodes, so
 * callers pass every element that counts as "inside" (the anchor AND the
 * portal's content ref).
 *
 * THE OPENING CLICK IS IGNORED. The pointerdown that opened the widget
 * bubbles to the document AFTER React committed the open state — a naive
 * listener closes it in the same gesture. Listening starts on the next
 * tick.
 */
export function useClickOutside(
  refs: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement | null>[],
  onOutside: () => void,
  active = true,
) {
  const cb = React.useRef(onOutside);
  cb.current = onOutside;
  React.useEffect(() => {
    if (!active) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const handler = (e: Event) => {
      const path = e.composedPath ? e.composedPath() : [];
      const inside = list.some((r) => {
        const el = r.current;
        return el && (path.includes(el) || (e.target instanceof Node && el.contains(e.target)));
      });
      if (!inside) cb.current();
    };
    // Next tick: the opening click must not immediately close it.
    const id = setTimeout(() => {
      document.addEventListener("pointerdown", handler);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...(Array.isArray(refs) ? refs : [refs])]);
}
