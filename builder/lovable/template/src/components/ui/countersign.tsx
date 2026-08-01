import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * A second signature on something already signed — the deliberate,
 * slowed-down version of Approve.
 *
 * TYPING YOUR OWN NAME IS THE FRICTION, and it is the point. A countersignature
 * exists precisely where a single click is too cheap: paying out money,
 * discharging a patient, releasing a build. Matching the typed name against the
 * signer's makes it impossible to countersign by muscle memory, which is the
 * failure this whole pattern exists to prevent.
 *
 * THE STATEMENT IS ACKNOWLEDGED SEPARATELY from the signature, because "I have
 * read it" and "I am signing it" are two claims and a single checkbox
 * conflates them. Both are required.
 *
 * THE MATCH IS CASE- AND SPACE-INSENSITIVE. Rejecting "sam odell" for "Sam
 * Odell" tests typing accuracy rather than intent, and an approver who cannot
 * get past their own name will paste it — which defeats the friction entirely.
 *
 * WHO SIGNED FIRST IS SHOWN, because countersigning your own approval is the
 * one thing a two-signature rule is there to stop and the reader has to be able
 * to see it.
 */
export function Countersign({ signerName, firstSignedBy, statement, onSign, busy, className }: {
  /** The countersigner's own name — what they must type. */
  signerName: string;
  firstSignedBy?: string;
  statement: string;
  onSign: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [typed, setTyped] = useState("");
  const [read, setRead] = useState(false);
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const matches = norm(typed) === norm(signerName) && norm(signerName) !== "";
  return (
    <form className={cn("space-y-3 rounded-lg border border-border p-4", className)}
      onSubmit={(e) => { e.preventDefault(); if (matches && read) onSign(); }}>
      {firstSignedBy && (
        <p className="text-sm text-muted-foreground">First signed by {firstSignedBy}</p>
      )}
      <p className="text-sm">{statement}</p>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={read} onCheckedChange={(v) => setRead(v === true)} className="mt-0.5" />
        <span>I have read and understood the above.</span>
      </label>
      <div className="space-y-1">
        <label htmlFor="countersign-name" className="block text-sm font-medium">
          Type your full name to sign
        </label>
        <input id="countersign-name" value={typed} onChange={(e) => setTyped(e.target.value)}
          autoComplete="off" placeholder={signerName}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <Button type="submit" disabled={!matches || !read || busy}>Countersign</Button>
    </form>
  );
}
