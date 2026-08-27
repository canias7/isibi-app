import { cn } from "@/lib/utils";
/**
 * The reasons behind a suggestion, listed.
 *
 * THE FACTORS ARE NAMED SO THEY CAN BE ARGUED WITH. A ranked result with no
 * explanation cannot be corrected by the reader — and the commonest reason a
 * recommendation is wrong is a factor the person would have weighted
 * differently.
 *
 * IT SEPARATES WHAT COUNTED AGAINST. Showing only the positives makes every
 * option look like a good fit, and the drawback is usually the deciding piece of
 * information.
 *
 * Plain prose, not a score. A percentage match implies a precision that
 * ranking heuristics do not have, and it invites comparison between numbers that
 * were never on the same scale.
 */
export function WhyThisNote({ forReasons, againstReasons, className }: {
  forReasons: string[];
  againstReasons?: string[];
  className?: string;
}) {
  if (!forReasons.length && !againstReasons?.length) return null;
  return (
    <div data-slot="why-this-note" className={cn("flex flex-col gap-1 text-xs", className)}>
      {forReasons.length > 0 && (
        <div>
          <p className="font-medium">Why this one</p>
          <ul className="flex list-disc flex-col gap-0.5 ps-4 text-muted-foreground">
            {forReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {againstReasons?.length ? (
        <div>
          <p className="font-medium">Worth knowing</p>
          <ul className="flex list-disc flex-col gap-0.5 ps-4 text-muted-foreground">
            {againstReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
