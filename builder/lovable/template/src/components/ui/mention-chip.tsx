import { cn } from "@/lib/utils";
/** An @name inside body text. A link when there is somewhere to go. */
export function MentionChip({ name, href, className }: {
  name: string; href?: string; className?: string;
}) {
  const cls = cn("rounded bg-muted px-1 py-0.5 text-sm font-medium", href && "hover:bg-muted/70", className);
  return href
    ? <a href={href} className={cls}>@{name}</a>
    : <span className={cls}>@{name}</span>;
}
