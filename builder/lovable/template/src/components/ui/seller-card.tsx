import * as React from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * A seller as a PERSON: what they make, how long they have made it, and their
 * own rating.
 *
 * A MARKETPLACE THAT SHOWS ONLY PRODUCTS IS A CATALOGUE. What makes somebody
 * buy a £90 chopping board from a stranger is the stranger — that they have
 * been doing it eleven years, that they are in Rotherham, that four hundred
 * people have bought one. The product card cannot carry any of that, which is
 * why this exists beside it rather than instead of it.
 *
 * THE RATING IS THE SELLER'S OWN AND THE COUNT IS ALWAYS BESIDE IT. "4.9" from
 * three sales and "4.9" from four hundred are different facts, and a star row
 * with no count lets the first impersonate the second — which is the single
 * most common way a marketplace misleads without anybody lying.
 *
 * A SELLER WITH NO RATING SAYS "New seller", NOT five empty stars. An empty
 * star row reads as a bad rating rather than as no rating, so a first-week
 * seller is punished for the platform's own lack of data. It is also the honest
 * word: new is a real thing to be, and buyers can decide what they think of it.
 *
 * `since` IS A YEAR, NOT A DURATION. "Making since 2014" stays true; "eleven
 * years" is wrong the moment the page is cached, and these pages are cached.
 *
 * THE STARS ARE FILLED SHAPES PLUS THE NUMBER, never colour alone — the number
 * is what actually carries it, and the row is `aria-hidden` because "4.9 out of
 * 5 from 412 sales" reads better than five separate star elements.
 *
 * THEY FLOOR RATHER THAN ROUND, so a 4.7 shows four filled and one empty. Round
 * and 4.7 draws five full stars, identical to a genuine 5.0 sitting next to it
 * — decoration that overstates is worse than no decoration, and this is exactly
 * the field where overstating matters. Seen side by side on a render.
 *
 * THE PHOTO IS DECORATIVE (`alt=""`), because the name is the very next element
 * and a screen reader announcing it twice is noise. It also stops SafeImage's
 * fallback caption breaking out of a circular avatar, which is what a
 * name-carrying alt did here.
 */
export function SellerCard({
  name, makes, location, since, rating, sales, photo, note, href, action, className,
}: {
  name: string;
  /** What they make, in their words: "Chopping boards and spoons". */
  makes: string;
  location?: string | null;
  /** A YEAR: 2014. Not a duration, which goes stale in a cached page. */
  since?: number | null;
  /** Out of 5. Omit for a seller with no sales yet — that renders "New seller". */
  rating?: number | null;
  /** How many sales the rating is from. Meaningless apart, so it is shown together. */
  sales?: number | null;
  photo?: string | null;
  note?: string | null;
  href?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const rated = typeof rating === "number" && typeof sales === "number" && sales > 0;
  const Wrap = href ? "a" : "article";
  return (
    <Wrap {...(href ? { href } : {})} className={cn("group flex gap-4", className)}>
      {/* `self-start` is load bearing: a flex row stretches its children to the
          tallest one by default, so the square avatar came out as a tall oval
          on any card whose text ran to three lines — and `aspect-ratio` loses
          to an explicit stretched height. */}
      <SafeImage src={photo} alt="" ratio="1/1" fallbackSeed={name}
        className="w-20 shrink-0 self-start overflow-hidden rounded-full sm:w-24" />
      <div className="min-w-0 flex-1">
        <h3 className={cn("text-lg font-semibold tracking-tight",
          href && "underline-offset-4 group-hover:underline")}>{name}</h3>
        <p className="mt-0.5 text-base text-muted-foreground">{makes}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {location}
          {location && since ? " · " : ""}
          {since ? `Making since ${since}` : ""}
        </p>
        <p className="mt-2 text-sm">
          {rated ? (
            <>
              <span aria-hidden="true" className="tracking-tight">
                {"★".repeat(Math.floor(rating!))}{"☆".repeat(5 - Math.floor(rating!))}
              </span>{" "}
              <span className="font-medium tabular-nums">{rating!.toFixed(1)}</span>{" "}
              {/* THE COUNT IS NEVER OPTIONAL BESIDE A RATING. 4.9 from three
                  sales and 4.9 from four hundred are different facts. */}
              <span className="text-muted-foreground tabular-nums">from {sales} sale{sales === 1 ? "" : "s"}</span>
              <span className="sr-only">{rating!.toFixed(1)} out of 5, from {sales} sales</span>
            </>
          ) : (
            /* Not five empty stars, which read as a BAD rating rather than as
               none, and punish a first-week seller for our lack of data. */
            <span className="font-medium">New seller</span>
          )}
        </p>
        {note && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </Wrap>
  );
}
