import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * One photo, several products, each pinned to where it appears.
 *
 * BUILT ON THE `image-annotate` GEOMETRY — percentage coordinates, numbered
 * marks, and a parallel LIST beside the picture. The list is not a fallback:
 * it is how this works on a phone, in print, and for anyone not using a
 * pointer, and it is where the prices live.
 *
 * PRICES BELONG IN THE LIST, NOT ON THE PHOTO. Six price tags over an
 * outfit obscure the thing being sold, which defeats the photo.
 *
 * HOVER IS NOT THE ONLY WAY IN: a pin and its list row highlight together
 * on focus as well, so the pairing works from a keyboard.
 */
export function ShopTheLook({ image, alt = "", items, currency = "GBP", className }: {
  image: string;
  alt?: string;
  items: { id: string; x: number; y: number; name: React.ReactNode; priceMinor: number; href?: string }[];
  currency?: string;
  className?: string;
}) {
  const [active, setActive] = React.useState<string | null>(null);
  const fmt = (m: number) => formatMinor(m, currency);
  return (
    <div data-slot="shop-the-look" className={cn("flex flex-col gap-3 sm:flex-row", className)}>
      <div className="relative min-w-0 flex-1">
        <img src={image} alt={alt} className="block w-full rounded-lg border border-border" />
        {items.map((it, i) => (
          <span key={it.id} aria-hidden style={{ left: `${it.x}%`, top: `${it.y}%` }}
            className={cn("absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold ring-1 ring-foreground",
              active === it.id ? "bg-background text-foreground" : "bg-foreground text-background")}>
            {i + 1}
          </span>
        ))}
      </div>
      <ol className="flex w-full flex-col gap-1 sm:w-52">
        {items.map((it, i) => (
          <li key={it.id}>
            <a href={it.href ?? "#"}
              onMouseEnter={() => setActive(it.id)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(it.id)} onBlur={() => setActive(null)}
              className={cn("flex cursor-pointer items-baseline justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted",
                active === it.id && "bg-muted")}>
              <span className="min-w-0 truncate"><b className="tabular-nums">{i + 1}.</b> {it.name}</span>
              <span className="shrink-0 tabular-nums">{fmt(it.priceMinor)}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
