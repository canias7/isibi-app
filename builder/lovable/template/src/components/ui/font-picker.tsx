import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Choose a typeface, shown IN ITSELF.
 *
 * A dropdown listing font names in the interface font is the wrong control
 * for the one decision that is entirely visual — nobody can pick between
 * "Lora" and "Merriweather" from the words. Every row renders in its own
 * family.
 *
 * THE PREVIEW ONLY WORKS FOR A FACE THAT IS ACTUALLY LOADED. Listing a family
 * whose @font-face has not been included renders it in the fallback, so every
 * row looks identical and the control is useless — which is exactly what the
 * first render of this showed, because a generated site loads only the pair it
 * chose rather than all 24.
 *
 * So the caller passes the families it has loaded. The default is the full
 * bundled set, which is right for an app that imports them all and wrong for
 * one that does not; the name is always shown above the sample so the list
 * stays usable either way.
 */
export const BUNDLED_FONTS = [
  { value: "Geist", label: "Geist", stack: '"Geist Variable", sans-serif' },
  { value: "Inter", label: "Inter", stack: '"Inter Variable", sans-serif' },
  { value: "DM Sans", label: "DM Sans", stack: '"DM Sans Variable", sans-serif' },
  { value: "Figtree", label: "Figtree", stack: '"Figtree Variable", sans-serif' },
  { value: "Manrope", label: "Manrope", stack: '"Manrope Variable", sans-serif' },
  { value: "Outfit", label: "Outfit", stack: '"Outfit Variable", sans-serif' },
  { value: "Space Grotesk", label: "Space Grotesk", stack: '"Space Grotesk Variable", sans-serif' },
  { value: "Montserrat", label: "Montserrat", stack: '"Montserrat Variable", sans-serif' },
  { value: "Raleway", label: "Raleway", stack: '"Raleway Variable", sans-serif' },
  { value: "Public Sans", label: "Public Sans", stack: '"Public Sans Variable", sans-serif' },
  { value: "Nunito Sans", label: "Nunito Sans", stack: '"Nunito Sans Variable", sans-serif' },
  { value: "IBM Plex Sans", label: "IBM Plex Sans", stack: '"IBM Plex Sans Variable", sans-serif' },
  { value: "Instrument Sans", label: "Instrument Sans", stack: '"Instrument Sans Variable", sans-serif' },
  { value: "Source Sans 3", label: "Source Sans 3", stack: '"Source Sans 3 Variable", sans-serif' },
  { value: "Playfair Display", label: "Playfair Display", stack: '"Playfair Display Variable", serif' },
  { value: "Lora", label: "Lora", stack: '"Lora Variable", serif' },
  { value: "Merriweather", label: "Merriweather", stack: '"Merriweather Variable", serif' },
  { value: "EB Garamond", label: "EB Garamond", stack: '"EB Garamond Variable", serif' },
  { value: "Noto Serif", label: "Noto Serif", stack: '"Noto Serif Variable", serif' },
  { value: "Roboto Slab", label: "Roboto Slab", stack: '"Roboto Slab Variable", serif' },
  { value: "Instrument Serif", label: "Instrument Serif", stack: '"Instrument Serif", serif' },
  { value: "Oxanium", label: "Oxanium", stack: '"Oxanium Variable", sans-serif' },
  { value: "JetBrains Mono", label: "JetBrains Mono", stack: '"JetBrains Mono Variable", monospace' },
  { value: "Geist Mono", label: "Geist Mono", stack: '"Geist Mono Variable", monospace' },
];
/**
 * ROVING TABINDEX, the same model `roving-list` documents.
 *
 * This is the one picker here with no text box above it, so it owns focus
 * itself rather than announcing an active option to somebody typing. Every row
 * used to be a `<button>` inside its `role="option"` — which ARIA forbids, and
 * which made a list of 24 typefaces into 24 tab stops on the way to whatever
 * comes after it.
 *
 * One row is `tabIndex=0` and the rest are `-1`; arrows move the zero and MOVE
 * FOCUS with it. Setting tabIndex alone changes only what Tab would reach next
 * and leaves the browser's focus where it was, so the arrow key appears to do
 * nothing — the bug every hand-rolled version of this has.
 */
export function FontPicker({ value, onChange, families = BUNDLED_FONTS, sample = "The quick brown fox", className }: {
  value?: string | null; onChange: (v: string) => void;
  families?: { value: string; label: string; stack: string }[];
  sample?: string; className?: string;
}) {
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);
  const chosen = families.findIndex((f) => f.value === value);
  // The chosen row is where the keyboard starts, so arrowing from a list you
  // have already picked from continues from the choice rather than the top.
  const [active, setActive] = React.useState(chosen < 0 ? 0 : chosen);
  if (!families.length) return null;
  const last = families.length - 1;
  const at = Math.min(Math.max(active, 0), last);
  const move = (i: number) => { setActive(i); refs.current[i]?.focus(); };

  return (
    <ul className={cn("max-h-72 overflow-y-auto rounded-md border border-border", className)}
      role="listbox" aria-label="Typeface"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(at === last ? 0 : at + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(at === 0 ? last : at - 1); }
        else if (e.key === "Home") { e.preventDefault(); move(0); }
        else if (e.key === "End") { e.preventDefault(); move(last); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(families[at].value); }
      }}>
      {families.map((f, i) => (
        <li key={f.value}
          ref={(el) => { refs.current[i] = el; }}
          role="option" aria-selected={f.value === value}
          tabIndex={i === at ? 0 : -1}
          onClick={() => { setActive(i); onChange(f.value); }}
          onFocus={() => setActive(i)}
          className={cn("flex cursor-pointer flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left outline-none last:border-0",
            "focus-visible:ring-2 focus-visible:ring-ring/40",
            f.value === value ? "bg-muted" : "hover:bg-muted/50")}>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</span>
          <span className="text-lg leading-tight" style={{ fontFamily: f.stack }}>{sample}</span>
        </li>
      ))}
    </ul>
  );
}
