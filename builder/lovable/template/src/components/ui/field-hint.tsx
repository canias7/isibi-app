import { cn } from "@/lib/utils";
/** The quiet line under a field. */
export function FieldHint({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <p data-slot="field-hint" className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}
