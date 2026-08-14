import * as React from "react";
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
  // THE LABEL WAS NOT TIED TO ANYTHING. `htmlFor` is optional and nothing
  // generated an id, so `<FormRow label="Email"><Input /></FormRow>` — the
  // obvious call, and the one the signature invites — rendered a `<label>`
  // pointing at nothing and an input with no name. A screen reader announces
  // "edit text, blank", and clicking the label does not focus the field.
  //
  // So the id is generated and handed to the child, which is what this
  // component is FOR: the caller should not have to invent and thread one
  // through to get the single thing that makes a form row a form row.
  // An explicit `htmlFor` still wins, and a child that already has an `id`
  // keeps it — this only fills in the gap.
  const auto = React.useId();
  const child = React.isValidElement(children) ? children : null;
  const childId = (child?.props as { id?: string } | undefined)?.id;
  const id = htmlFor ?? childId ?? (child ? auto : undefined);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-muted-foreground" aria-hidden="true"> *</span>}
      </Label>
      {child && id && !childId
        ? React.cloneElement(child as React.ReactElement<{ id?: string }>, { id })
        : children}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p>
             : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
