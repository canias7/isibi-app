import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A card that turns over to show its back.
 *
 * IT FLIPS ON CLICK AND ON FOCUS, never on hover alone. Hover-to-flip is
 * unreachable on every touchscreen and by keyboard, and it fires by accident
 * when the pointer crosses the card on the way somewhere else.
 *
 * THE HIDDEN FACE IS `inert` AND `aria-hidden`. Both faces are in the DOM at
 * once — that is how the effect works — so without this a screen reader reads
 * both sides as one run-on card and Tab lands on a button facing away from the
 * reader.
 *
 * The container is a real `<button>` with `aria-pressed`, so the state is
 * announced. A div that flips is a card whose behaviour is invisible.
 *
 * `prefers-reduced-motion` swaps the faces instantly rather than rotating. A
 * full 3D rotation of a large element is a strong vestibular trigger, and
 * cross-fading loses nothing.
 *
 * Both faces are absolutely positioned inside a container sized by an
 * `aspect-ratio` or an explicit height — stated because a flip card whose
 * height comes from its content collapses to zero the moment both faces go
 * absolute.
 */
export function FlipCard({ front, back, flipped, onFlipChange, label = "Flip the card", className }: {
  front: React.ReactNode;
  back: React.ReactNode;
  flipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  label?: string;
  className?: string;
}) {
  const [own, setOwn] = React.useState(false);
  const on = flipped ?? own;
  const set = (v: boolean) => { setOwn(v); onFlipChange?.(v); };

  const face = "absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-border bg-background p-4 [backface-visibility:hidden]";

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={() => set(!on)}
      className={cn("relative block w-full cursor-pointer text-left [perspective:1000px]", className)}
    >
      <div
        className={cn("relative size-full transition-transform duration-500 [transform-style:preserve-3d]",
          "motion-reduce:transition-none motion-reduce:transform-none!",
          on && "[transform:rotateY(180deg)]")}
      >
        <div className={face} aria-hidden={on} {...(on ? { inert: true } : {})}>{front}</div>
        <div className={cn(face, "[transform:rotateY(180deg)] motion-reduce:[transform:none]", !on && "motion-reduce:hidden")}
          aria-hidden={!on} {...(!on ? { inert: true } : {})}>
          {back}
        </div>
      </div>
    </button>
  );
}
