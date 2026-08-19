import { TimeAgo } from "@/components/ui/time-ago";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Passed to Grace, 20 minutes ago — customer called twice."
 *
 * A handover inside a ticket, distinct from a reply: it is internal, and the
 * left rule plus "Internal" says so on its face. A note that looks like a
 * message is one that eventually gets sent to the customer.
 */
export function EscalationNote({ to, from, at, reason, className }: {
  to: string; from?: string; at?: string | number | Date; reason?: string; className?: string;
}) {
  return (
    <div className={cn("border-s-2 border-warning bg-warning/5 py-2 ps-3", className)}>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide text-warning">Internal</span>
        {/* Both people are NAMED. An avatar in the middle of a sentence reads
            as a stray initial: "Internal A → Grace Hopper" says nothing about
            who passed it on, which is half of what a handover records. */}
        {from && <span className="font-medium text-foreground">{from}</span>}
        <ArrowUpRight className="size-3" />
        <span className="font-medium text-foreground">{to}</span>
        {at && <TimeAgo date={at} />}
      </p>
      {reason && <p className="mt-1 text-sm">{reason}</p>}
    </div>
  );
}
