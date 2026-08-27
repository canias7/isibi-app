import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
/** Move between neighbouring records or articles. */
export function PrevNext({ prev, next, className }: {
  prev?: { label: string; href: string }; next?: { label: string; href: string }; className?: string;
}) {
  return (
    <nav data-slot="prev-next" className={cn("flex items-stretch justify-between gap-4 border-t pt-6", className)}>
      {prev ? (
        <a href={prev.href} className="group flex min-w-0 flex-col items-start gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowLeft className="size-3.5" />Previous</span>
          <span className="truncate text-sm font-medium group-hover:underline">{prev.label}</span>
        </a>
      ) : <span />}
      {next ? (
        <a href={next.href} className="group flex min-w-0 flex-col items-end gap-1 text-end">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">Next<ArrowRight className="size-3.5" /></span>
          <span className="truncate text-sm font-medium group-hover:underline">{next.label}</span>
        </a>
      ) : <span />}
    </nav>
  );
}
