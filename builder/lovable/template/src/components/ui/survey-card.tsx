import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The frame for one survey question at a time.
 *
 * ONE QUESTION PER SCREEN. A wall of twenty questions gets abandoned at the
 * scroll; one at a time with visible progress gets finished. The card is the
 * frame that keeps that discipline — it takes ONE question's content.
 *
 * SKIPPABLE BY DEFAULT, WITH THE SKIP VISIBLE. A forced answer is a
 * fabricated answer — the person who cannot skip picks anything to get past
 * the gate, and that answer poisons the average. `onSkip` renders a real
 * "Skip this one"; omitting it is the caller declaring the question truly
 * required, which should be rare and deliberate.
 *
 * PROGRESS IS STATED IN WORDS ("2 of 5"), not only a bar — a bar without
 * numbers answers "how much more" with "some".
 */
export function SurveyCard({ step, total, question, hint, onSkip, children, className }: {
  step: number;
  total: number;
  question: React.ReactNode;
  hint?: React.ReactNode;
  onSkip?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section data-slot="survey-card" className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground tabular-nums">
        Question {step} of {total}
      </p>
      <div>
        <h3 className="text-base font-semibold leading-snug">{question}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div>{children}</div>
      {onSkip ? (
        <button type="button" onClick={onSkip}
          className="cursor-pointer self-start text-xs text-muted-foreground underline underline-offset-2">
          Skip this one
        </button>
      ) : null}
    </section>
  );
}
