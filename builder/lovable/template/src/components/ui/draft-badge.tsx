import { cn } from "@/lib/utils";
/**
 * This is not published.
 *
 * Outlined rather than filled, and it is the ONE thing on a page of otherwise
 * finished-looking content that says so. The failure it prevents is somebody
 * sending a customer a link to a draft — which looks identical to the real
 * page until they scroll back up.
 */
export function DraftBadge({ label = "Draft", className }: { label?: string; className?: string }) {
  return (
    <span data-slot="draft-badge" className={cn("inline-flex items-center rounded border border-warning/60 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warning", className)}>
      {label}
    </span>
  );
}
