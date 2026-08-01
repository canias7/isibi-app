import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Turn up the contrast.
 *
 * IT SETS A DATA ATTRIBUTE ON THE ROOT rather than swapping colours here, so the
 * whole page responds through CSS and a component that never heard of this
 * control still participates. Styling from one place is the only version that
 * does not leave half the interface behind.
 *
 * IT RESPECTS `prefers-contrast` AS THE STARTING POINT. Somebody whose system
 * already asks for more contrast should not have to ask again — the toggle is
 * for adjusting from there, not for discovering the need.
 *
 * The choice persists, wrapped in try/catch for Safari private mode. An
 * accessibility setting that resets on the next page is one people give up on.
 */
const KEY = "high-contrast";

export function ContrastToggle({ className }: { className?: string }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let initial = false;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) initial = saved === "1";
      else initial = !!window.matchMedia?.("(prefers-contrast: more)").matches;
    } catch { /* private mode */ }
    setOn(initial);
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.contrast = on ? "high" : "";
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* as above */ }
  }, [on]);
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn((v) => !v)}
      className={cn("cursor-pointer rounded-md border border-border px-3 py-1 text-sm", on && "font-medium", className)}>
      High contrast{on ? " on" : " off"}
    </button>
  );
}
