import { cn } from "@/lib/utils";
/**
 * What somebody is allowed to do — Owner, Admin, Member, Viewer.
 *
 * Only the OWNER is emphasised, and only because there is usually exactly one
 * and removing them is the irreversible mistake this label exists to prevent.
 * Everything else is quiet: a members list where every row shouts is a list
 * where the one that matters does not stand out.
 *
 * `pending` is a state of the invitation, not a role, so it is written as a
 * separate word rather than becoming a fifth badge colour.
 */
export function RoleBadge({ role, pending, className }: {
  role: string; pending?: boolean; className?: string;
}) {
  const owner = /^owner$/i.test(role);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize",
        owner ? "border-foreground" : "border-border text-muted-foreground")}>
        {role}
      </span>
      {pending && <span className="text-[11px] text-muted-foreground">invitation pending</span>}
    </span>
  );
}
