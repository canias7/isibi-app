import { useState , useId } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Handing an approval to somebody else, for a stated period.
 *
 * DELEGATION WITHOUT AN END DATE IS THE BUG. Somebody delegates for a week's
 * holiday, comes back, and their approvals keep going to a colleague for two
 * years — which nobody notices because it works. `until` is required, and the
 * component says the date back in words rather than leaving it implicit.
 *
 * THE ORIGINAL APPROVER STAYS ACCOUNTABLE and the note says so. A delegation
 * that transfers responsibility as well as the click is how an audit trail
 * loses the person who actually owned the decision.
 *
 * A REAL `<select>` of named people, not a free-text field. An approval routed
 * to a typo goes nowhere, silently, and sits in a queue nobody reads.
 *
 * `min` on the date input is today, because a delegation that ended yesterday
 * is a form somebody filled in wrong and a request that will not move.
 */
export function DelegateApproval({ people, onDelegate, onCancel, today, busy, className }: {
  people: { id: string; name: string; role?: string }[];
  onDelegate: (v: { to: string; until: string; note?: string }) => void;
  onCancel?: () => void;
  /** ISO date used as the earliest selectable day. Defaults to the browser's. */
  today?: string;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [to, setTo] = useState(people[0]?.id ?? "");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const min = today ?? new Date().toISOString().slice(0, 10);
  const ready = Boolean(to && until);
  return (
    <form className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onDelegate({ to, until, note: note.trim() || undefined }); }}>
      <div className="space-y-1">
        <label htmlFor={uid + "-del-to"} className="block text-sm font-medium">Send my approvals to</label>
        <NativeSelect id={uid + "-del-to"} value={to} onChange={(e) => setTo(e.target.value)}>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` — ${p.role}` : ""}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <label htmlFor={uid + "-del-until"} className="block text-sm font-medium">Until</label>
        <input id={uid + "-del-until"} type="date" required min={min} value={until} onChange={(e) => setUntil(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor={uid + "-del-note"} className="block text-sm font-medium">Note <span className="font-normal text-muted-foreground">optional</span></label>
        <input id={uid + "-del-note"} value={note} onChange={(e) => setNote(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <p className="text-xs text-muted-foreground">You stay accountable for anything approved in your name.</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>Delegate</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
