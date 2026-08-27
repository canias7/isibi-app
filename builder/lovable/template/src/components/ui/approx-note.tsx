import { cn } from "@/lib/utils";
/**
 * A number marked as an estimate, with why and when.
 *
 * AN ESTIMATE PRINTED LIKE A FACT IS THE PROBLEM. "1,240 visitors" that is
 * really a sampled figure, or a cached one from six hours ago, gets quoted in a
 * meeting as exact — and the person who quoted it looks careless when the real
 * number differs. The tilde plus the word "about" is cheap and settles it.
 *
 * WHY IT IS APPROXIMATE MATTERS MORE THAN THAT IT IS. Sampled, rounded, cached
 * and still-counting are four different reasons with four different
 * implications — a cached number will be right later, a sampled one never will.
 *
 * THE TILDE IS `aria-hidden` AND THE WORD CARRIES IT. "~1,240" read aloud is
 * "1,240", so a screen reader user would get the precise-sounding number with
 * none of the hedge — the exact failure this component exists to prevent.
 *
 * `tabular-nums` and pre-formatted values, like the rest of the number set.
 */
const WHY = {
  sampled: "counted from a sample",
  rounded: "rounded",
  cached: "from a recent snapshot",
  counting: "still being counted",
} as const;

export function ApproxNote({ value, why, asOf, word = "About", className }: {
  /** Pre-formatted. */
  value: string;
  why?: keyof typeof WHY;
  /** Free text — "6 hours ago". */
  asOf?: string;
  word?: string;
  className?: string;
}) {
  const tail = [why ? WHY[why] : null, asOf ? `as of ${asOf}` : null].filter(Boolean).join(", ");
  return (
    <span data-slot="approx-note" className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className="tabular-nums">
        <span aria-hidden="true">~</span>
        <span className="sr-only">{word} </span>
        {value}
      </span>
      {tail && <span className="text-xs text-muted-foreground">{tail}</span>}
    </span>
  );
}
