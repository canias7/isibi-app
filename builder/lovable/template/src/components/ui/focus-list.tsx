import * as React from "react";
/**
 * Roving focus for an arbitrary list — one Tab stop, arrows inside.
 *
 * THE ROVING TABINDEX PATTERN, generalised: the container is one Tab
 * stop from the page's point of view (a list of 40 rows must not cost 40
 * Tabs to get past — the reason the pattern exists), and Arrow keys move
 * a single tabindex="0" between items marked `data-focus-item`. Home and
 * End jump; wrap is optional and OFF by default, because wrapping is
 * right for menus and wrong for lists with a real top and bottom.
 *
 * ITEMS ARE DISCOVERED FROM THE DOM at keydown time, not registered —
 * rows appear and disappear with data, and a registration list goes
 * stale the moment a filter runs (the coach-mark re-measure lesson,
 * applied to membership instead of position).
 *
 * The hook returns props for the container; items just carry
 * `data-focus-item` and whatever onClick they had. Selection stays the
 * caller's — this moves FOCUS, and Enter/Space activate the focused
 * item's own click handler natively when it is a button, which items
 * should be.
 */
export function useFocusList(opts?: { wrap?: boolean }) {
  const wrap = opts?.wrap ?? false;
  const ref = React.useRef<HTMLElement | null>(null);

  const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const root = ref.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>("[data-focus-item]")]
      .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = current + 1;
    else if (e.key === "ArrowUp") next = current - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    if (wrap) next = (next + items.length) % items.length;
    else next = Math.max(0, Math.min(items.length - 1, next));
    // Roving: exactly one item is tabbable.
    items.forEach((el, i) => el.setAttribute("tabindex", i === next ? "0" : "-1"));
    items[next].focus();
  }, [wrap]);

  // First item tabbable on mount and whenever the set changes shape.
  const containerRef = React.useCallback((el: HTMLElement | null) => {
    ref.current = el;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-focus-item]")];
    items.forEach((it, i) => it.setAttribute("tabindex", i === 0 ? "0" : "-1"));
  }, []);

  return { ref: containerRef, onKeyDown };
}
