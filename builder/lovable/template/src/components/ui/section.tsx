import { cn } from "@/lib/utils";
/** Vertical rhythm. Sections that set their own padding drift apart down a page. */
export function Section({ space = "md", muted, className, children, ...props }: React.ComponentProps<"section"> & {
  space?: "sm" | "md" | "lg"; muted?: boolean;
}) {
  const p = { sm: "py-10", md: "py-16", lg: "py-24" }[space];
  return <section className={cn(p, muted && "bg-muted/40", className)} {...props}>{children}</section>;
}
