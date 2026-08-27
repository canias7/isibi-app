import * as React from "react";
/**
 * Keeps Tab inside a region while it is open, and gives focus back when it
 * closes.
 *
 * shadcn's Dialog, Sheet and Drawer already do this — this is for the ones
 * that are not those: a custom panel, an inline editor, a cookie bar that
 * must be answered. Tabbing out of an open modal into the page behind it
 * leaves somebody typing into a form they cannot see.
 *
 * Restoring focus to whatever was focused before is the half everyone omits.
 * Without it the tab order jumps back to the top of the document every time
 * anything closes.
 */
export function FocusTrap({ active = true, children, className }: {
  active?: boolean; children?: React.ReactNode; className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [active]);
  return <div data-slot="focus-trap" ref={ref} className={className}>{children}</div>;
}
