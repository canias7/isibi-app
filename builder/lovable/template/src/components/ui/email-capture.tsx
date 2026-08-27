import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { ConsentCheckbox } from "@/components/ui/consent-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The newsletter block. One field, one button, one promise.
 *
 * The SUCCESS STATE REPLACES THE FORM and stays there. A toast is wrong here:
 * it disappears, and the reader is left looking at an empty field that gives no
 * sign whether the thing worked — so they submit again, which is how a list
 * collects the same address three times.
 *
 * `type="email"` + `autoComplete="email"` + `inputMode="email"` is most of what
 * makes this fillable on a phone, and it is what a hand-written version of this
 * block always forgets.
 *
 * NO email validation beyond "there is something with an @ in it". The
 * `phone-input` reasoning applies unchanged: real addresses defeat every simple
 * rule, and refusing a real one is worse than accepting an odd one. The server
 * finds out for certain when it tries to deliver.
 *
 * `consent` is optional, and REQUIRED once given — a consent box that can be
 * ignored is worse than none, because it looks like a record of permission and
 * is not one. One error line for the whole form, never one per field.
 *
 * `BusyButton` because a submit that looks inert gets pressed again.
 */
export function EmailCapture({
  title, blurb, placeholder = "you@example.com", cta = "Subscribe",
  consent, note, done: doneProp, doneMessage = "Thanks — check your inbox to confirm.",
  onSubmit, id = "email-capture", className,
}: {
  title?: string;
  blurb?: string;
  placeholder?: string;
  cta?: string;
  /** Consent wording. Present means the box must be ticked to submit. */
  consent?: React.ReactNode;
  /** The small print under the button — how often, how to leave. */
  note?: React.ReactNode;
  /** Force the confirmed state, for a caller that already knows. */
  done?: boolean;
  doneMessage?: string;
  onSubmit: (email: string) => void | Promise<unknown>;
  id?: string;
  className?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ownDone, setDone] = React.useState(false);
  const done = doneProp ?? ownDone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.includes("@")) { setError("Enter an email address."); return; }
    if (consent && !agreed) { setError("Please tick the box to continue."); return; }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(email.trim());
      setDone(true);
    } catch {
      setError("That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-slot="email-capture" className={cn("flex flex-col gap-3 rounded-md border border-border p-6", className)}>
      {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
      {blurb && <p className="max-w-prose text-sm text-muted-foreground">{blurb}</p>}
      {done ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="size-4 shrink-0" aria-hidden />
          {doneMessage}
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="sr-only">Email address</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={id} value={email} onChange={(e) => setEmail(e.target.value)}
                type="email" autoComplete="email" inputMode="email"
                placeholder={placeholder} required
                aria-invalid={!!error || undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="min-w-56 flex-1"
              />
              <BusyButton type="submit" busy={busy} busyLabel="Subscribing…">{cta}</BusyButton>
            </div>
          </div>
          {consent && (
            <ConsentCheckbox id={`${id}-consent`} checked={agreed} onCheckedChange={setAgreed}>
              {consent}
            </ConsentCheckbox>
          )}
          {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium">{error}</p>}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </form>
      )}
    </section>
  );
}
