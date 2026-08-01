import { cn } from "@/lib/utils";
/**
 * The places a set of results is drawn from, named.
 *
 * THE DIFFERENCE FROM `service-area-note` IS WHOSE AREA IT IS. That one is the
 * business's promise about where it will travel; this describes where the
 * RESULTS on screen came from — "12 salons across Camden, Islington and
 * Hackney". One is a policy, the other is a caption for a list.
 *
 * IT NAMES THE AREAS RATHER THAN COUNTING THEM, up to a limit, because "across
 * 3 areas" is exactly the sentence that makes somebody widen a search they did
 * not need to widen. Names are checkable against what they meant.
 *
 * THE OVERFLOW IS A REAL NUMBER — "and 4 more" — not an ellipsis. A truncated
 * list with no count hides whether one place is missing or forty. The
 * conjunction moves to the overflow when there is one: measured, joining the
 * shown names with "and" AND appending "and 2 more areas" produced "Camden,
 * Islington and Hackney and 2 more areas", with two conjunctions in a row.
 *
 * IT SAYS NOTHING WHEN THERE IS NOTHING TO SAY. A caption listing zero areas is
 * a stray sentence above an empty list, and the empty state owns that space.
 */
export function CatchmentNote({ areas, total, noun = "places", max = 3, className }: {
  areas: string[];
  /** How many results the areas account for. */
  total?: number;
  noun?: string;
  max?: number;
  className?: string;
}) {
  if (!areas.length) return null;
  const shown = areas.slice(0, max);
  const rest = areas.length - shown.length;
  const list = rest > 0 || shown.length === 1
    ? shown.join(", ")
    : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {total !== undefined && (
        <><span className="font-medium tabular-nums text-foreground">{total.toLocaleString()}</span> {noun} across </>
      )}
      {total === undefined && "Across "}
      {list}
      {rest > 0 && <span> and {rest} more {rest === 1 ? "area" : "areas"}</span>}
    </p>
  );
}
