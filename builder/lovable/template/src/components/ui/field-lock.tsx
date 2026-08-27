import * as React from "react";
import { Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A field that has to be unlocked before it can be changed — an email address,
 * a price, a booking reference.
 *
 * It is a guard against the ACCIDENT, not against the person: everything here
 * is client-side and the server has to enforce whatever actually matters. What
 * it buys is that nobody edits their account's email by tabbing through a
 * settings form, which is a real way people lock themselves out.
 *
 * Locked, the value is rendered as TEXT rather than a disabled input. A
 * disabled input is skipped by the tab order and is often unreadable in the
 * greyed-out state, so the one thing somebody wanted — to READ the current
 * value — gets harder. It also does not submit, which silently drops the field
 * from a plain HTML form.
 *
 * The reason is shown when there is one. "Locked" with no explanation invites a
 * support message; "Locked because invoices have been sent to it" does not.
 */
export function FieldLock({
  label, value, locked, onUnlock, reason, children, id, className,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  locked: boolean;
  onUnlock: () => void;
  reason?: React.ReactNode;
  children?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <div data-slot="field-lock" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
        {locked ? (
          <button type="button" onClick={onUnlock}
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            <Pencil aria-hidden className="size-3" />
            Change
          </button>
        ) : null}
      </div>
      {locked ? (
        <p id={fieldId} className="flex min-h-9 items-center gap-2 rounded-md bg-muted px-3 text-sm">
          <Lock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{value}</span>
          <span className="sr-only">(locked)</span>
        </p>
      ) : (
        children
      )}
      {locked && reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
    </div>
  );
}
