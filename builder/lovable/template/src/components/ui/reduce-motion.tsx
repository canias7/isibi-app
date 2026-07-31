import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An in-app motion switch, layered over the system preference.
 *
 * THE SYSTEM SETTING IS THE FLOOR, NEVER OVERRIDDEN DOWNWARDS. Somebody whose
 * OS says reduce-motion gets reduced motion whatever this toggle says — the
 * app control can only reduce further, because "turn animations back on" in an
 * app must not defeat an accessibility setting made for medical reasons. The
 * control disables itself and says why when the OS has spoken.
 *
 * IT WORKS BY A CLASS ON THE ROOT (`.app-reduce-motion`) that the template's
 * CSS treats exactly like the media query. One mechanism, two triggers —
 * duplicating the animation rules per-component is how the two drift.
 *
 * The preference is persisted, in a try/catch, like every stored preference in
 * this kit.
 *
 * `useReducedMotion` answers the merged question — system OR app — and is what
 * components should read if they check at runtime.
 */
const KEY = "app-reduce-motion";

export function systemPrefersReducedMotion() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const read = () => {
      let app = false;
      try { app = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }
      setReduced(systemPrefersReducedMotion() || app);
    };
    read();
    const mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    mq?.addEventListener("change", read);
    window.addEventListener("storage", read);
    return () => { mq?.removeEventListener("change", read); window.removeEventListener("storage", read); };
  }, []);
  return reduced;
}

export function ReduceMotionToggle({ className }: { className?: string }) {
  const [app, setApp] = React.useState(false);
  const [system, setSystem] = React.useState(false);

  React.useEffect(() => {
    try { setApp(localStorage.getItem(KEY) === "1"); } catch { /* private mode */ }
    setSystem(systemPrefersReducedMotion());
    document.documentElement.classList.toggle("app-reduce-motion",
      systemPrefersReducedMotion() || (() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })());
  }, []);

  const set = (next: boolean) => {
    setApp(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* private mode */ }
    document.documentElement.classList.toggle("app-reduce-motion", system || next);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className={cn("flex items-center gap-2.5", system ? "cursor-default" : "cursor-pointer")}>
        <input type="checkbox" checked={system || app} disabled={system}
          onChange={(e) => set(e.target.checked)}
          className="size-4 cursor-pointer accent-foreground disabled:cursor-not-allowed" />
        <span className="text-sm font-medium">Reduce animation</span>
      </label>
      <p className="pl-6.5 text-xs text-muted-foreground">
        {system
          ? "Your device already asks for reduced motion, so it is on and cannot be turned off here."
          : "Turns off decorative movement across the site."}
      </p>
    </div>
  );
}
