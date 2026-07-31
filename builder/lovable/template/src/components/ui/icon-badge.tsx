import { cn } from "@/lib/utils";
/** An icon in a tile. The thing at the top of a feature card. */
export function IconBadge({ size = "md", variant = "muted", className, children }: {
  size?: "sm" | "md" | "lg"; variant?: "muted" | "outline" | "solid";
  className?: string; children?: React.ReactNode;
}) {
  const s = { sm: "size-8 [&_svg]:size-4", md: "size-10 [&_svg]:size-5", lg: "size-12 [&_svg]:size-6" }[size];
  const v = { muted: "bg-muted text-foreground", outline: "border text-foreground",
              solid: "bg-foreground text-background" }[variant];
  return <span className={cn("grid shrink-0 place-items-center rounded-lg", s, v, className)}>{children}</span>;
}
