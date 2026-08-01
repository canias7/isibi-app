import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Let the reader make the text bigger.
 *
 * IT SETS A CSS VARIABLE, NOT A PIXEL SIZE. Writing `fontSize` onto the root
 * overrides the reader's own browser setting, which is the accessibility feature
 * they have already configured — a scale multiplied on top of it respects both.
 *
 * THE CHOICE PERSISTS in localStorage, wrapped in try/catch for Safari private
 * mode. Somebody who needed larger text on one page needs it on the next, and
 * asking again is the failure that makes people give up on the control.
 *
 * Three steps, not a slider. The useful range is small, discrete steps are
 * reachable by keyboard without dragging, and each one can carry a label a
 * screen reader can announce.
 */
const KEY = "text-scale";
const STEPS = [
  { key: "normal", label: "Normal", scale: 1 },
  { key: "large", label: "Large", scale: 1.15 },
  { key: "larger", label: "Larger", scale: 1.3 },
] as const;

export function TextScale({ className }: { className?: string }) {
  const [key, setKey] = React.useState<string>("normal");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setKey(saved);
    } catch { /* private mode */ }
  }, []);
  React.useEffect(() => {
    const step = STEPS.find((s) => s.key === key) ?? STEPS[0];
    document.documentElement.style.setProperty("--text-scale", String(step.scale));
    try { localStorage.setItem(KEY, key); } catch { /* as above */ }
  }, [key]);

  return (
    <div role="radiogroup" aria-label="Text size" className={cn("inline-flex gap-1 rounded-md border border-border p-1", className)}>
      {STEPS.map((s) => (
        <button key={s.key} type="button" role="radio" aria-checked={s.key === key}
          onClick={() => setKey(s.key)}
          className={cn("cursor-pointer rounded px-2.5 py-1 text-sm",
            s.key === key ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
