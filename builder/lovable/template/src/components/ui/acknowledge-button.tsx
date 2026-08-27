import * as React from "react";
import { Check } from "lucide-react";
import { BusyButton } from "@/components/ui/busy-button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * "I have read this" — recorded, with the time.
 *
 * ACKNOWLEDGED IS A PERMANENT STATE, not a toast. The whole point is that
 * somebody can later show they read it, so the record replaces the button and
 * keeps its timestamp rather than flashing a confirmation and reverting.
 *
 * IT CANNOT BE UNDONE from here, deliberately. An acknowledgement that can be
 * withdrawn by the person who gave it is not evidence of anything, and offering
 * an undo invites exactly the argument the record exists to settle.
 *
 * `BusyButton`, because a double press on something being written to an audit
 * log is two rows claiming different times.
 */
export function AcknowledgeButton({ acknowledgedAt, onAcknowledge, label = "I've read this", className }: {
  acknowledgedAt?: string | number | Date | null;
  onAcknowledge: () => void | Promise<unknown>;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  if (acknowledgedAt) {
    return (
      <p data-slot="acknowledge-button" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
        <Check aria-hidden className="size-4 shrink-0" />
        Read <DateFormat date={acknowledgedAt} withTime />
      </p>
    );
  }
  return (
    <BusyButton size="sm" busy={busy} className={className}
      onClick={async () => { setBusy(true); try { await onAcknowledge(); } finally { setBusy(false); } }}>
      {label}
    </BusyButton>
  );
}
