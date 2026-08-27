import { StatusBadge } from "@/components/ui/status-badge";
import { cn, isoAttr, toDate } from "@/lib/utils";
/** One release. The date is a real <time>, so it is machine-readable. */
export function ChangelogEntry({ version, date, tag, children, className }: {
  version: string; date?: string | number | Date;
  tag?: "new" | "fixed" | "changed"; children?: React.ReactNode; className?: string;
}) {
  const badge = tag ? { new: "success", fixed: "warning", changed: "neutral" }[tag] as
    "success" | "warning" | "neutral" : null;
  return (
    <article data-slot="changelog-entry" className={cn("border-b border-border py-5 last:border-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium tabular-nums">{version}</h3>
        {badge && <StatusBadge state={badge}>{tag}</StatusBadge>}
        {date && (
          <time dateTime={isoAttr(date)} className="text-sm text-muted-foreground">
            {toDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </time>
        )}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </article>
  );
}
