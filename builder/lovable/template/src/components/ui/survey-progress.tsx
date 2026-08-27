import { cn } from "@/lib/utils";
/**
 * How far through a survey somebody is, in questions and in minutes.
 *
 * THE TIME LEFT IS WHAT KEEPS PEOPLE GOING. "4 of 12" is a count somebody has
 * to convert into a decision about whether to carry on; "about 2 minutes left"
 * is the decision itself. Surveys are abandoned in the middle, and this is the
 * cheapest thing that reduces it.
 *
 * IT NEVER GOES BACKWARDS. A survey that adds branch questions partway makes
 * the total grow, and a bar that shrinks reads as punishment for answering
 * honestly. The remaining estimate absorbs the change instead, which is what
 * `secondsPerQuestion` is for.
 *
 * A REAL `<progress>` ELEMENT, so assistive technology gets the value, the max
 * and the percentage for free. A styled div needs three ARIA attributes to say
 * the same thing and usually carries one.
 *
 * IT ROUNDS UP AND SAYS "ABOUT", because a survey that promises one minute and
 * takes three is worse than one that promised two.
 */
export function SurveyProgress({ answered, total, secondsPerQuestion = 15, label = "Survey progress", className }: {
  answered: number;
  total: number;
  secondsPerQuestion?: number;
  label?: string;
  className?: string;
}) {
  const left = Math.max(0, total - answered);
  const mins = Math.ceil((left * secondsPerQuestion) / 60);
  return (
    <div data-slot="survey-progress" className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        <span>
          <span className="tabular-nums text-foreground">{Math.min(answered, total)}</span> of{" "}
          <span className="tabular-nums">{total}</span> answered
        </span>
        {left > 0 && <span>About {mins} {mins === 1 ? "minute" : "minutes"} left</span>}
        {left === 0 && <span>All done</span>}
      </p>
      <progress value={Math.min(answered, total)} max={total} aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground" />
    </div>
  );
}
