import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The tone of a piece of feedback, as a worded chip.
 *
 * FOUR STATES, BECAUSE "MIXED" EXISTS. Feedback that praises the cut and
 * damns the queue forced into positive-or-negative is misfiled either way,
 * and misfiled feedback teaches the owner the wrong lesson.
 *
 * DISTINGUISHED BY SHAPE AND WEIGHT, never colour: positive is filled,
 * negative is a heavy outline, neutral is a quiet outline, mixed is dashed
 * (the kit's "two things at once" shape, same as source-label's AI). The
 * word is always there — the shape is speed, the word is the meaning.
 *
 * If this label was produced by a model, say so where it appears (pair with
 * source-label) — an inferred sentiment presented as a fact is how a
 * misread joke becomes a "negative review".
 */
export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

const SHAPE: Record<Sentiment, string> = {
  positive: "border-foreground bg-foreground text-background",
  negative: "border-2 border-foreground font-medium",
  neutral: "border-border text-muted-foreground",
  mixed: "border-dashed border-foreground/60",
};

export function SentimentChip({ sentiment, className }: {
  sentiment: Sentiment;
  className?: string;
}) {
  return (
    <span data-slot="sentiment-chip" className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] capitalize leading-4",
      SHAPE[sentiment], className)}>
      {sentiment}
    </span>
  );
}
