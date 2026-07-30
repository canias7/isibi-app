import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Label, control, hint, error — the unit every form is made of.
 *
 * The label is tied to the control by a generated id rather than by the caller
 * remembering `htmlFor`, which is the single most-missed accessibility detail in
 * a hand-written form.
 */
export function FormRow({ label, htmlFor, hint, error, required, className, children }: {
  label: string; htmlFor?: string; hint?: string; error?: string;
  required?: boolean; className?: string; children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-muted-foreground" aria-hidden="true"> *</span>}
      </Label>
      {children}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p>
             : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
