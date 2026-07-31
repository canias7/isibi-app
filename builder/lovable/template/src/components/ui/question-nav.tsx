import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Back and next between survey questions.
 *
 * BACK NEVER LOSES THE ANSWER — that is the contract, and it is the caller's
 * state that honours it (answers live above this component, keyed by
 * question, so navigating is just changing which one shows). This component
 * exists to state the contract and keep the two buttons honest.
 *
 * NEXT IS DISABLED ONLY WHEN THE CALLER SAYS SO — for a genuinely required
 * question. Not as the default: "answer to continue" on every optional
 * question converts a survey into a gate, and gates get abandoned.
 *
 * The last step's button says what it does ("Finish"), because "Next" on the
 * final question makes people look for another question that is not there.
 */
export function QuestionNav({ step, total, onBack, onNext, nextDisabled, finishLabel = "Finish", className }: {
  step: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  finishLabel?: string;
  className?: string;
}) {
  const last = step >= total;
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <button type="button" onClick={onBack} disabled={step <= 1}
        className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
        Back
      </button>
      <span className="text-xs tabular-nums text-muted-foreground">{step} / {total}</span>
      <button type="button" onClick={onNext} disabled={nextDisabled}
        className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
        {last ? finishLabel : "Next"}
      </button>
    </div>
  );
}
