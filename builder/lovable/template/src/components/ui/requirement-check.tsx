import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * What this needs, against what you have.
 *
 * UNMET REQUIREMENTS COME FIRST. A list in declaration order buries the one
 * blocker among nine satisfied lines, and the blocker is the entire reason
 * somebody opened it.
 *
 * EACH LINE SAYS BOTH SIDES — needed and actual. "Needs 8 GB, you have 4 GB" is
 * a decision; a red cross beside "8 GB" leaves the reader to work out what they
 * have.
 *
 * The mark is an icon AND a word in `sr-only` text, never colour: this is a
 * pass/fail list, which is exactly where a green/red pair fails for the largest
 * group of affected readers.
 */
export function RequirementCheck({ requirements, className }: {
  requirements: { label: string; needed: string; actual?: string; met: boolean }[];
  className?: string;
}) {
  if (!requirements.length) return null;
  const sorted = [...requirements].sort((a, b) => Number(a.met) - Number(b.met));
  const unmet = requirements.filter((r) => !r.met).length;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-sm font-medium tabular-nums">
        {unmet === 0 ? "Everything checks out" : `${unmet} ${unmet === 1 ? "thing" : "things"} to sort out`}
      </p>
      <ul className="flex flex-col gap-0.5 text-xs">
        {sorted.map((r) => (
          <li key={r.label} className="flex items-baseline gap-2">
            <span aria-hidden className="mt-0.5 shrink-0">
              {r.met ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={cn("min-w-0", r.met && "text-muted-foreground")}>
              <span className="sr-only">{r.met ? "Met: " : "Not met: "}</span>
              {r.label} — needs {r.needed}
              {r.actual ? `, you have ${r.actual}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
