import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An in-app high-contrast switch.
 *
 * IT HONOURS `prefers-contrast: more` AS THE DEFAULT, and the app toggle
 * layers on top — the same floor-not-ceiling contract as `reduce-motion`,
 * because both settings exist for reasons an app must not argue with.
 *
 * IT WORKS BY A ROOT CLASS (`.app-high-contrast`) that the stylesheet maps to
 * stronger tokens — full-black ink, heavier borders, no translucency. The
 * component is the SWITCH, not the palette: contrast decisions live in the
 * stylesheet where they apply everywhere at once, including to components that
 * never heard of this toggle.
 *
 * This kit is monochrome, which is most of the work already done — what the
 * class buys is the removal of the greys: muted text becomes ink, hairlines
 * become rules, disabled stays distinguishable by more than opacity.
 */
const KEY = "app-high-contrast";

export function HighContrastToggle({ className }: { className?: string }) {
  const [app, setApp] = React.useState(false);
  const [system, setSystem] = React.useState(false);

  React.useEffect(() => {
    const sys = typeof matchMedia !== "undefined" && matchMedia("(prefers-contrast: more)").matches;
    setSystem(sys);
    let saved = false;
    try { saved = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }
    setApp(saved);
    document.documentElement.classList.toggle("app-high-contrast", sys || saved);
  }, []);

  const set = (next: boolean) => {
    setApp(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* private mode */ }
    document.documentElement.classList.toggle("app-high-contrast", system || next);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className={cn("flex items-center gap-2.5", system ? "cursor-default" : "cursor-pointer")}>
        <input type="checkbox" checked={system || app} disabled={system}
          onChange={(e) => set(e.target.checked)}
          className="size-4 cursor-pointer accent-foreground disabled:cursor-not-allowed" />
        <span className="text-sm font-medium">Higher contrast</span>
      </label>
      <p className="pl-6.5 text-xs text-muted-foreground">
        {system
          ? "Your device already asks for more contrast, so it is on."
          : "Stronger text and borders, no translucency."}
      </p>
    </div>
  );
}
