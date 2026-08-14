import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * What stops working, and what is deleted, before an integration is removed.
 *
 * "STOPS" AND "IS DELETED" ARE SEPARATED, and that separation is the component.
 * Disconnecting usually just stops a flow — reconnecting later resumes it — but
 * sometimes it also removes mappings, history or records that took an afternoon
 * to set up. Those are completely different decisions and every disconnect
 * dialog presents them as one.
 *
 * NOTHING-IS-DELETED IS STATED OUT LOUD when true. That is the sentence that
 * makes a safe disconnect feel safe, and its absence is why people leave broken
 * integrations connected for years.
 *
 * DELETION REQUIRES TYPING THE NAME; a plain stop does not. The friction is
 * proportional to what is lost, rather than every disconnect being guarded the
 * same way — which is how people learn to type through the guard.
 *
 * WHAT ALREADY SYNCED IS UNAFFECTED, and that is said. People assume
 * disconnecting will unwind the records it created, and it does not.
 */
export function DisconnectWarning({ provider, stops = [], deletes = [], keeps, onDisconnect, onCancel, busy, className }: {
  provider: string;
  /** What will no longer happen. */
  stops?: string[];
  /** What will be destroyed. */
  deletes?: string[];
  /** What survives — defaults to a sentence about synced records. */
  keeps?: string;
  onDisconnect: () => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [typed, setTyped] = useState("");
  const destructive = deletes.length > 0;
  const ready = !destructive || typed.trim().toLowerCase() === provider.trim().toLowerCase();
  return (
    <form className={cn("space-y-3 rounded-md border border-border p-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onDisconnect(); }}>
      <p className="text-sm font-medium">Disconnect {provider}?</p>
      {stops.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">This will stop</p>
          <ul className="space-y-0.5 text-sm">
            {stops.map((s) => <li key={s} className="flex gap-2"><span aria-hidden="true">·</span><span>{s}</span></li>)}
          </ul>
        </div>
      )}
      {destructive ? (
        <div>
          <p className="text-xs font-medium">This will be deleted and cannot be recovered</p>
          <ul className="space-y-0.5 text-sm">
            {deletes.map((s) => <li key={s} className="flex gap-2"><span aria-hidden="true">·</span><span>{s}</span></li>)}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing is deleted. You can reconnect later and carry on.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {keeps ?? `Records already synced to ${provider} stay where they are.`}
      </p>
      {destructive && (
        <div className="space-y-1">
          <label htmlFor={uid + "-disc-confirm"} className="block text-sm">
            Type <span className="font-medium">{provider}</span> to confirm
          </label>
          <input id={uid + "-disc-confirm"} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>Disconnect</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Keep it connected</Button>}
      </div>
    </form>
  );
}
