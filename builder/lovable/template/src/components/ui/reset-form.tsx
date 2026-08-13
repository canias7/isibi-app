import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { EmailInput } from "@/components/ui/email-input";
import { FormRow } from "@/components/ui/form-row";
import { SuccessPanel } from "@/components/ui/success-panel";
/**
 * Ask for a reset link.
 *
 * The confirmation is the SAME whether or not the address has an account — a
 * different message is how somebody checks who is a member here.
 */
export function ResetForm({ onSubmit, busy, sent, backHref, className }: {
  onSubmit: (email: string) => void; busy?: boolean; sent?: boolean;
  backHref?: string; className?: string;
}) {
  const [email, setEmail] = React.useState("");
  if (sent) {
    return <SuccessPanel className={className} title="Check your inbox"
      description="If that address has an account, a reset link is on its way."
      action={backHref ? { label: "Back to sign in", href: backHref } : undefined} />;
  }
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); onSubmit(email); }}>
      <div className="flex flex-col gap-4">
        <FormRow label="Email" hint="We'll send a link to set a new password.">
          <EmailInput id="rs-email" value={email} onChange={setEmail} />
        </FormRow>
        <BusyButton type="submit" busy={busy} busyLabel="Sending…" className="w-full">Send reset link</BusyButton>
        {backHref && <a href={backHref} className="text-sm text-muted-foreground underline underline-offset-4">Back to sign in</a>}
      </div>
    </form>
  );
}
