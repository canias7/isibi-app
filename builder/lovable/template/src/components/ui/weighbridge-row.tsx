import { cn } from "@/lib/utils";
/**
 * A load weighed in and out — the net is what is charged.
 *
 * NET IS COMPUTED FROM GROSS AND TARE, never taken as an input. The whole point
 * of a weighbridge ticket is that the three numbers reconcile, and a net figure
 * that can disagree with its own arithmetic is the thing a disputed invoice
 * turns on.
 *
 * A MISSING SECOND WEIGH IS AN OPEN TICKET AND IS SHOWN AS ONE. A vehicle that
 * weighed in and left without weighing out produces a charge somebody invents
 * later, and it is the most common weighbridge dispute there is.
 *
 * THE WASTE CODE IS PART OF THE RECORD because it determines the rate, the
 * permitted destination, and whether the load was legal to accept at all.
 *
 * THE CARRIER'S REGISTRATION IS SHOWN. Accepting waste from an unregistered
 * carrier is an offence for the site as well as the carrier, and it is checkable
 * at the gate rather than at an audit.
 */
export function WeighbridgeRow({ ticket, vehicle, carrier, carrierRegistration, wasteCode, grossKg, tareKg, inAt, outAt, rateNote, className }: {
  ticket?: string;
  vehicle?: string;
  carrier?: string;
  /** Undefined where nobody checked. */
  carrierRegistration?: string;
  /** The code that decides the rate and the destination. */
  wasteCode?: string;
  grossKg?: number;
  tareKg?: number;
  inAt?: string;
  /** Undefined where the vehicle has not weighed out. */
  outAt?: string;
  rateNote?: string;
  className?: string;
}) {
  // Computed, never passed: the ticket exists so the three numbers reconcile.
  const net = grossKg !== undefined && tareKg !== undefined ? grossKg - tareKg : undefined;
  const open = grossKg !== undefined && tareKg === undefined;
  return (
    <li data-slot="weighbridge-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {vehicle ?? "Vehicle not recorded"}
          {ticket && <span className="block font-mono text-xs text-muted-foreground">{ticket}</span>}
        </span>
        {net !== undefined && (
          <span className="shrink-0 tabular-nums font-medium">{net.toLocaleString()} kg net</span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {grossKg !== undefined && `${grossKg.toLocaleString()} kg gross`}
        {tareKg !== undefined && ` · ${tareKg.toLocaleString()} kg tare`}
        {inAt && ` · in ${inAt}`}
        {outAt && ` · out ${outAt}`}
      </p>
      {open && (
        <p className="text-xs font-medium">
          Weighed in and not out — this ticket is open and the charge will be guessed.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {carrier ?? "Carrier not recorded"}
        {carrierRegistration
          ? ` · registered ${carrierRegistration}`
          : " · registration not checked"}
        {wasteCode && ` · ${wasteCode}`}
      </p>
      {!carrierRegistration && (
        <p className="text-xs font-medium">
          Taking waste from an unregistered carrier is an offence for this site too.
        </p>
      )}
      {rateNote && <p className="text-xs text-muted-foreground">{rateNote}</p>}
    </li>
  );
}
