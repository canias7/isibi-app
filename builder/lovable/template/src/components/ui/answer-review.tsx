import { cn } from "@/lib/utils";
/**
 * Everything you answered, before you send it.
 *
 * EVERY ROW HAS AN EDIT LINK BACK TO ITS FIELD. A review step that shows answers
 * and makes you use the back button to change one is why people abandon at the
 * last screen — and using back on a multi-step form usually loses the later
 * answers.
 *
 * BLANK ANSWERS ARE SHOWN as "Not answered" rather than omitted. A missing row
 * is invisible; the whole purpose of a review is catching the thing you skipped.
 *
 * A real `<dl>`, so a screen reader walks question-and-answer pairs rather than
 * two columns of loose text.
 */
export function AnswerReview({ answers, onEdit, className }: {
  answers: { key: string; question: string; answer?: string | null; fieldId?: string }[];
  onEdit?: (key: string) => void;
  className?: string;
}) {
  if (!answers.length) return null;
  return (
    <dl data-slot="answer-review" className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {answers.map((a) => {
        const blank = a.answer === null || a.answer === undefined || a.answer === "";
        return (
          <div key={a.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
            <dt className="min-w-0 text-muted-foreground">{a.question}</dt>
            <dd className="flex min-w-0 items-baseline gap-3">
              <span className={cn(blank && "text-muted-foreground italic")}>
                {blank ? "Not answered" : a.answer}
              </span>
              {a.fieldId
                ? <a href={`#${a.fieldId}`} className="shrink-0 text-xs underline underline-offset-2">Edit<span className="sr-only"> {a.question}</span></a>
                : onEdit && (
                  <button type="button" onClick={() => onEdit(a.key)}
                    className="shrink-0 cursor-pointer text-xs underline underline-offset-2">
                    Edit<span className="sr-only"> {a.question}</span>
                  </button>
                )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
