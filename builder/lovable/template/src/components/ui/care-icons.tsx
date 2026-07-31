import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Washing and care symbols — each one LABELLED in words.
 *
 * NOBODY READS LAUNDRY SYMBOLS. They are an ISO standard that most people
 * cannot decode, and a row of bare glyphs is decoration that ruins clothes.
 * Every symbol here carries its meaning as text beside it, which is also the
 * only way it works for a screen reader.
 *
 * DRAWN, NOT A FONT. Care symbols are absent from most icon sets and
 * inconsistent in the ones that have them; simple SVGs render identically
 * everywhere and print.
 */
const SYMBOLS: Record<string, { draw: React.ReactNode; label: string }> = {
  wash30: { label: "Machine wash at 30°", draw: <><path d="M2 7 h16 l-2 9 H4 z" /><text x="10" y="14" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">30</text></> },
  handwash: { label: "Hand wash only", draw: <><path d="M2 7 h16 l-2 9 H4 z" /><path d="M6 6 q2 -3 4 -1 t4 -1" /></> },
  nobleach: { label: "Do not bleach", draw: <><path d="M10 3 L18 17 H2 z" /><path d="M3 17 L17 3" /></> },
  lowiron: { label: "Iron on low", draw: <><path d="M2 14 h16 l-3 -6 H6 z" /><circle cx="10" cy="17" r="0.8" fill="currentColor" /></> },
  nodry: { label: "Do not tumble dry", draw: <><rect x="2" y="4" width="16" height="13" rx="1" /><circle cx="10" cy="10.5" r="4.5" /><path d="M2 4 L18 17" /></> },
  dryflat: { label: "Dry flat", draw: <><rect x="2" y="4" width="16" height="13" rx="1" /><path d="M5 10.5 h10" /></> },
};

export function CareIcons({ codes, className }: { codes: (keyof typeof SYMBOLS | string)[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {codes.map((c) => {
        const s = SYMBOLS[c];
        if (!s) return null;
        return (
          <li key={c} className="flex items-center gap-1.5 text-xs">
            <svg viewBox="0 0 20 20" aria-hidden className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.2">
              {s.draw}
            </svg>
            {/* The words are the component - the glyph alone ruins clothes. */}
            {s.label}
          </li>
        );
      })}
    </ul>
  );
}
