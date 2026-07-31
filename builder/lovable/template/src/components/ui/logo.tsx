import { cn } from "@/lib/utils";
/**
 * A business's mark: its image if it has uploaded one, otherwise its initials.
 *
 * A generated site has no logo on day one, and a broken image where the name
 * should be is worse than no logo at all.
 */
export function Logo({ src, name, href = "/", size = "md", className }: {
  src?: string | null; name: string; href?: string;
  size?: "sm" | "md" | "lg"; className?: string;
}) {
  const h = { sm: "h-6", md: "h-8", lg: "h-10" }[size];
  const t = { sm: "text-sm", md: "text-base", lg: "text-lg" }[size];
  const inner = src
    ? <img src={src} alt={name} className={cn(h, "w-auto")} />
    : <span className={cn("font-semibold tracking-tight", t)}>{name}</span>;
  return <a href={href} className={cn("inline-flex items-center", className)} aria-label={name}>{inner}</a>;
}
