import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Confirm it's you" before something that cannot be undone.
 *
 * It asks for the CURRENT password even though there is already a session, and
 * that is the entire point: without it, a stolen session token is a permanent
 * account takeover — change the address, change the password, and the real
 * owner can never reset their way back in. The same reasoning puts a current
 * password on the password-change route.
 *
 * It names the ACTION it is guarding. "Confirm your password" with no context
 * is exactly the shape of a phishing prompt, and people are right to hesitate;
 * "to change the email address on this account" tells them what they are
 * authorising and makes an unexpected one recognisable.
 *
 * The field is `autoComplete="current-password"`, so a password manager fills
 * it. A step-up that managers cannot fill is the reliable way to make people
 * choose a password they can type.
 *
 * ONE error for the whole prompt, and it does not distinguish wrong-password
 * from anything else — the same rule the sign-in form follows.
 */
export function StepUpPrompt({
  action, onConfirm, onCancel, busy, error, alternative, className,
}: {
  action: React.ReactNode;
  onConfirm: (password: string) => void;
  onCancel?: () => void;
  busy?: boolean;
  error?: React.ReactNode;
  alternative?: React.ReactNode;
  className?: string;
}) {
  const [password, setPassword] = React.useState("");
  const id = React.useId();
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { ref.current?.focus(); }, []);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (password && !busy) onConfirm(password); }}
      className={cn("flex flex-col gap-3 rounded-lg border border-border p-4", className)}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Confirm it&rsquo;s you</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter your password {action}.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="sr-only">Current password</label>
        <input
          ref={ref}
          id={id}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn("h-9 rounded-md border bg-background px-3 text-sm outline-none",
            error ? "border-foreground" : "border-border focus-visible:border-ring")}
        />
        {error ? <p id={`${id}-err`} role="alert" className="text-xs font-medium">{error}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!password || busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          {busy ? "Checking…" : "Confirm"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={busy}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Cancel
          </button>
        ) : null}
        {alternative ? <span className="ms-auto text-xs">{alternative}</span> : null}
      </div>
    </form>
  );
}
