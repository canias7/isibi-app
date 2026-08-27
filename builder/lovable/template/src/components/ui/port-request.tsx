import { cn } from "@/lib/utils";
/**
 * Moving a number to another provider.
 *
 * IT SAYS NOT TO CANCEL THE OLD ACCOUNT FIRST, prominently, because that is the
 * single mistake that loses somebody their number permanently. A cancelled line
 * has nothing left to transfer, and by the time anybody notices the number has
 * been released.
 *
 * THE PERIOD THE NUMBER IS UNREACHABLE IS STATED HONESTLY. There usually is one,
 * it is usually short, and pretending otherwise means somebody schedules a port
 * on the morning of something important.
 *
 * WHAT IS LOST IN THE MOVE IS LISTED. Voicemail messages, a remaining allowance
 * and any credit on the old account are frequently not transferable, and finding
 * that out afterwards is what makes an otherwise fine process feel like a trick.
 *
 * THE AUTHORISATION CODE HAS AN EXPIRY AND IT IS SHOWN. Codes lapse, and a
 * lapsed code discovered on the day of the move restarts the whole thing.
 */
export function PortRequest({ number, fromProvider, code, codeExpiresOn, scheduledFor, downtimeNote = "usually under an hour, sometimes a few", lost = [], state = "waiting", className }: {
  number: string;
  fromProvider?: string;
  /** Codes lapse. */
  code?: string;
  codeExpiresOn?: string;
  scheduledFor?: string;
  downtimeNote?: string;
  /** Voicemail, remaining allowance, credit. */
  lost?: string[];
  state?: "waiting" | "scheduled" | "done" | "failed";
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  if (state === "done") {
    return (
      <div data-slot="port-request" className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium tabular-nums">{number} has moved across.</p>
        <p className="text-xs text-muted-foreground">You can close the old account now, and not before.</p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium">
        Do not cancel your account with {fromProvider ?? "your current provider"} yet. A cancelled line has no number
        left to move, and that cannot be undone.
      </p>
      <p className="tabular-nums">
        {number}
        {fromProvider ? ` · from ${fromProvider}` : ""}
        {scheduledFor ? ` · moving ${scheduledFor}` : ""}
      </p>
      {code && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Code {code}
          {codeExpiresOn ? ` — expires ${codeExpiresOn}, after which you need a new one` : ""}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Your number will be unreachable for a short window on the day — {downtimeNote}. Do not book the move for a
        morning that matters.
      </p>
      {lost.length > 0 && (
        <p className="text-xs">Not carried across: {AND.format(lost)}.</p>
      )}
      {state === "failed" && (
        <p className="text-xs font-medium">
          The transfer did not go through. Your number is still with the old provider and still works.
        </p>
      )}
    </div>
  );
}
