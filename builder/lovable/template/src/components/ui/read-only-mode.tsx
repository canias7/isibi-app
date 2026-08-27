import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * This page is look-but-don't-touch, and here is why.
 *
 * Distinct from `write-blocked`, which is temporary and fires when somebody
 * tries to save. This is a standing condition of the whole view — a shared
 * link, an archived record, a closed period, an account without permission —
 * and it belongs at the top where it is read BEFORE any effort is spent.
 *
 * That ordering is the entire value. Somebody who fills in a long form and is
 * refused at the end has lost the work and the goodwill; the same person told
 * up front simply asks for access.
 *
 * `action` is the way out — request access, unarchive, switch account — because
 * a dead end with no next step is where support tickets come from.
 */
export function ReadOnlyMode({ reason, action, className }: {
  /** Why it is read-only. Omitted still renders the banner. */
  reason?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div data-slot="read-only-mode" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm", className)}>
      <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium">Read only</span>
      {reason && <span className="min-w-0 text-muted-foreground">{reason}</span>}
      {action && (
        action.href
          ? <a href={action.href} className="cursor-pointer underline underline-offset-4">{action.label}</a>
          : <button type="button" onClick={action.onClick}
              className="cursor-pointer underline underline-offset-4">{action.label}</button>
      )}
    </div>
  );
}
