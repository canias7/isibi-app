import * as React from "react";
/**
 * Lock body scroll — without the 15px jump, and nestable.
 *
 * THE SCROLLBAR'S WIDTH IS COMPENSATED. `overflow: hidden` removes the
 * scrollbar, the page gets ~15px wider, and every centred layout shifts —
 * the flicker everyone has seen when a modal opens. The lock measures the
 * real scrollbar (innerWidth - clientWidth) and adds it as padding-right,
 * so nothing moves.
 *
 * LOCKS COUNT. Two open layers (a dialog over a sheet) each lock; the
 * first one closing must NOT unlock the page under the second. A module-
 * level counter means the styles restore only when the LAST lock releases
 * — and what restores is the exact previous inline values, because the
 * page may have had its own overflow styling this lock knows nothing
 * about.
 */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function useScrollLock(on = true) {
  React.useEffect(() => {
    if (!on) return;
    if (locks === 0) {
      const bar = window.innerWidth - document.documentElement.clientWidth;
      saved = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      };
      document.body.style.overflow = "hidden";
      if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0 && saved) {
        document.body.style.overflow = saved.overflow;
        document.body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [on]);
}
