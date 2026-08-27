import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Before you go" — one question, and the door stays open.
 *
 * DISMISSING COSTS NOTHING AND SAYS SO. An exit survey that traps the exit
 * is why people rage-quit the whole product — "No thanks" is a real button,
 * same row as submit, and closing is never punished with a second modal.
 *
 * ONE QUESTION, BY CONSTRUCTION. The moment of leaving buys you one answer;
 * asking five gets zero. The reasons are radios (fast to answer), free text
 * appears only for "something else" — the report-reason rule, because that
 * reason says nothing by itself.
 *
 * After sending: a one-line thanks, no follow-up ask. The survey is a
 * favour they did us.
 */
export function ExitSurvey({ question = "What made you leave today?", reasons, onSubmit, onDismiss, className }: {
  question?: React.ReactNode;
  reasons: { key: string; label: string; needsDetail?: boolean }[];
  onSubmit: (reason: string, detail: string) => void;
  onDismiss: () => void;
  className?: string;
}) {
  const [picked, setPicked] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const chosen = reasons.find((r) => r.key === picked);
  const blocked = !picked || (chosen?.needsDetail && !detail.trim());

  if (sent) {
    return (
      <div data-slot="exit-survey" className={cn("rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground", className)}>
        Thanks — noted.
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}
      onSubmit={(e) => { e.preventDefault(); if (!blocked) { onSubmit(picked, detail.trim()); setSent(true); } }}
    >
      <p className="text-sm font-medium">{question}</p>
      <div className="flex flex-col gap-1.5">
        {reasons.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="exit-reason" checked={picked === r.key} onChange={() => setPicked(r.key)}
              className="size-3.5 cursor-pointer accent-foreground" />
            {r.label}
          </label>
        ))}
      </div>
      {chosen?.needsDetail ? (
        <textarea value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 300))} rows={2}
          placeholder="A few words is plenty"
          className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      ) : null}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={blocked}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          Send
        </button>
        {/* Leaving without answering is allowed, in the same breath as answering. */}
        <button type="button" onClick={onDismiss}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm">
          No thanks
        </button>
      </div>
    </form>
  );
}
