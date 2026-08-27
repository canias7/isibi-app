import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick a colour by its swatch — with the NAME always present.
 *
 * `color-swatch` SHOWS one colour and `color-picker` picks any colour from a
 * spectrum. This picks from a product's finite, named list, and the name is
 * not optional: "Midnight" and "Navy" look identical at 24px, a colourblind
 * buyer cannot tell them apart at all, and the name is what appears on the
 * order.
 *
 * SOLD OUT IS STRUCK, NOT HIDDEN (the variant-matrix rule) — the pattern of
 * what has gone is information.
 *
 * A SWATCH CAN CARRY AN IMAGE for patterns and wood grains, because a
 * flat fill is a lie for anything that is not a flat colour.
 */
export function ColourSwatch({ colours, value, onChange, className }: {
  colours: { key: string; name: string; hex?: string; image?: string; soldOut?: boolean }[];
  value?: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const picked = colours.find((c) => c.key === value);
  return (
    <div data-slot="colour-swatch" className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs">
        Colour: <b>{picked?.name ?? "choose one"}</b>
        {picked?.soldOut ? <span className="text-muted-foreground"> — sold out</span> : null}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {colours.map((c) => (
          <li key={c.key}>
            <button type="button" disabled={c.soldOut} onClick={() => onChange(c.key)}
              aria-pressed={value === c.key} aria-label={`${c.name}${c.soldOut ? ", sold out" : ""}`}
              title={c.name}
              style={c.image ? { backgroundImage: `url(${c.image})`, backgroundSize: "cover" } : { background: c.hex }}
              className={cn("relative flex size-8 items-center justify-center rounded-full border",
                value === c.key ? "border-foreground ring-2 ring-foreground ring-offset-2" : "border-border",
                c.soldOut ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
              {value === c.key ? <Check className="size-4 text-white mix-blend-difference" aria-hidden /> : null}
              {c.soldOut ? <span aria-hidden className="absolute h-px w-9 -rotate-45 bg-foreground" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
