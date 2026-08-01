import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { cn } from "@/lib/utils";
/**
 * Ask for access, with a reason.
 *
 * THE MESSAGE FIELD IS THE WHOLE COMPONENT. A bare "request access" button
 * produces a notification with no context, and an owner looking at a name they
 * half-recognise usually does nothing — so the request expires and the person
 * asks a colleague instead.
 *
 * ALREADY-REQUESTED IS A STATE, not a repeat of the form. Without it people
 * press again and again, and each press is another notification, which makes the
 * owner less likely to act rather than more.
 *
 * The confirmation says WHO was asked, so the requester knows whether to chase
 * and who to chase.
 */
export function RequestAccess({ owner, requested, onRequest, className }: {
  /** Who receives it. */
  owner?: string;
  /** Already asked. */
  requested?: boolean;
  onRequest: (message: string) => void | Promise<unknown>;
  className?: string;
}) {
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const id = React.useId();
  if (requested || sent) {
    return (
      <p role="status" className={cn("text-sm", className)}>
        <span className="font-medium">Request sent</span>
        <span className="text-muted-foreground">{owner ? ` to ${owner}` : ""} — you&apos;ll hear when it&apos;s granted.</span>
      </p>
    );
  }
  return (
    <form className={cn("flex flex-col gap-2", className)}
      onSubmit={async (e) => {
        e.preventDefault(); if (busy) return;
        setBusy(true);
        try { await onRequest(msg.trim()); setSent(true); } finally { setBusy(false); }
      }}>
      <label htmlFor={id} className="text-sm font-medium">Why do you need access?</label>
      <textarea id={id} rows={2} value={msg} onChange={(e) => setMsg(e.target.value)}
        placeholder="I'm covering for Sam this week."
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      <div><BusyButton size="sm" type="submit" busy={busy}>Request access</BusyButton></div>
    </form>
  );
}
