import { cn } from "@/lib/utils";
/**
 * How sure something is, as three named bands rather than a percentage.
 *
 * THE DIFFERENCE FROM `ai-confidence` IS WHAT IT DESCRIBES. That one is about a
 * generated answer; this is a general estimate band for any judgement — a
 * forecast, a match, a diagnosis — and it carries the SAMPLE the judgement is
 * based on, which is what actually determines whether to trust it.
 *
 * A BAND, NOT A NUMBER. "68% confident" invites arguing with the second digit
 * and implies a calibration nobody has done; three bands with a stated meaning
 * are honest about the resolution of the underlying judgement.
 *
 * THE BASIS IS THE POINT. "High confidence, from 4 similar jobs" and "from 400"
 * are different claims, and a band alone cannot distinguish them — a small
 * sample producing high confidence is the thing a reader most needs to see.
 *
 * SEGMENTS FILLED OR HOLLOW, plus the word — the same discipline as
 * `approval-quorum` and `trust-level`, so a printed report still carries it.
 */
export function ConfidenceBar({ level, basis, className }: {
  level: "low" | "medium" | "high";
  /** What it is based on — "4 similar jobs". */
  basis?: string;
  className?: string;
}) {
  const n = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const word = level === "high" ? "Fairly sure" : level === "medium" ? "Reasonably sure" : "Not very sure";
  return (
    <div data-slot="confidence-bar" className={cn("space-y-1", className)}>
      <p className="text-sm">
        <span className="font-medium">{word}</span>
        {basis && <span className="text-muted-foreground"> · based on {basis}</span>}
      </p>
      <span className="sr-only">Confidence: {level}.</span>
      <div aria-hidden="true" className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-1.5 w-6 rounded-full", i < n ? "bg-foreground" : "border border-border")} />
        ))}
      </div>
    </div>
  );
}
