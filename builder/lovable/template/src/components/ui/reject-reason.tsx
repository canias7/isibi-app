import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Rejecting something, with the reason made compulsory.
 *
 * THE REASON IS REQUIRED AND THAT IS THE WHOLE COMPONENT. A rejection with no
 * explanation sends the requester back to guess, and they resubmit the same
 * thing — so the approver rejects it again, and a two-step process becomes
 * four. Requiring one sentence at the moment of rejection is the cheapest fix
 * there is.
 *
 * REASONS ARE OFFERED AS CHIPS FIRST, free text second. Most rejections are one
 * of five recurring things, and picking one takes a second where writing takes
 * a minute — which is what stops a busy approver typing "no" and moving on.
 *
 * SUBMIT IS DISABLED UNTIL THERE IS SOMETHING, with the button label saying
 * what is missing rather than a silent grey button somebody clicks four times.
 *
 * A `<form>`, so Enter submits and the browser's own validation applies.
 */
export function RejectReason({ reasons = [], onSubmit, onCancel, busy, label = "Why is this being rejected?", className }: {
  /** Common reasons, offered as one-tap chips. */
  reasons?: string[];
  onSubmit: (reason: string) => void;
  onCancel?: () => void;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  return (
    <form className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(text.trim()); }}>
      <div className="space-y-1.5">
        <label htmlFor={uid + "-reject-reason"} className="block text-sm font-medium">{label}</label>
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <button key={r} type="button" onClick={() => setText(r)}
                className={cn("rounded-full border px-2.5 py-1 text-xs",
                  text === r ? "border-foreground bg-foreground text-background" : "border-border")}>
                {r}
              </button>
            ))}
          </div>
        )}
        <textarea id={uid + "-reject-reason"} required rows={3} value={text} onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>
          {ready ? "Reject" : "Add a reason to reject"}
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
