import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "The driver could not deliver" — with the reason and the options.
 *
 * THE REASON DECIDES THE OPTIONS. Nobody in is a redelivery; wrong address
 * is a correction; refused is a refund; access problem is an instruction.
 * A failed-delivery card that shows the same three buttons whatever
 * happened is why people ring up.
 *
 * IT SAYS HOW LONG THE PARCEL IS HELD, because that is the deadline nobody
 * knows and the reason parcels go back to sender.
 *
 * The carrier's own words are quoted separately from the shop's
 * explanation, so a terse "ATTEMPTED - NO ACCESS" is not mistaken for the
 * shop's tone.
 */
export function FailedDelivery({ reason, carrierNote, heldUntil, onRedeliver, onChangeAddress, onCollect, className }: {
  reason: "nobody-in" | "no-access" | "wrong-address" | "refused" | "damaged";
  carrierNote?: string;
  heldUntil?: string;
  onRedeliver?: () => void;
  onChangeAddress?: () => void;
  onCollect?: () => void;
  className?: string;
}) {
  const COPY: Record<typeof reason, { title: string; body: string }> = {
    "nobody-in": { title: "Nobody in", body: "The driver tried and could not leave it safely." },
    "no-access": { title: "The driver could not get in", body: "A gate, a buzzer or a locked block. An access note usually fixes it." },
    "wrong-address": { title: "The address did not work", body: "The driver could not find it. Check it before we try again." },
    "refused": { title: "Refused at the door", body: "Somebody at the address turned the parcel away." },
    "damaged": { title: "Damaged in transit", body: "The carrier stopped it rather than deliver it damaged." },
  };
  const c = COPY[reason];
  const show = {
    redeliver: onRedeliver && reason !== "wrong-address" && reason !== "damaged",
    address: onChangeAddress && (reason === "wrong-address" || reason === "no-access"),
    collect: onCollect && reason !== "damaged",
  };
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border-2 border-foreground p-3", className)}>
      <div>
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-xs text-muted-foreground">{c.body}</p>
      </div>
      {carrierNote ? (
        <p className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          Carrier: “{carrierNote}”
        </p>
      ) : null}
      {heldUntil ? <p className="text-xs">Held until <b>{heldUntil}</b>, then returned to us.</p> : null}
      <div className="flex flex-wrap gap-2">
        {show.redeliver ? <button type="button" onClick={onRedeliver} className="cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Try again</button> : null}
        {show.address ? <button type="button" onClick={onChangeAddress} className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs">Fix the address</button> : null}
        {show.collect ? <button type="button" onClick={onCollect} className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs">Collect it instead</button> : null}
      </div>
    </div>
  );
}
