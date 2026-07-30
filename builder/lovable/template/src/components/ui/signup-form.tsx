import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { EmailInput } from "@/components/ui/email-input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormRow } from "@/components/ui/form-row";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
/** Create an account. `new-password` so a manager offers to generate one. */
export function SignupForm({ onSubmit, busy, error, terms, loginHref, className }: {
  onSubmit: (v: { name: string; email: string; password: string }) => void;
  busy?: boolean; error?: string | null; terms?: React.ReactNode;
  loginHref?: string; className?: string;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); onSubmit({ name, email, password }); }}>
      <div className="flex flex-col gap-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <FormRow label="Your name" htmlFor="su-name">
          <Input id="su-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Email" htmlFor="su-email"><EmailInput id="su-email" value={email} onChange={setEmail} /></FormRow>
        <FormRow label="Password" htmlFor="su-pw" hint="At least 8 characters.">
          <PasswordInput id="su-pw" value={password} onChange={setPassword} autoComplete="new-password" />
        </FormRow>
        <BusyButton type="submit" busy={busy} busyLabel="Creating…" className="w-full">Create account</BusyButton>
        {terms && <p className="text-xs text-muted-foreground">{terms}</p>}
        {loginHref && <p className="text-sm">Already have one? <a href={loginHref} className="underline underline-offset-4">Sign in</a></p>}
      </div>
    </form>
  );
}
