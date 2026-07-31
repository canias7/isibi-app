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
export function FontPicker({ value, onChange, families = BUNDLED_FONTS, sample = "The quick brown fox", className }: {
  value?: string | null; onChange: (v: string) => void;
  families?: { value: string; label: string; stack: string }[];
  sample?: string; className?: string;
}) {
  return (
    <ul className={cn("max-h-72 overflow-y-auto rounded-md border border-border", className)} role="listbox">
      {families.map((f) => (
        <li key={f.value} role="option" aria-selected={f.value === value}>
          <button type="button" onClick={() => onChange(f.value)}
            className={cn("flex w-full cursor-pointer flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left last:border-0",
              f.value === value ? "bg-muted" : "hover:bg-muted/50")}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</span>
            <span className="text-lg leading-tight" style={{ fontFamily: f.stack }}>{sample}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
