import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
/** "Best of 2026" — an accolade with its year, so it cannot silently go stale. */
export function AwardBadge({ title, year, issuer, className }: {
  title: string; year?: string | number; issuer?: string; className?: string;
}) {
  return (
    <span data-slot="award-badge" className={cn("inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5", className)}>
      <Award className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-xs leading-tight">
        <span className="block font-medium">{title}{year && <span className="tabular-nums"> {year}</span>}</span>
        {issuer && <span className="block text-muted-foreground">{issuer}</span>}
      </span>
    </span>
  );
}
