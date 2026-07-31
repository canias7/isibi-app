import * as React from "react";
import { Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The offer to set up a passkey, or to sign in with one.
 *
 * It FEATURE-DETECTS and renders nothing where passkeys cannot work. Offering
 * a button that opens no prompt is worse than not offering it: the person
 * presses it, nothing happens, and they conclude the whole sign-in is broken.
 * `PublicKeyCredential` on `window` is the check, done in an effect because it
 * does not exist during a server render.
 *
 * It is never the ONLY way in that a site offers. A passkey lives on one
 * device, and an account whose sole credential is on a laptop that has gone in
 * a taxi is an account with no recovery path — reset needs an address, which a
 * passkey-only sign-up may never have collected. Same reasoning as the rule
 * that refuses to unlink somebody's last credential.
 *
 * The copy names the BENEFIT rather than the technology. "Sign in with your
 * fingerprint or face" is what the thing does; "register a WebAuthn
 * credential" is what we call it, and nobody outside this file cares.
 */
export function PasskeyPrompt({
  mode = "create", onUse, onDismiss, busy, error, deviceName, className,
}: {
  mode?: "create" | "signin";
  onUse: () => void;
  onDismiss?: () => void;
  busy?: boolean;
  error?: React.ReactNode;
  deviceName?: React.ReactNode;
  className?: string;
}) {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setSupported(typeof window !== "undefined" && "PublicKeyCredential" in window);
  }, []);
  if (supported === null || supported === false) return null;

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-border p-4", className)}>
      <div className="flex items-start gap-3">
        <Fingerprint aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {mode === "create" ? "Sign in faster next time" : "Sign in with your fingerprint or face"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mode === "create"
              ? <>Use your fingerprint, face or screen lock instead of a password{deviceName ? <> on {deviceName}</> : null}. Your password still works.</>
              : <>Nothing to type and nothing to remember.</>}
          </p>
        </div>
      </div>
      {error ? <p role="alert" className="text-xs font-medium">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onUse} disabled={busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-60">
          {busy ? "Waiting for your device…" : mode === "create" ? "Set up a passkey" : "Use a passkey"}
        </button>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} disabled={busy}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            {mode === "create" ? "Not now" : "Use my password"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
