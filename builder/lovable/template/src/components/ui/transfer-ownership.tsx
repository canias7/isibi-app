import * as React from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Hand it over — and understand what you lose.
 *
 * IT STATES WHAT HAPPENS TO YOU, which is the part every implementation omits.
 * Transferring ownership usually demotes the current owner, sometimes
 * irreversibly, and finding that out afterwards is the worst possible moment.
 * `yourNewRole` is required so the caller cannot skip it.
 *
 * THE NEW OWNER IS PICKED FROM EXISTING MEMBERS, never typed. Transferring to an
 * address that has not accepted an invite can strand a resource with no
 * reachable owner at all.
 *
 * Confirm stays disabled until somebody is chosen, and the button says who it is
 * handing to — a generic "Transfer" on an irreversible action is the wrong last
 * thing to read.
 */
export function TransferOwnership({ members, yourNewRole, onTransfer, busy, className }: {
  members: { id: string; name: string }[];
  /** What the current owner becomes — "Editor". Required. */
  yourNewRole: string;
  onTransfer: (id: string) => void;
  busy?: boolean;
  className?: string;
}) {
  const [to, setTo] = React.useState("");
  const id = React.useId();
  if (!members.length) return null;
  const chosen = members.find((m) => m.id === to);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium">Transfer ownership to</label>
      <NativeSelect id={id} value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-sm">
        <option value="">Choose a member…</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </NativeSelect>
      <p className="text-sm text-muted-foreground">
        You&apos;ll become {yourNewRole}. This can&apos;t be undone by you afterwards.
      </p>
      <div>
        <Button size="sm" disabled={!to || busy} onClick={() => to && onTransfer(to)}>
          {chosen ? `Transfer to ${chosen.name}` : "Transfer"}
        </Button>
      </div>
    </div>
  );
}
