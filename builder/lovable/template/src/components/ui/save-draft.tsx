import * as React from "react";
/**
 * Keeps a long form in localStorage while it is being filled in.
 *
 * A headless component — it renders nothing and exists so that closing a tab
 * halfway through a booking does not throw the whole thing away.
 *
 * Two rules it holds:
 * - `clear()` on successful submit, or the next visitor to that browser sees
 *   the last person's answers pre-filled.
 * - Nothing sensitive. localStorage is readable by any script on the origin
 *   and survives sign-out, so a card number or a password does not go in it.
 *   The caller decides what to hand over; this refuses nothing, and the
 *   choice of what to pass is the whole safety story.
 */
export function useSaveDraft<T>(key: string, value: T, options?: { enabled?: boolean; delay?: number }) {
  const enabled = options?.enabled ?? true;
  const delay = options?.delay ?? 800;
  React.useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked */ }
    }, delay);
    return () => clearTimeout(t);
  }, [key, value, enabled, delay]);
  return React.useMemo(() => ({
    clear: () => { try { localStorage.removeItem(key); } catch { /* blocked */ } },
  }), [key]);
}
/** Reads a saved draft once, at mount. Returns null when there is none or it is unreadable. */
export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
