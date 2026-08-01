import { cn } from "@/lib/utils";
/**
 * How sure the system is about a value it worked out.
 *
 * BANDED WORDS, NOT A PERCENTAGE. "87% confident" invites a precision the model
 * does not have and that nobody can act on differently from 84%. "Probably" and
 * "not sure" are the two states that change what somebody does.
 *
 * LOW CONFIDENCE ASKS FOR A CHECK rather than just admitting doubt. A hedge with
 * no call to action is a disclaimer; "worth checking" is an instruction.
 *
 * IT NEVER HIDES ITSELF AT HIGH CONFIDENCE ONLY TO APPEAR AT LOW. A note that
 * only shows when something is uncertain trains people to read its absence as
 * certainty, which is exactly wrong when it fails to render.
 */
export function ConfidenceNote({ level, what, onVerify, className }: {
  level: "high" | "medium" | "low";
  /** What was inferred — "the category". */
  what?: string;
  onVerify?: () => void;
  className?: string;
}) {
  const WORD = { high: "Confident", medium: "Fairly confident", low: "Not sure" } as const;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span className={cn(level === "low" ? "font-medium" : "text-muted-foreground")}>
        {WORD[level]}{what ? ` about ${what}` : ""}
      </span>
      {level !== "high" && <span className="text-muted-foreground">— worth checking.</span>}
      {onVerify && (
        <button type="button" onClick={onVerify} className="cursor-pointer underline underline-offset-2">Check it</button>
      )}
    </p>
  );
}
