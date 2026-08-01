import { cn } from "@/lib/utils";
/**
 * How much to trust this answer.
 *
 * BANDED WORDS AND A REASON, never a percentage. A model's own certainty is
 * poorly calibrated, and dressing it as "92%" borrows the authority of
 * measurement for something closer to a guess.
 *
 * THE REASON IS WHAT MAKES IT USEFUL. "Less sure — your documents don't cover
 * this" tells the reader exactly what to do next; a bare "low confidence" tells
 * them only to worry.
 *
 * LOW CONFIDENCE SUGGESTS THE HUMAN ROUTE. The honest response to an uncertain
 * machine answer is often "ask someone", and offering it here is better than
 * leaving the reader with a hedge and no alternative.
 */
export function AiConfidence({ level, because, askHuman, className }: {
  level: "high" | "medium" | "low";
  /** Why — "your documents don't cover this". */
  because?: string;
  askHuman?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  const WORD = { high: "Fairly confident", medium: "Less sure", low: "Not confident" } as const;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span className={cn(level === "high" ? "text-muted-foreground" : "font-medium")}>{WORD[level]}</span>
      {because && <span className="text-muted-foreground">— {because}</span>}
      {level !== "high" && askHuman && (
        askHuman.href
          ? <a href={askHuman.href} className="underline underline-offset-2">{askHuman.label}</a>
          : <button type="button" onClick={askHuman.onClick} className="cursor-pointer underline underline-offset-2">{askHuman.label}</button>
      )}
    </p>
  );
}
