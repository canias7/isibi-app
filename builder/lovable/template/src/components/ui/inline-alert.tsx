import { cn } from "@/lib/utils";
/** One line under a field or a button. The smallest unit of "something is wrong". */
export function InlineAlert({ tone = "muted", className, children }: {
  tone?: "muted" | "error"; className?: string; children?: React.ReactNode;
}) {
  return (
    <p role={tone === "error" ? "alert" : undefined}
      className={cn("text-sm", tone === "error" ? "text-destructive" : "text-muted-foreground", className)}>
      {children}
    </p>
  );
}
