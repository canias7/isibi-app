import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An <img> that cannot render broken.
 *
 * A picture column is an ordinary TEXT column the OWNER fills in after the build,
 * so on a brand-new site the value is empty and `<img src="">` paints a broken
 * icon on every card. GENERATOR.md rule 7 exists entirely because of this, and it
 * asks the model to remember a guard on every image of every page. This makes
 * forgetting impossible instead.
 *
 * THE FALLBACK IS DESIGNED, NOT APOLOGISED FOR. Every site is image-empty on
 * day one, so on day one the fallback IS the site's art direction — and a flat
 * grey box saying "No image yet" made every fresh page read as broken
 * furniture (measured across theme renders: ten grey boxes on the reference
 * home were the loudest reason a themed page still looked unfinished). So: a
 * duotone wash built from the THEME'S OWN tokens — every theme colours its own
 * placeholders — angled deterministically from the alt text so a gallery of six
 * is six different tiles, a ghosted glyph, and the alt as a visible caption,
 * because the alt describes what will BE here, which is content rather than
 * chrome.
 *
 * THE MIX WAS RAISED FROM 9-13% TO 22-34% ON 2026-08-02, and the reason is that
 * the first version was invisible. At 13% primary over `bg-muted` every
 * placeholder rendered as the same flat grey rectangle it was written to
 * replace — the design was in the file and not on the screen, which is this
 * repo's most repeated failure and, as usual, only findable by LOOKING at a
 * render. Two tones now (primary and accent, which most themes set apart) so
 * the wash has a direction rather than a single haze, and the hatch and glyph
 * were lifted with it. Bounded deliberately: this must read as a reserved
 * space, never as a photograph, or a page of them competes with the real
 * pictures the owner uploads next to it.
 */

/** Small stable hash so the variation is per-image, not per-render. */
function seed(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function SafeImage({
  src, alt = "", className, ratio = "4/3", fallback, fallbackSeed,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  /** CSS aspect-ratio, e.g. "16/9". Keeps layout stable before the image loads. */
  ratio?: string;
  fallback?: React.ReactNode;
  /**
   * What the placeholder's angle and colours are derived from, when the alt is
   * not the right thing to vary on — a decorative backdrop takes `alt=""` so a
   * screen reader does not announce it, and every empty alt would then paint an
   * identical panel.
   */
  fallbackSeed?: string;
}) {
  const box = cn("overflow-hidden rounded-lg bg-muted", className);
  if (!src) {
    const s = seed(fallbackSeed || alt);
    // A hard-edged diagonal band rather than a soft wash. Deliberate: the soft
    // version read as an out-of-focus PHOTOGRAPH, which is the one thing a
    // reserved space must not look like — a visitor reads it as a broken
    // picture and the owner reads it as a bug. A crisp geometric split cannot
    // be mistaken for a failed image.
    const angle = 100 + (s % 4) * 25;
    const stop = 38 + (s % 5) * 7;
    return (
      <div className={box} style={{ aspectRatio: ratio }}>
        {fallback ?? (
          <div
            // An empty alt is HTML's own way of saying "decorative", so it is
            // honoured as one here: no glyph, no caption, and hidden from the
            // accessibility tree. Not a special case — it is what the attribute
            // MEANS, and without it a backdrop painted a centred image icon
            // straight through the headline sitting on top of it.
            {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
            className="relative size-full"
            style={{
              background:
                `linear-gradient(${angle}deg, ` +
                `color-mix(in oklch, var(--primary) 26%, var(--muted)) 0 ${stop}%, ` +
                `color-mix(in oklch, var(--accent) 30%, var(--muted)) ${stop}% ${stop + 16}%, ` +
                `color-mix(in oklch, var(--primary) 11%, var(--muted)) ${stop + 16}% 100%)`,
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(-45deg, color-mix(in oklch, var(--foreground) 6%, transparent) 0 1px, transparent 1px 10px)",
              }}
            />
            {/* A hairline inset, so the tile has a drawn edge of its own and
                does not dissolve into whatever band it is sitting on. */}
            <div aria-hidden="true" className="absolute inset-[5px] rounded-[3px] border border-foreground/10" />
            {alt && <ImageIcon aria-hidden="true" className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-foreground/30" />}
            {alt && (
              // A solid bar, not a gradient scrim. The scrim version was
              // unreadable on every theme it was tried against, because the
              // text sat on whatever the band underneath happened to be.
              <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-background/85 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-foreground/80">
                {alt}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={box} style={{ aspectRatio: ratio }}>
      <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
    </div>
  );
}
