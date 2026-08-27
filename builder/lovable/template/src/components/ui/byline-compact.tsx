import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Author · date · reading time, in one line.
 *
 * READING TIME IS COMPUTED FROM THE WORDS, at a stated 200 wpm, and
 * rounded UP — "4 min read" that takes six breaks trust in a small way
 * every time; the ceiling errs on the side the reader forgives. Pass
 * `text` (or `words`) and the count is honest by construction; pass
 * neither and no estimate is shown, because a made-up number is worse
 * than none.
 *
 * THE DATE RIDES IN A REAL `<time datetime>` (the date-format rule) so
 * crawlers and reader modes can parse what they cannot read from
 * "12 July".
 *
 * One line, separated by middle dots, muted — a byline is metadata, not a
 * second headline.
 */
export function readingMinutes(textOrWords: string | number, wpm = 200) {
  const words = typeof textOrWords === "number"
    ? textOrWords
    : (textOrWords.trim().match(/\S+/g) || []).length;
  return Math.max(1, Math.ceil(words / wpm));
}

export function BylineCompact({ author, date, iso, text, words, className }: {
  author: React.ReactNode;
  date?: string;
  iso?: string;
  text?: string;
  words?: number;
  className?: string;
}) {
  const mins = text != null ? readingMinutes(text) : words != null ? readingMinutes(words) : null;
  return (
    <p data-slot="byline-compact" className={cn("flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground", className)}>
      <span className="font-medium text-foreground">{author}</span>
      {date ? (<>
        <span aria-hidden>·</span>
        {iso ? <time dateTime={iso}>{date}</time> : <span>{date}</span>}
      </>) : null}
      {mins != null ? (<>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{mins} min read</span>
      </>) : null}
    </p>
  );
}
