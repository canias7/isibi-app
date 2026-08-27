import { Check, CheckCheck, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Sending / sent / delivered / read / failed.
 *
 * Every state has a WORD in `sr-only`, because the tick-versus-double-tick
 * convention is learned rather than obvious and means nothing to anybody who
 * cannot see it. Failed is the one that also shows its word on screen: a
 * message that silently did not send is the worst outcome here.
 */
export function MessageStatus({ state, className }: {
  state: "sending" | "sent" | "delivered" | "read" | "failed"; className?: string;
}) {
  const map = {
    sending: { icon: Clock, label: "Sending", tone: "text-muted-foreground" },
    sent: { icon: Check, label: "Sent", tone: "text-muted-foreground" },
    delivered: { icon: CheckCheck, label: "Delivered", tone: "text-muted-foreground" },
    read: { icon: CheckCheck, label: "Read", tone: "text-foreground" },
    failed: { icon: TriangleAlert, label: "Not sent", tone: "text-destructive" },
  }[state];
  const Icon = map.icon;
  return (
    <span data-slot="message-status" className={cn("inline-flex items-center gap-1", map.tone, className)}>
      <Icon className="size-3" />
      {state === "failed" ? map.label : <span className="sr-only">{map.label}</span>}
    </span>
  );
}
