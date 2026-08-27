import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An opening paragraph with a dropped first letter.
 *
 * THE CAP IS A GRAPHEME, NOT A CHAR. `text[0]` on "Édouard" takes the E and
 * strands the accent, and on an emoji it takes half a surrogate pair —
 * `Intl.Segmenter` (the plural-rules lesson) splits where a reader would.
 * An opening quote mark travels WITH the letter ("“W") — the classic
 * typographic rule, because a dropped bare quote looks like a mistake.
 *
 * FLOAT, NOT `initial-letter` — the CSS property is still patchy across
 * engines, and a float sized in em degrades to nothing worse than a big
 * letter. The cap is aria-hidden with the full text kept in an sr-only
 * span, so a screen reader hears the word, not "W. hen" — and the visible
 * cap is `select-none`, or copying the paragraph pastes the letter twice
 * (aria-hidden does not reach the clipboard; user-select does).
 *
 * Takes a plain string on purpose: a drop cap over arbitrary markup has no
 * well-defined first letter.
 */
export function DropCap({ children, className }: { children: string; className?: string }) {
  const text = children;
  let capLen = 0;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = seg.segment(text)[Symbol.iterator]().next().value;
    capLen = first ? first.segment.length : 0;
  } catch { capLen = text.length ? 1 : 0; }
  // Pull an opening quote along with its letter.
  if (capLen && /["'“‘]/.test(text[0]) && text.length > capLen) {
    try {
      const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      const it = seg.segment(text.slice(capLen))[Symbol.iterator]().next().value;
      if (it) capLen += it.segment.length;
    } catch { capLen += 1; }
  }
  const cap = text.slice(0, capLen);
  const rest = text.slice(capLen);
  return (
    <p data-slot="drop-cap" className={cn("text-sm leading-relaxed", className)}>
      <span aria-hidden className="float-left me-1.5 mt-1 select-none font-serif text-[3.05em] font-bold leading-[0.8]">
        {cap}
      </span>
      <span className="sr-only">{cap}</span>
      {rest}
    </p>
  );
}
