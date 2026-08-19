import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Mirror a piece of UI to check it in a right-to-left language.
 *
 * `direction` SETS the document's direction; this PREVIEWS one region
 * without touching the rest of the app, which is the only way to check a
 * layout while still being able to read your own tools.
 *
 * WHAT IT CATCHES IS PHYSICAL PROPERTIES. `ms-2`, `start-0`, `text-start` and
 * a chevron pointing right do not flip with `dir="rtl"`; `ms-2`, `start-0`
 * and `text-start` do. The mirrored view makes that difference visible in a
 * second, which no amount of reading the class list does.
 *
 * A CHECKLIST RIDES WITH IT rather than living in a wiki, because the three
 * things people miss are always the same three: icons that encode direction
 * (a back arrow), numbers and dates (which stay left-to-right INSIDE
 * right-to-left text), and anything positioned with `left`/`right`.
 *
 * The preview is `dir="rtl"` plus a real Arabic sample when asked, because
 * mirroring English tests the boxes and not the text — and it is the text
 * shaping that finds clipped ascenders and broken line heights.
 */
export function RtlPreview({ children, sample, className }: {
  children: React.ReactNode;
  /** Optional right-to-left text to render alongside, e.g. an Arabic heading. */
  sample?: string;
  className?: string;
}) {
  const [on, setOn] = React.useState(false);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)}
          className="size-3.5 cursor-pointer accent-foreground" />
        Mirror this for right-to-left
      </label>
      <div dir={on ? "rtl" : "ltr"} lang={on && sample ? "ar" : undefined}
        className="rounded-lg border border-border p-3">
        {on && sample ? <p className="mb-2 text-lg">{sample}</p> : null}
        {children}
      </div>
      {on ? (
        <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          <li>· Does anything still sit on the wrong side? That is a `left`/`right` or `ml`/`mr` that should be `start`/`end`.</li>
          <li>· Do direction icons still point the old way? Back arrows and chevrons need flipping by hand.</li>
          <li>· Numbers, dates and Latin names stay left-to-right inside the sentence — that is correct, not a bug.</li>
        </ul>
      ) : null}
    </div>
  );
}
