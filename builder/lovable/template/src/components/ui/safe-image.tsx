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

/**
 * WHICH PART OF A PHOTOGRAPH SURVIVES THE CROP.
 *
 * The image is `object-cover` inside a fixed ratio, so anything that does not
 * fit is cut off — from the CENTRE, always, because that is what a browser does
 * when nothing says otherwise. A head-and-shoulders photo in a 21/9 hero loses
 * the head; a tall shopfront in a 4/3 card loses the sign. Neither is a bug in
 * the photograph and neither could be fixed at any price before this: the owner
 * had to go and re-crop the file.
 *
 * PER SLOT, NOT PER PICTURE, and that is the decision rather than an accident.
 * The same photograph legitimately wants different framing in a 21/9 banner and
 * a 1/1 avatar, so a single focal point stored against the FILE would be right
 * in one place and wrong in the other. It also makes the setting addressable:
 * the picture lane reads page source, so a value written on the element is one
 * it can find and change.
 *
 * FIVE NAMED POSITIONS, NOT COORDINATES. "A bit further up" is not something a
 * customer can say in percentages and not something we should ask them to. Each
 * maps to a Tailwind class, so there are no arbitrary values and nothing to
 * escape.
 */
export type ImageFocus = "centre" | "top" | "bottom" | "left" | "right" | (string & {});

/**
 * `| (string & {})` FOR THE REASON `SiteLayout` CARRIES ONE. A page that holds
 * its pictures in a `const` array and spreads them widens the property to
 * `string`, which a bare literal union refuses — measured on the frame's own
 * arrangement, where the closed union failed `TS2322` on the reference pages and
 * would have cost the whole site. An unrecognised value falls through to the
 * default below rather than emitting a class that does not exist.
 */
const FOCUS_CLASS: Record<string, string> = {
  top: "object-top",
  bottom: "object-bottom",
  left: "object-left",
  right: "object-right",
  // `centre` is the browser's own default, so it deliberately maps to nothing:
  // a picture put back to the middle carries no class at all.
  centre: "",
};

export function SafeImage({
  src, alt = "", className, ratio = "4/3", fallback, fallbackSeed, focus,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  /** CSS aspect-ratio, e.g. "16/9". Keeps layout stable before the image loads. */
  ratio?: string;
  /** Which part survives the crop: "top" keeps heads, "bottom" keeps ground. */
  focus?: ImageFocus;
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
      {/* `object-cover` is what crops, so `object-position` is what decides
          WHAT it crops. An unknown value falls through to no class at all,
          which is the browser's own centre — the same direction every other
          unrecognised enum on this platform fails in. */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("size-full object-cover", focus && FOCUS_CLASS[focus])}
      />
    </div>
  );
}
