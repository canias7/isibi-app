import { cn } from "@/lib/utils";
/** Body copy with the two decisions that actually recur: size and emphasis. */
export function Text({ size = "md", tone = "default", as: As = "p", className, children }: {
  size?: "xs" | "sm" | "md" | "lg"; tone?: "default" | "muted";
  as?: "p" | "span" | "div"; className?: string; children?: React.ReactNode;
}) {
  const s = { xs:"text-xs", sm:"text-sm", md:"text-[15px]", lg:"text-lg" }[size];
  return <As className={cn(s, tone === "muted" && "text-muted-foreground", className)}>{children}</As>;
}
