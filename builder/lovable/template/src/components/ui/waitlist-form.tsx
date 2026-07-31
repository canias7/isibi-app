import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { EmailInput } from "@/components/ui/email-input";
import { FormRow } from "@/components/ui/form-row";
/** Nothing free? Take the address anyway. A full day should not be a dead end. */
export function WaitlistForm({ onSubmit, busy, note = "We'll email you if something frees up.", className }: {
  onSubmit: (email: string) => void; busy?: boolean; note?: string; className?: string;
}) {
  const [email, setEmail] = React.useState("");
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); if (email) onSubmit(email); }}>
      <FormRow label="Join the waiting list" htmlFor="wl-email" hint={note}>
        <div className="flex gap-2">
          <EmailInput id="wl-email" value={email} onChange={setEmail} />
          <BusyButton type="submit" busy={busy} busyLabel="Adding…" disabled={!email}>Join</BusyButton>
        </div>
      </FormRow>
    </form>
  );
}
