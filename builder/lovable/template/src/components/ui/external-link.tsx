import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A link that leaves the site, and says so.
 *
 * `rel="noreferrer"` is not decoration: with `target="_blank"` the new page can
 * otherwise reach back through `window.opener`.
 */
export function ExternalLink({ href, showIcon = true, className, children }: {
  href: string; showIcon?: boolean; className?: string; children?: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={cn("inline-flex items-center gap-0.5 underline underline-offset-4", className)}>
      {children}
      {showIcon && <ArrowUpRight className="size-3.5" aria-hidden="true" />}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
