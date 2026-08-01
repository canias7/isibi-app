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
 * quiet duotone wash built from the THEME'S OWN tokens — every theme colours
 * its own placeholders — angled deterministically from the alt text so a
 * gallery of six is six different tiles, a ghosted glyph, and the alt as a
 * visible caption, because the alt describes what will BE here, which is
 * content rather than chrome.
 */

/** Small stable hash so the variation is per-image, not per-render. */
function seed(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function SafeImage({
  src, alt = "", className, ratio = "4/3", fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  /** CSS aspect-ratio, e.g. "16/9". Keeps layout stable before the image loads. */
  ratio?: string;
  fallback?: React.ReactNode;
}) {
  const box = cn("overflow-hidden rounded-lg bg-muted", className);
  if (!src) {
    const s = seed(alt);
    const angle = 25 + (s % 8) * 40;
    const x = 18 + (s % 5) * 16;
    return (
      <div className={box} style={{ aspectRatio: ratio }}>
        {fallback ?? (
          <div
            role="img"
            aria-label={alt || "Image to come"}
            className="relative size-full"
            style={{
              background:
                `radial-gradient(90% 90% at ${x}% 8%, color-mix(in oklch, var(--primary) 13%, transparent), transparent 60%), ` +
                `linear-gradient(${angle}deg, color-mix(in oklch, var(--primary) 9%, var(--muted)), var(--muted) 70%)`,
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(-45deg, color-mix(in oklch, var(--foreground) 3.5%, transparent) 0 1px, transparent 1px 9px)",
              }}
            />
            <ImageIcon aria-hidden="true" className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-foreground/15" />
            {alt && (
              <span className="absolute inset-x-0 bottom-0 line-clamp-2 px-3 pb-2 text-left text-[11px] leading-snug text-muted-foreground">
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
