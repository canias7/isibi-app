import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A whole card that is one link.
 *
 * The <a> wraps the card rather than sitting inside it, so the entire surface is
 * the hit target — on a phone that is the difference between tappable and not.
 */
export function LinkCard({ title, description, href, external, icon, className }: {
  title: string; description?: string; href: string;
  external?: boolean; icon?: React.ReactNode; className?: string;
}) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
      className={cn("group flex items-start gap-3 rounded-xl border bg-card p-4 hover:bg-muted/50", className)}>
      {icon && <span className="mt-0.5 text-muted-foreground [&_svg]:size-5">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 font-medium">
          {title}
          {external && <ArrowUpRight className="size-3.5 text-muted-foreground" />}
        </span>
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </a>
  );
}
