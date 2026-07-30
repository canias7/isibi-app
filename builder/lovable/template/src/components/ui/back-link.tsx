import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
/** Up one level. Named, because "Back" alone tells nobody where they are going. */
export function BackLink({ href, label = "Back", className }: {
  href: string; label?: string; className?: string;
}) {
  return (
    <a href={href} className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground", className)}>
      <ArrowLeft className="size-4" />{label}
    </a>
  );
}
