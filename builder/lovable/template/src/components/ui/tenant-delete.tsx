import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Deleting a whole workspace — the most destructive act in a product.
 *
 * IT COUNTS THE OTHER PEOPLE AFFECTED, and that is what makes it different from
 * `delete-my-data`. Deleting your own account harms you; deleting a workspace
 * removes eleven colleagues' work, and the number is the fact most likely to
 * make somebody stop and check.
 *
 * THE SUBDOMAIN IS RELEASED OR RESERVED, AND IT SAYS WHICH. If the name becomes
 * available to strangers immediately, every old link points at somebody else's
 * site — which is a security matter, not a tidiness one.
 *
 * A GRACE PERIOD IS STATED WHERE THERE IS ONE, because for a workspace deletion
 * this is the difference between a recoverable mistake and a company losing
 * three years of records.
 *
 * TYPING THE WORKSPACE NAME, not a fixed word: it is the one confirmation that
 * cannot be satisfied by muscle memory from the last dialog, and it proves
 * which workspace is in front of them.
 */
export function TenantDelete({ name, memberCount, recordCounts = [], graceDays, subdomainReleased, onDelete, onCancel, busy, className }: {
  name: string;
  /** How many other people lose access. */
  memberCount?: number;
  /** What goes — "1,240 bookings", "8 GB of files". */
  recordCounts?: string[];
  graceDays?: number;
  /** True if the name becomes available to others. */
  subdomainReleased?: boolean;
  onDelete: () => void;
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
  const ready = typed.trim().toLowerCase() === name.trim().toLowerCase();
  return (
    <form className={cn("space-y-3 rounded-md border border-foreground/40 bg-muted/40 p-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onDelete(); }}>
      <p className="text-sm font-medium">Delete the whole {name} workspace</p>
      {memberCount !== undefined && memberCount > 0 && (
        <p className="text-sm">
          <span className="font-medium tabular-nums">{memberCount.toLocaleString()}</span> other{" "}
          {memberCount === 1 ? "person loses" : "people lose"} access to everything in it.
        </p>
      )}
      {recordCounts.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {recordCounts.map((r) => (
            <li key={r} className="flex gap-2"><span aria-hidden="true">·</span><span>{r}</span></li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {graceDays
          ? `You have ${graceDays} days to change your mind. After that it cannot be undone.`
          : "This cannot be undone."}
        {subdomainReleased
          ? " The address becomes available to anyone, so old links may reach someone else's site."
          : " The address is kept and cannot be taken by anyone else."}
      </p>
      <div className="space-y-1">
        <label htmlFor={uid + "-td-confirm"} className="block text-sm">
          Type <span className="font-medium">{name}</span> to confirm
        </label>
        <input id={uid + "-td-confirm"} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>Delete this workspace</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Keep it</Button>}
      </div>
    </form>
  );
}
