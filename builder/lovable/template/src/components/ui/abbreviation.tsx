import { cn } from "@/lib/utils";
/**
 * An abbreviation that says what it stands for.
 *
 * A real `<abbr title>`, which is the element for this and is announced by
 * screen readers that support it.
 *
 * IT SPELLS THE EXPANSION OUT IN `sr-only` TEXT TOO, because `title` support is
 * genuinely patchy — several common readers ignore it entirely, and a reader who
 * cannot hover has no other route to it. Belt and braces on four words is cheap.
 *
 * A dotted underline rather than a colour, matching `glossary-term`, so the two
 * conventions do not compete on one page.
 *
 * `first` prints the expansion inline on first use — the typographic convention
 * for a reason, and the version most readers actually need.
 */
export function Abbreviation({ short, long, first, className }: {
  short: string; long: string;
  /** Print the expansion inline, for the first occurrence. */
  first?: boolean;
  className?: string;
}) {
  if (first) {
    return (
      <span className={className}>
        {long} (<abbr title={long}>{short}</abbr>)
      </span>
    );
  }
  return (
    <abbr title={long} className={cn("underline decoration-dotted underline-offset-4", className)}>
      <span aria-hidden>{short}</span>
      <span className="sr-only">{long}</span>
    </abbr>
  );
}
