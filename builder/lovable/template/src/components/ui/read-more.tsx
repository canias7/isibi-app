import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Long text, folded, with a real way to open it.
 *
 * THE FOLDED TEXT STAYS IN THE DOM, clipped with line-clamp rather than
 * truncated in JavaScript. Cutting the string means a crawler, a translation
 * layer and find-in-page all see only the opening — and "find on page" failing
 * to find visible words is a bug people report as the site being broken.
 *
 * A real `<button>` with `aria-expanded` and `aria-controls`, not a styled span.
 * This toggles content, which is exactly what those attributes describe.
 *
 * COLLAPSING SCROLLS THE TOP BACK INTO VIEW when the text was long. Otherwise
 * closing a six-paragraph block leaves the reader somewhere below where the
 * content now ends, staring at an unrelated section with no idea what happened.
 */
export function ReadMore({ children, lines = 3, moreLabel = "Read more", lessLabel = "Show less", className }: {
  children: React.ReactNode;
  /** Lines shown when folded. */
  lines?: 2 | 3 | 4 | 5 | 6;
  moreLabel?: string; lessLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5", 6: "line-clamp-6" }[lines];
  return (
    <div data-slot="read-more" className={cn("flex flex-col items-start gap-1", className)}>
      <div id={id} ref={ref} className={cn("text-sm", !open && clamp)}>{children}</div>
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => {
          if (open) ref.current?.scrollIntoView({ block: "nearest" });
          setOpen((v) => !v);
        }}
        className="cursor-pointer text-sm underline underline-offset-4">
        {open ? lessLabel : moreLabel}
      </button>
    </div>
  );
}
