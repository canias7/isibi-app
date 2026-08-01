import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * A filter question on an application — with what happens if you say no.
 *
 * A KNOCKOUT QUESTION SAYS IT IS ONE, BEFORE IT IS ANSWERED. Silently rejecting
 * somebody on an answer they did not know was disqualifying wastes their time
 * and produces a rejection they cannot learn from — and many would have
 * answered accurately if they had known what turned on it.
 *
 * IT SEPARATES A LEGAL REQUIREMENT FROM A PREFERENCE. "Do you have the right to
 * work here" is a hard requirement; "do you have five years of experience" is
 * usually a wish, and dressing the second as the first excludes people who
 * would get the job.
 *
 * "PREFER NOT TO SAY" IS OFFERED WHERE THE QUESTION IS ABOUT THE PERSON rather
 * than the work. Anything touching health, background or protected
 * characteristics must be answerable without answering, or it is coercive.
 *
 * IT NEVER ASKS FOR CURRENT SALARY. It is banned in a growing number of places,
 * and everywhere else it perpetuates whatever gap somebody arrived with — so
 * the component has no field for it and says so.
 */
export function ScreeningQuestion({ question, kind = "preference", options, value, onChange, allowPreferNotToSay, whyAsked, className }: {
  question: string;
  /** A knockout question rejects on the wrong answer, and must say so. */
  kind?: "knockout" | "requirement" | "preference";
  options: string[];
  value?: string;
  onChange?: (next: string) => void;
  allowPreferNotToSay?: boolean;
  /** Why this is being asked, which is required for anything personal. */
  whyAsked?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={cn("space-y-1", className)}>
      <legend className="text-sm font-medium">{question}</legend>
      {kind === "knockout" && (
        <p className="text-xs font-medium">
          This one is a filter — an application that answers it the wrong way will not be considered.
        </p>
      )}
      {kind === "requirement" && (
        <p className="text-xs text-muted-foreground">This is a legal requirement of the role, not a preference.</p>
      )}
      {whyAsked && <p className="text-xs text-muted-foreground">{whyAsked}</p>}
      <div className="space-y-1 pt-0.5">
        {[...options, ...(allowPreferNotToSay ? ["Prefer not to say"] : [])].map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              value={o}
              checked={value === o}
              onChange={() => onChange?.(o)}
              className="size-4"
            />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
