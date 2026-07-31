import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A small dot that pulses — "live", "recording", "connected".
 *
 * IT CARRIES A LABEL. A bare pulsing dot means nothing to a screen reader and
 * very little to anyone else: the same animation is used for live, recording,
 * unsaved and error across the web. The label is `sr-only` when there is no
 * visible text, so it is never silent.
 *
 * States differ by FILL — solid, hollow, half — not by colour, so it survives
 * greyscale and print. The same rule as `status-dot`, with the animation added
 * for the one state that is genuinely happening right now.
 *
 * Only `live` pulses. A page where four dots all throb is a page nobody can
 * read, and the pulse is meant to say "this is changing as you watch".
 *
 * `motion-reduce` stops the animation and the dot stays. Nothing is lost,
 * because the label carries the meaning.
 */
export function PulseDot({ state = "live", label, children, className }: {
  state?: "live" | "idle" | "off";
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const word = label ?? (state === "live" ? "Live" : state === "idle" ? "Idle" : "Off");
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="relative flex size-2 shrink-0">
        {state === "live" ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full",
          state === "live" ? "bg-current"
            : state === "idle" ? "border border-current"
            : "border border-current opacity-40")} />
      </span>
      {children ?? (label ? <span className="text-xs">{label}</span> : null)}
      {!children && !label ? <span className="sr-only">{word}</span> : null}
    </span>
  );
}
