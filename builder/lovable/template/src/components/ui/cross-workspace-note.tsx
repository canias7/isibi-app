import { cn } from "@/lib/utils";
/**
 * "This record lives in another workspace" — a boundary, made visible.
 *
 * DATA DOES NOT CROSS WORKSPACES SILENTLY, and where it appears to, somebody
 * needs telling. A record shown in one workspace but owned by another cannot be
 * edited here, will vanish if that workspace revokes access, and is not covered
 * by this workspace's own retention or deletion — none of which is guessable
 * from the row.
 *
 * IT NAMES THE OWNING WORKSPACE. "Shared from elsewhere" leaves somebody unable
 * to ask the right person for a change, which is the only action available to
 * them.
 *
 * IT SAYS WHAT IS POSSIBLE HERE, in the positive. "Read only" is a refusal;
 * "you can see it and reference it, changes have to be made in Acme" tells
 * somebody what to do next.
 *
 * `role="note"` — a standing fact about the record, not a live update, and it
 * must not interrupt.
 */
export function CrossWorkspaceNote({ owner, can, contact, className }: {
  /** The workspace that owns it. */
  owner: string;
  /** What is possible here — defaults to a read-only sentence. */
  can?: string;
  /** Who to ask — "Ada Vance". */
  contact?: string;
  className?: string;
}) {
  return (
    <p data-slot="cross-workspace-note" role="note" className={cn("text-xs text-muted-foreground", className)}>
      This belongs to <span className="text-foreground">{owner}</span>.{" "}
      {can ?? "You can see it and refer to it here; changes have to be made there."}
      {contact && <span> Ask {contact} if it needs changing.</span>}
      <span className="block">
        If {owner} stops sharing it, it disappears from here.
      </span>
    </p>
  );
}
