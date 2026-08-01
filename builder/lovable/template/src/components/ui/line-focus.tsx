import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A reading ruler — dims everything except the line you are on.
 *
 * A genuine reading aid for people who lose their place in long text, which
 * includes a large number of dyslexic readers and anybody reading on a phone in
 * motion.
 *
 * KEYBOARD DRIVEN, not mouse-tracked. A ruler that follows the pointer is
 * unusable while scrolling on a touch device and impossible without a mouse;
 * arrow keys move it a line at a time and stay where they are put.
 *
 * IT IS OFF BY DEFAULT AND EXITS ON Escape. An aid that traps the reader in a
 * mode is worse than no aid, and Escape is the key everybody already tries.
 *
 * The dimming is opacity on the non-focused lines rather than an overlay, so
 * text stays selectable and find-in-page still works.
 */
export function LineFocus({ lines, className }: {
  lines: string[];
  className?: string;
}) {
  const [on, setOn] = React.useState(false);
  const [at, setAt] = React.useState(0);
  if (!lines.length) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button type="button" onClick={() => setOn((v) => !v)} aria-pressed={on}
        className="w-fit cursor-pointer text-sm underline underline-offset-4">
        {on ? "Turn off reading ruler" : "Turn on reading ruler"}
      </button>
      <div
        tabIndex={on ? 0 : -1}
        onKeyDown={(e) => {
          if (!on) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(i + 1, lines.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)); }
          if (e.key === "Escape") { setOn(false); }
        }}
        className="flex flex-col gap-0.5 rounded-md text-sm outline-none">
        {lines.map((l, i) => (
          <span key={i} className={cn(on && i !== at && "opacity-30", on && i === at && "font-medium")}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
