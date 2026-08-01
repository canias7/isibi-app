import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Passing something up, with a reason and a named recipient.
 *
 * IT NAMES WHO IT GOES TO, and the list is people rather than a queue.
 * "Escalated" into an abstract tier is how something sits for two days —
 * everybody assumes it belongs to somebody, and nobody is that somebody. A name
 * makes it owned the moment it moves.
 *
 * THE REASON IS COMPULSORY, for the same reason `reject-reason` requires one:
 * an escalation with no explanation gets sent straight back, and the round trip
 * costs more than the thirty seconds of typing.
 *
 * IT WARNS WHEN NOBODY IS AVAILABLE. Escalating at 3am to a person who is not
 * on shift is worse than not escalating, because it FEELS handled — the caller
 * marks who is on, and the component says so before the click.
 *
 * NOT DESTRUCTIVE STYLING. Escalating is a normal, encouraged act; dressing it
 * in red makes people avoid it, which is the opposite of what any escalation
 * path is for.
 */
export type EscalateTarget = { id: string; name: string; role?: string; available?: boolean };

export function EscalateAction({ targets, reasons = [], onEscalate, onCancel, busy, className }: {
  targets: EscalateTarget[];
  /** Common reasons, offered as chips. */
  reasons?: string[];
  onEscalate: (v: { to: string; reason: string }) => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const target = targets.find((t) => t.id === to);
  const away = target && target.available === false;
  const ready = Boolean(to && reason.trim());
  return (
    <form className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onEscalate({ to, reason: reason.trim() }); }}>
      <div className="space-y-1">
        <label htmlFor="esc-to" className="block text-sm font-medium">Pass this to</label>
        <NativeSelect id="esc-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.role ? ` — ${t.role}` : ""}{t.available === false ? " (not on shift)" : ""}
            </option>
          ))}
        </NativeSelect>
        {away && (
          <p className="text-xs font-medium">
            {target!.name} is not on shift — this may not be picked up until they are back.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="esc-why" className="block text-sm font-medium">Why are you passing it up?</label>
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs",
                  reason === r ? "border-foreground bg-foreground text-background" : "border-border")}>
                {r}
              </button>
            ))}
          </div>
        )}
        <textarea id="esc-why" rows={2} required value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!ready || busy}>Pass it up</Button>
        {onCancel && <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
