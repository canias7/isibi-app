import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * DRAFT, COPY, VOID — across a document, on screen and on paper.
 *
 * `print-color-adjust: exact` is the whole trick: browsers strip background
 * and light-grey ink when printing to save toner, so a watermark that looks
 * right on screen prints blank — and a draft that prints without the word
 * DRAFT on it is exactly the document that gets acted on.
 *
 * `pointer-events-none` so it cannot swallow a click on what is underneath.
 */
export function Watermark({ text = "DRAFT", children, className }: {
  text?: string; children?: React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="watermark" className={cn("relative", className)}>
      {children}
      <div aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="-rotate-30 select-none text-[clamp(3rem,18vw,12rem)] font-bold uppercase tracking-widest text-foreground/[0.07]"
          style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as React.CSSProperties}>
          {text}
        </span>
      </div>
    </div>
  );
}
