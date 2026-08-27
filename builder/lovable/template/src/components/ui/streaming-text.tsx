import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Text that arrives a token at a time, with a cursor on the end.
 *
 * IT DOES NOT ANIMATE THE TEXT ITSELF. A typewriter effect that reveals
 * already-received characters on a timer is a lie about latency and, worse, it
 * cannot keep up — the buffer outruns the animation and the reader watches a
 * finished answer trickle out. This renders what has arrived, immediately.
 *
 * `aria-live="polite"` on a stream would announce every partial word, which is
 * unusable. So the live region is only populated when the stream FINISHES,
 * and the streaming text carries `aria-busy` — the listener hears the whole
 * answer once, at the point it is a whole answer.
 *
 * The cursor is a `motion-safe` pulse on a character-width block, and it is
 * `aria-hidden`: a screen reader announcing a blinking cursor after every
 * fragment is noise.
 *
 * `preserve-whitespace` with wrapping, because model output is full of newlines
 * that carry structure — a list that collapses into one paragraph reads as a
 * different, worse answer than the one that was generated.
 */
export function StreamingText({ text, done, className }: {
  text: string;
  done?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="streaming-text" className={cn("text-sm leading-relaxed", className)}>
      <p aria-busy={!done} className="whitespace-pre-wrap">
        {text}
        {!done ? (
          <span aria-hidden
            className="ms-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.12em] bg-foreground motion-safe:animate-pulse" />
        ) : null}
      </p>
      <p aria-live="polite" className="sr-only">{done ? text : ""}</p>
    </div>
  );
}
