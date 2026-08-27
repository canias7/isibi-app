import { cn } from "@/lib/utils";
/** Page width and gutters, in one place. Every section on a site sits in one. */
export function Container({ size = "lg", className, children }: {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string; children?: React.ReactNode;
}) {
  const w = { sm: "max-w-2xl", md: "max-w-4xl", lg: "max-w-6xl", xl: "max-w-7xl", full: "max-w-none" }[size];
  return <div data-slot="container" className={cn("mx-auto w-full px-6", w, className)}>{children}</div>;
}
