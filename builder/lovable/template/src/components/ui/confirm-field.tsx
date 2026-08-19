import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Type it again" — the second field for an email address or a password.
 *
 * The mismatch is reported on BLUR, never per keystroke. Live-checking means
 * "these do not match" is on screen for the whole time somebody is typing the
 * matching value, so the message is present in the one state where it is least
 * useful and people learn to ignore it.
 *
 * `onPaste` is NOT blocked. Blocking paste on a confirm field is a widespread
 * habit that exists to stop people copying the first field into the second —
 * and it breaks every password manager, which is by far the biggest source of
 * strong passwords. Somebody determined to copy will retype it anyway.
 *
 * A MATCH is stated, not just the absence of an error. Two blank-looking fields
 * with no feedback is what makes people check three times before submitting.
 */
export function ConfirmField({
  value, onChange, against, label, id, type = "password", autoComplete, mismatchMessage, className,
}: {
  value: string;
  onChange: (next: string) => void;
  against: string;
  label: React.ReactNode;
  id?: string;
  type?: "password" | "email" | "text";
  autoComplete?: string;
  mismatchMessage?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const [touched, setTouched] = React.useState(false);
  const filled = value.length > 0 && against.length > 0;
  const matches = filled && value === against;
  const bad = touched && filled && !matches;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          autoComplete={autoComplete ?? (type === "password" ? "new-password" : undefined)}
          aria-invalid={bad || undefined}
          aria-describedby={bad || matches ? `${fieldId}-msg` : undefined}
          className={cn("h-9 w-full rounded-md border bg-background pe-8 ps-3 text-sm outline-none",
            bad ? "border-foreground" : "border-border focus-visible:border-ring")}
        />
        {matches ? (
          <Check aria-hidden className="absolute top-1/2 end-2.5 size-4 -translate-y-1/2" />
        ) : null}
      </div>
      {bad ? (
        <p id={`${fieldId}-msg`} role="alert" className="text-xs font-medium">
          {mismatchMessage ?? "These do not match."}
        </p>
      ) : matches ? (
        <p id={`${fieldId}-msg`} className="text-xs text-muted-foreground">Matches.</p>
      ) : null}
    </div>
  );
}
