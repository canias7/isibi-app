import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { cn } from "@/lib/utils";
/**
 * Tell us what went wrong, from where it went wrong.
 *
 * THE CONTEXT IS ATTACHED AUTOMATICALLY and shown, not hidden. The page, the
 * error reference and the time are what make a report actionable, and asking the
 * reporter to supply them gets them wrong or omitted. Showing what is being sent
 * is the honesty half — a silent bundle of diagnostics is the thing people
 * refuse to send.
 *
 * ONE FIELD. Every extra question halves the number of reports, and a free-text
 * box plus automatic context beats a structured form nobody completes.
 *
 * The confirmation REPLACES the form and stays, so nobody submits twice
 * wondering whether it went.
 */
export function ReportProblem({ context, onSubmit, done: doneProp, className }: {
  /** What will be sent along — page, error code, time. Shown to the reporter. */
  context?: { label: string; value: string }[];
  onSubmit: (text: string) => void | Promise<unknown>;
  done?: boolean;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ownDone, setDone] = React.useState(false);
  const id = React.useId();
  const done = doneProp ?? ownDone;

  if (done) {
    return <p role="status" className={cn("text-sm font-medium", className)}>Thanks — we&apos;ve got it.</p>;
  }
  return (
    <form className={cn("flex flex-col gap-2", className)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !text.trim()) return;
        setBusy(true);
        try { await onSubmit(text.trim()); setDone(true); } finally { setBusy(false); }
      }}>
      <label htmlFor={id} className="text-sm font-medium">What went wrong?</label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={3}
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      {context?.length ? (
        <p className="text-xs text-muted-foreground">
          We&apos;ll include: {context.map((c) => `${c.label} ${c.value}`).join(" · ")}
        </p>
      ) : null}
      <div><BusyButton size="sm" type="submit" busy={busy} disabled={!text.trim()}>Send</BusyButton></div>
    </form>
  );
}
