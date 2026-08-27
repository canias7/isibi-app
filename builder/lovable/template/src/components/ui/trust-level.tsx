import { cn } from "@/lib/utils";
/**
 * How far an account has been verified, and what the next step unlocks.
 *
 * IT SAYS WHAT THE NEXT LEVEL BUYS. A ladder of levels with no stated benefit is
 * a nag — people ignore "verify your account" forever and then hit a limit they
 * do not understand. "Verifying your address raises your limit to £5,000" is a
 * reason, and it turns a badge into a decision.
 *
 * THE LEVEL IS A NAMED STEP, NOT A SCORE. "Trust 68%" is a number nobody can
 * act on and invites arguing with the arithmetic; "email confirmed, address
 * not" says exactly what is missing.
 *
 * SEGMENTS ARE FILLED OR HOLLOW, and the level is written out beside them. A
 * bar alone conveys nothing in greyscale and nothing at all to a screen reader,
 * which gets the whole state in one `sr-only` sentence.
 *
 * IT NEVER SHAMES A LOW LEVEL. Plenty of accounts do not need verifying, and a
 * warning-styled badge on somebody who simply has not needed to is pressure
 * rather than information.
 */
export function TrustLevel({ levels, current, nextBenefit, action, className }: {
  /** In order, lowest first — "Email confirmed", "Phone confirmed". */
  levels: string[];
  /** Zero-based index of the level reached. -1 for none. */
  current: number;
  /** What the next level unlocks. */
  nextBenefit?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const at = Math.max(-1, Math.min(current, levels.length - 1));
  const next = at + 1 < levels.length ? levels[at + 1] : null;
  return (
    <div data-slot="trust-level" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium">{at < 0 ? "Not verified" : levels[at]}</span>
        {next && <span className="text-muted-foreground"> · next: {next}</span>}
      </p>
      <span className="sr-only">
        {at < 0 ? "No levels" : `${at + 1} of ${levels.length} levels`} complete.
      </span>
      <div aria-hidden="true" className="flex gap-1">
        {levels.map((l, i) => (
          <span key={l} className={cn("h-1.5 flex-1 rounded-full", i <= at ? "bg-foreground" : "border border-border")} />
        ))}
      </div>
      {nextBenefit && <p className="text-xs text-muted-foreground">{nextBenefit}</p>}
      {action}
    </div>
  );
}
