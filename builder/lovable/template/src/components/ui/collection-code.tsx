import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The code that gets the parcel handed over — treated as a credential.
 *
 * THIS CODE IS THE ONLY THING BETWEEN A STRANGER AND THE PARCEL, so it is
 * handled like a one-time password rather than like a reference number: big,
 * spaced, monospaced, and NOT rendered into anything that gets shared by
 * accident.
 *
 * IT IS NOT IN THE PAGE TITLE OR THE URL, and the header says so, because a
 * screenshot of a browser tab or a shared link is exactly how these leak.
 *
 * THE ID GOES WITH IT. Depots ask for both, and somebody standing at a
 * counter with only half of what is needed is the failure this prevents.
 */
export function CollectionCode({ code, expiresOn, needsId = true, className }: {
  code: string;
  expiresOn?: string;
  needsId?: boolean;
  className?: string;
}) {
  const grouped = (code.match(/.{1,3}/g) ?? [code]).join(" ");
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-lg border-2 border-foreground p-4 text-center", className)}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collection code</p>
      <p className="font-mono text-3xl font-bold tracking-widest tabular-nums">{grouped}</p>
      {needsId ? <p className="text-xs">Bring photo ID in the same name.</p> : null}
      {expiresOn ? <p className="text-xs text-muted-foreground">Held until {expiresOn}.</p> : null}
      <p className="text-[11px] text-muted-foreground">Anyone with this code can collect the parcel.</p>
    </div>
  );
}
