import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * After the survey: what was recorded, and what happens to it.
 *
 * THE ANSWERS ARE PLAYED BACK. "Thanks for your feedback" alone leaves the
 * person unsure anything landed; the summary is the receipt, and it is also
 * where people spot their own slip — which is why `onEdit` exists and jumps
 * back rather than making them redo everything.
 *
 * WHAT HAPPENS NEXT IS A SENTENCE WITH A WHO AND A WHEN ("Grace reads these
 * on Fridays"), because feedback into a void is why people stop giving it.
 * `next` is a prop — the component cannot know the process, only insist
 * there is a line for it.
 *
 * Skipped questions are listed AS skipped — an honest receipt includes what
 * was left blank, and seeing it is the last chance to change your mind.
 */
export function ResponseSummary({ answers, next, onEdit, className }: {
  answers: { question: string; answer?: React.ReactNode }[];
  next?: React.ReactNode;
  onEdit?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <p className="text-sm font-medium">Recorded — thank you</p>
      <dl className="flex flex-col gap-1.5">
        {answers.map((a, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b border-border pb-1.5 last:border-0 last:pb-0">
            <dt className="text-xs text-muted-foreground">{a.question}</dt>
            <dd className="text-end text-sm">
              {a.answer == null || a.answer === ""
                ? <span className="italic text-muted-foreground">skipped</span>
                : a.answer}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3">
        {next ? <p className="text-xs text-muted-foreground">{next}</p> : <span />}
        {onEdit ? (
          <button type="button" onClick={onEdit}
            className="cursor-pointer whitespace-nowrap text-xs underline underline-offset-2">
            Change an answer
          </button>
        ) : null}
      </div>
    </div>
  );
}
