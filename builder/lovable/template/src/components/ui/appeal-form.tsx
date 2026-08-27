import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Appealing a moderation decision.
 *
 * THE ORIGINAL DECISION IS RESTATED FIRST — what was removed, which rule,
 * when. An appeal form that does not say what it is about produces appeals
 * that argue with the wrong thing, and the person appealing may genuinely
 * not know which of their posts went.
 *
 * ONE TEXT FIELD, BOUNDED. The appeal is "why should this be reconsidered",
 * not a legal filing; a cap with a visible count keeps it writable and
 * readable. The counter appears only near the limit — counting down from
 * 1000 on an empty box reads as a demand.
 *
 * ONE APPEAL PER DECISION, and an already-made appeal shows as its own
 * state with the date — a form that accepts a second appeal into the void
 * is crueller than saying "you have appealed, an answer is coming".
 *
 * EXPECTATIONS ARE SET IN THE FORM: how long an answer usually takes, and
 * that the answer comes either way. Silence after submitting is what makes
 * people distrust the process.
 */
export function AppealForm({ what, rule, decidedAt, reviewDays = 7, appealedAt, onSubmit, className }: {
  what: string;
  rule?: string;
  decidedAt?: string;
  reviewDays?: number;
  appealedAt?: string;
  onSubmit: (text: string) => void;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = React.useId();
  const [text, setText] = React.useState("");
  const MAX = 1000;

  return (
    <div data-slot="appeal-form" className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <div>
        <p className="text-sm font-medium">Appeal a removal</p>
        {/* The decision being appealed, stated so the appeal can argue with the right thing. */}
        <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          Removed{decidedAt ? ` on ${decidedAt}` : ""}: <span className="text-foreground">{what}</span>
          {rule ? <> — under “{rule}”</> : null}
        </p>
      </div>
      {appealedAt ? (
        <p className="text-sm text-muted-foreground">
          You appealed on {appealedAt}. A different person is looking at it — you will get an answer
          either way, usually within {reviewDays} day{reviewDays === 1 ? "" : "s"}.
        </p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(text.trim()); }}>
          <label className="text-xs text-muted-foreground" htmlFor={uid + "-appeal-why"}>Why should this be reconsidered?</label>
          <textarea id={uid + "-appeal-why"} value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={4}
            className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {MAX - text.length < 100 ? (
            <p className="text-end text-[11px] tabular-nums text-muted-foreground">{MAX - text.length} left</p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Read by someone not involved in the original decision. Usually answered within {reviewDays} day{reviewDays === 1 ? "" : "s"}.
            </p>
            <button type="submit" disabled={!text.trim()}
              className="cursor-pointer whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
              Send appeal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
