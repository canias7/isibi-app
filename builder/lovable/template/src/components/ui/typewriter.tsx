import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Text typed out one character at a time.
 *
 * IT RESERVES ITS FULL HEIGHT from the first frame, by rendering the whole
 * string invisibly underneath. Without that, a two-line phrase types out on one
 * line and then jumps to two, shoving everything below it down mid-sentence —
 * which on a hero is the first thing a visitor sees.
 *
 * The complete text is in the DOM as `sr-only` and the animation is
 * `aria-hidden`, for the same reason as `count-up`: a listener would otherwise
 * hear it letter by letter, and a crawler would index one character.
 *
 * `prefers-reduced-motion` shows the whole string at once.
 *
 * It advances by CHARACTERS OF A GRAPHEME-SAFE SPLIT — `Array.from`, not
 * `slice`. Slicing a string by index cuts emoji and accented characters in half
 * and paints a replacement glyph for a frame, which looks exactly like a
 * rendering fault.
 *
 * This is NOT for streamed model output. `streaming-text` renders what has
 * arrived immediately; a typewriter over a real stream cannot keep up and turns
 * a finished answer into a trickle.
 */
export function Typewriter({ text, speed = 40, startDelay = 0, cursor = true, onDone, className }: {
  text: string;
  speed?: number;
  startDelay?: number;
  cursor?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const chars = React.useMemo(() => Array.from(text), [text]);
  const [n, setN] = React.useState(0);
  // The latest `onDone`, held in a ref so it is not a DEPENDENCY. Inline
  // `onDone={() => …}` is a new function on every parent render, and this
  // effect opens with `setN(0)` — so the typing restarted from the first
  // character every time anything above it re-rendered. Same pattern as
  // `click-outside`.
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setN(chars.length); doneRef.current?.(); return; }
    setN(0);
    let i = 0;
    let ticking: ReturnType<typeof setInterval> | null = null;
    const begin = setTimeout(() => {
      ticking = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= chars.length) {
          if (ticking) clearInterval(ticking);
          doneRef.current?.();
        }
      }, speed);
    }, startDelay);
    return () => { clearTimeout(begin); if (ticking) clearInterval(ticking); };
  }, [chars, speed, startDelay]);

  return (
    <span className={cn("relative inline-block", className)}>
      {/* Holds the full height from the first frame so nothing below jumps. */}
      <span aria-hidden className="invisible">{text}</span>
      <span aria-hidden className="absolute inset-0">
        {chars.slice(0, n).join("")}
        {cursor && n < chars.length ? (
          <span className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.12em] bg-foreground motion-safe:animate-pulse" />
        ) : null}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
