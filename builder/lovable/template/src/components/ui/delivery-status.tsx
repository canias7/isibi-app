import * as React from "react";
import { Check, CheckCheck, Clock, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Sent, delivered, read, bounced — what happened to a message.
 *
 * SENT AND DELIVERED ARE DIFFERENT STATES and both matter. "Sent" means it left
 * here; "delivered" means the other end accepted it. An email that was sent and
 * never delivered is the case somebody is investigating, and a UI showing only
 * "sent" cannot express it.
 *
 * A BOUNCE SAYS WHETHER IT IS PERMANENT. A hard bounce means the address is
 * wrong and re-sending will never work; a soft bounce is a full mailbox and
 * will. Collapsing them into "failed" sends people to retry the one that
 * cannot succeed.
 *
 * "READ" IS ONLY SHOWN WHEN IT IS KNOWN, never inferred from delivery. Read
 * receipts are blocked by most mail clients by default, so absence means
 * nothing — and a UI that shows "unread" for a message somebody read an hour
 * ago is actively misleading.
 *
 * Each state is a distinct GLYPH plus a word, never colour alone — the same
 * rule as `build-status`, and this list is scanned down a column too.
 */
export function DeliveryStatus({ state, at, detail, permanent, onRetry, className }: {
  state: "queued" | "sent" | "delivered" | "read" | "bounced" | "failed";
  at?: React.ReactNode;
  detail?: React.ReactNode;
  permanent?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  const Icon = state === "read" ? CheckCheck
    : state === "delivered" || state === "sent" ? Check
    : state === "queued" ? Clock
    : state === "bounced" ? AlertTriangle
    : X;
  const word = {
    queued: "Waiting to send", sent: "Sent", delivered: "Delivered",
    read: "Read", bounced: "Bounced", failed: "Failed",
  }[state];
  const bad = state === "bounced" || state === "failed";

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 text-xs", className)}>
      <Icon aria-hidden className={cn("size-3.5 shrink-0", !bad && "text-muted-foreground")} />
      <span className={cn(bad && "font-medium")}>{word}</span>
      {at ? <span className="text-muted-foreground">{at}</span> : null}
      {bad ? (
        <span className="text-muted-foreground">
          {/* Retrying a hard bounce can never work. */}
          {permanent ? "— the address is wrong, so retrying will not help" : "— temporary, worth another try"}
          {detail ? <> ({detail})</> : null}
        </span>
      ) : null}
      {bad && !permanent && onRetry ? (
        <button type="button" onClick={onRetry}
          className="cursor-pointer font-medium underline underline-offset-2">Send it again</button>
      ) : null}
    </span>
  );
}
