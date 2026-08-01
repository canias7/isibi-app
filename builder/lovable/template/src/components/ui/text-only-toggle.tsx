import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Strip the page back to words.
 *
 * FOR SLOW CONNECTIONS AND EXPENSIVE DATA as much as for reading difficulty. A
 * text-only mode is the single biggest thing a content site can offer somebody
 * on a metered connection, and almost nothing offers it.
 *
 * IT SETS A ROOT ATTRIBUTE like `contrast-toggle`, so images, video and
 * decoration opt out through CSS from one place rather than every component
 * needing to know.
 *
 * IT PROMISES NOTHING ABOUT MEANINGFUL IMAGES. A chart or a diagram carrying
 * information must stay — which is the caller's decision, and why this sets a
 * mode rather than hiding every `<img>` itself.
 */
const KEY = "text-only";

export function TextOnlyToggle({ className }: { className?: string }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) setOn(saved === "1");
    } catch { /* private mode */ }
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.textOnly = on ? "1" : "";
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* as above */ }
  }, [on]);
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn((v) => !v)}
      className={cn("cursor-pointer rounded-md border border-border px-3 py-1 text-sm", on && "font-medium", className)}>
      Text only{on ? " on" : " off"}
    </button>
  );
}
