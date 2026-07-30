import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
/** A verification mark, with the reason available rather than implied. */
export function VerifiedBadge({ label = "Verified", title, className }: {
  label?: string; title?: string; className?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 text-xs font-medium text-success", className)}>
      <BadgeCheck className="size-3.5" />{label}
    </span>
  );
}
