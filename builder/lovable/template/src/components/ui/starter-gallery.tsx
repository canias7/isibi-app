import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * Starting points shown as pictures rather than as a list.
 *
 * THE DIFFERENCE FROM `TemplatePicker` IS THE DECISION BEING MADE. That one is
 * a form field — pick one of seven named things and carry on. This is browsing:
 * more options, chosen by look, where the thumbnail is doing the explaining.
 * They are not the same shape and merging them produces a picker that is bad at
 * both.
 *
 * `SafeImage`, BECAUSE A STARTER WITHOUT A THUMBNAIL IS THE NORMAL CASE. The
 * previews are generated after the starters exist, so a fresh install has none
 * and a bare `<img>` paints a broken icon across the entire gallery.
 *
 * EACH TILE IS ONE `<button>` WRAPPING THE WHOLE CARD, so the target is the
 * tile and not a link under it — and the accessible name is the starter's name,
 * not "image".
 *
 * SELECTION IS A RING PLUS A WORD, and the word sits ON the thumbnail rather
 * than beside the name. Put inline, it competes with the title in a tile barely
 * 150px wide and truncates it — measured, with "One page" rendering as "One…".
 * A name a chooser cannot read is worse than an unmarked selection, and the
 * ring alone would not do: a gallery whose chosen tile is merely tinted loses
 * its selection entirely in greyscale, and this component's content is
 * pictures — the one place a tint blends in worst.
 */
/** See `Shot` in gallery.tsx — every picture type drawn through SafeImage carries this. */
export type Starter = { id: string; name: string; purpose?: string; image?: string; tag?: string; fallbackSeed?: string };

export function StarterGallery({ starters, value, onChange, className }: {
  starters: Starter[];
  value?: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <ul data-slot="starter-gallery" className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {starters.map((s) => {
        const on = s.id === value;
        return (
          <li key={s.id}>
            <button type="button" onClick={() => onChange(s.id)} aria-pressed={on}
              className={cn("w-full overflow-hidden rounded-lg border text-start",
                on ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background" : "border-border")}>
              <span className="relative block">
                {/* SEEDED ON THE NAME. The alt is deliberately empty (the name is read out
            just below, so announcing it twice is noise) and the seed falls back to
            the alt — so with neither, every starter painted an IDENTICAL panel.
            Exactly the case SafeImage's own comment warns about. */}
          <SafeImage src={s.image} alt="" fallbackSeed={s.name} className="aspect-4/3 w-full object-cover" />
                {on && (
                  <span className="absolute end-1.5 top-1.5 rounded bg-foreground px-1.5 py-0.5 text-xs font-medium text-background">
                    Chosen
                  </span>
                )}
              </span>
              <span className="block p-2.5">
                <span className="block text-sm font-medium">{s.name}</span>
                {s.purpose && <span className="mt-0.5 block text-xs text-muted-foreground">{s.purpose}</span>}
                {s.tag && <span className="mt-1 block text-xs text-muted-foreground">{s.tag}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
