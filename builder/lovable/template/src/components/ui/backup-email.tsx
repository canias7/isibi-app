import * as React from "react";
import { Mail, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A second address, for when the first one is the thing that is lost.
 *
 * It is only worth anything if it is a DIFFERENT provider, and the component
 * says so — a backup on the same domain as the primary fails in exactly the
 * situation it exists for, which is losing access to that mailbox. It is a
 * hint, not a rule: refusing the address outright would be wrong for anyone
 * whose two addresses genuinely are on one domain they control.
 *
 * It is not usable until VERIFIED, and until then the screen says so rather
 * than showing it as set up. An unverified backup is the most dangerous state
 * here, because it looks like protection and is a typo.
 *
 * The stored address is shown MASKED — `a••@example.com`. This screen can be
 * reached by anyone holding a stolen session, and the full address is a second
 * account to go after; the masked form is enough for the owner to recognise
 * their own.
 */
export function maskEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const name = email.slice(0, at), domain = email.slice(at);
  return name.slice(0, 1) + "•".repeat(Math.max(2, Math.min(6, name.length - 1))) + domain;
}

export function BackupEmail({
  address, verified, onSave, onResend, primaryDomain, busy, error, className,
}: {
  address?: string;
  verified?: boolean;
  onSave: (email: string) => void;
  onResend?: () => void;
  primaryDomain?: string;
  busy?: boolean;
  error?: React.ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(!address);
  const [value, setValue] = React.useState("");
  const id = React.useId();
  const sameDomain = primaryDomain && value.toLowerCase().endsWith("@" + primaryDomain.toLowerCase());

  if (address && !editing) {
    return (
      <div className={cn("flex flex-col gap-2 rounded-lg border border-border p-4", className)}>
        <div className="flex items-start gap-3">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">Backup address</span>{" "}
              <span className="text-muted-foreground">{maskEmail(address)}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs">
              {verified ? (
                <><Check aria-hidden className="size-3" /> <span className="text-muted-foreground">Confirmed — it can be used to get back in.</span></>
              ) : (
                <span className="font-medium">Not confirmed yet, so it cannot be used to get back in.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setEditing(true); setValue(""); }}
            className="cursor-pointer text-xs underline underline-offset-2">Change it</button>
          {!verified && onResend ? (
            <button type="button" onClick={onResend} disabled={busy}
              className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Send the confirmation again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value && !busy) onSave(value); }}
      className={cn("flex flex-col gap-2 rounded-lg border border-border p-4", className)}>
      <label htmlFor={id} className="text-sm font-medium">Backup email address</label>
      <input id={id} type="email" value={value} onChange={(e) => setValue(e.target.value)}
        autoComplete="email" placeholder="another@example.com"
        aria-describedby={`${id}-hint`}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {sameDomain
          ? <span className="font-medium text-foreground">That is the same provider as your main address — if you lose one you lose both.</span>
          : "Use a different provider from your main address. We will send it a confirmation."}
      </p>
      {error ? <p role="alert" className="text-xs font-medium">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={!value || busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          {busy ? "Saving…" : "Save and confirm"}
        </button>
        {address ? (
          <button type="button" onClick={() => setEditing(false)}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Cancel</button>
        ) : null}
      </div>
    </form>
  );
}
