import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { EmailInput } from "@/components/ui/email-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
/** Invite somebody, with the role decided at the same time. */
export function InviteForm({ roles = ["Member", "Admin"], onSubmit, busy, className }: {
  roles?: string[]; onSubmit: (v: { email: string; role: string }) => void;
  busy?: boolean; className?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState(roles[0]);
  return (
    <form className={cn("flex flex-wrap items-end gap-2", className)}
      onSubmit={(e) => { e.preventDefault(); if (email) onSubmit({ email, role }); }}>
      <div className="min-w-48 flex-1"><EmailInput value={email} onChange={setEmail} placeholder="name@company.com" /></div>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
      </Select>
      <BusyButton type="submit" busy={busy} busyLabel="Sending…" disabled={!email}>Invite</BusyButton>
    </form>
  );
}
