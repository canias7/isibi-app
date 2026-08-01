import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Why am I seeing this?" — the reasoning behind an automated decision,
 * collapsed until asked for.
 *
 * COLLAPSED BY DEFAULT AND THAT IS THE DESIGN. An explanation printed beside
 * every result is noise on the 95% of them nobody questions, and noise is how
 * an explanation stops being read at all. It earns its space only at the moment
 * somebody disagrees with the answer.
 *
 * IT IS A `<button>` DRIVING `aria-expanded`, not a hover card. Somebody who
 * distrusts a result needs to be able to reach the reason with a keyboard, and
 * needs it to stay open while they read it — hover fails both.
 *
 * `factors` are the inputs, in the order they mattered. Prose alone ("based on
 * your recent activity") explains nothing; a list somebody can point at and say
 * "that one is wrong" is what makes an explanation actionable.
 *
 * NO SCORES, deliberately. A confidence percentage on a reason is a number that
 * invites arguing with the arithmetic rather than with the input, and the
 * caller can always put one in the factor text if it genuinely helps.
 */
export function AiExplain({ summary, factors, label = "Why this?", className }: {
  /** One sentence: what the system concluded. */
  summary: string;
  /** The inputs behind it, most significant first. */
  factors?: string[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("text-sm", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {label}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm">{summary}</p>
          {factors && factors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {factors.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
