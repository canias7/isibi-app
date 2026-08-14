import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { EmailInput } from "@/components/ui/email-input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormRow } from "@/components/ui/form-row";
import { InlineAlert } from "@/components/ui/inline-alert";
/**
 * Sign in.
 *
 * One `error` for the whole form rather than per-field, deliberately: telling
 * somebody which of the two was wrong tells an attacker whether the address has
 * an account here.
 */
export function LoginForm({ onSubmit, busy, error, forgotHref, signupHref, className }: {
  onSubmit: (v: { email: string; password: string }) => void;
  busy?: boolean; error?: string | null;
  forgotHref?: string; signupHref?: string; className?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); onSubmit({ email, password }); }}>
      <div className="flex flex-col gap-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <FormRow label="Email"><EmailInput id="li-email" value={email} onChange={setEmail} /></FormRow>
        <FormRow label="Password">
          <PasswordInput id="li-pw" value={password} onChange={setPassword} autoComplete="current-password" />
        </FormRow>
        <BusyButton type="submit" busy={busy} busyLabel="Signing in…" className="w-full">Sign in</BusyButton>
        <div className="flex justify-between text-sm">
          {forgotHref && <a href={forgotHref} className="text-muted-foreground underline underline-offset-4">Forgotten password</a>}
          {signupHref && <a href={signupHref} className="underline underline-offset-4">Create an account</a>}
        </div>
      </div>
    </form>
  );
}
