import { cn } from "@/lib/utils";
/** Submit and cancel. Right-aligned, primary last — the order a form is read in. */
export function FormActions({ align = "end", sticky, className, children }: {
  align?: "start" | "end" | "between"; sticky?: boolean;
  className?: string; children?: React.ReactNode;
}) {
  const a = { start: "justify-start", end: "justify-end", between: "justify-between" }[align];
  return (
    <div className={cn("flex flex-wrap items-center gap-2 pt-2", a,
      sticky && "sticky bottom-0 border-t bg-background/90 py-3 backdrop-blur", className)}>
      {children}
    </div>
  );
}
