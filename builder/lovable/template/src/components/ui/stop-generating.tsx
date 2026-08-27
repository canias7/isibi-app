import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The button that calls off an answer in progress.
 *
 * It KEEPS what has already arrived. Stop is not cancel — somebody who has read
 * enough presses it, and a version that discards the partial answer punishes
 * exactly the person who was paying attention. The caller has to honour that;
 * this component only exists to be pressed, but the note is here because the
 * mistake is made in the handler.
 *
 * It occupies the SAME position as the send button rather than appearing beside
 * it. Two controls in the same corner, one of which is live for two seconds,
 * guarantees mis-presses in both directions.
 *
 * A square, not an X. X is the universal glyph for close-this-thing, and
 * putting it on a control that stops a stream gets read as "close the
 * conversation" — the square is what every media control has meant for fifty
 * years.
 *
 * Escape works too, which is what most people try first.
 */
export function StopGenerating({ onStop, label = "Stop", showLabel, className }: {
  onStop: () => void;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const stopRef = React.useRef(onStop);
  stopRef.current = onStop;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stopRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button data-slot="stop-generating"
      type="button"
      onClick={onStop}
      aria-label={label}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground text-background hover:opacity-90",
        showLabel ? "px-3 py-1.5 text-xs font-medium" : "size-8 justify-center", className)}
    >
      <span aria-hidden className="size-2.5 rounded-xs bg-background" />
      {showLabel ? label : null}
    </button>
  );
}
