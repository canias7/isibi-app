import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * A reference, shortened, that copies in FULL.
 *
 * That split is the whole component: an order number or a row id is shown
 * truncated because it is long and copied whole because a truncated one is
 * useless. Showing `a1b2c3…` and copying `a1b2c3…` is the bug it prevents.
 */
export function IdBadge({ id, head = 6, tail = 0, label = "Copy id", className }: {
  id: string; head?: number; tail?: number; label?: string; className?: string;
}) {
  const short = id.length <= head + tail + 1
    ? id
    : tail > 0 ? `${id.slice(0, head)}…${id.slice(-tail)}` : `${id.slice(0, head)}…`;
  return (
    <span data-slot="id-badge" className={cn("inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs", className)}>
      <span title={id}>{short}</span>
      <CopyButton value={id} label={label} iconOnly />
    </span>
  );
}
