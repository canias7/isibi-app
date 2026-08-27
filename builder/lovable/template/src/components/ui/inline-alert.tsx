import { cn } from "@/lib/utils";
/** One line under a field or a button. The smallest unit of "something happened". */
export function InlineAlert({ tone = "muted", className, children }: {
  tone?: "muted" | "success" | "warning" | "error"; className?: string; children?: React.ReactNode;
}) {
  const c = { muted: "text-muted-foreground", success: "text-success",
              warning: "text-warning", error: "text-destructive" }[tone];
  return (
    <p data-slot="inline-alert" role={tone === "error" ? "alert" : tone === "muted" ? undefined : "status"}
      className={cn("text-sm", c, className)}>{children}</p>
  );
}
