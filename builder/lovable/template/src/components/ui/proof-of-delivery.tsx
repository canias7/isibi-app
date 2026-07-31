import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * What the driver recorded — photo, signature, place and time.
 *
 * IT IS EVIDENCE, SO IT IS SHOWN WITHOUT SPIN. A photo of a doorstep, a
 * scrawled signature and a GPS point are what a dispute turns on, and the
 * shop's job is to display them plainly rather than assert "delivered".
 *
 * THE GPS POINT IS LABELLED AS THE DRIVER'S DEVICE, not as the parcel. A
 * handset reports where the SCAN happened, sometimes from the van at the end
 * of the street, and presenting it as the parcel's location is the claim
 * that loses the argument.
 *
 * "SIGNED BY" NAMES WHO, because signed-for by a neighbour is the single
 * most common reason a delivered parcel is missing, and the name is what
 * turns a dispute into a doorbell.
 *
 * No map — `location-card`'s refusal: coordinates and a place name, and the
 * caller can link out if it has a provider.
 */
export function ProofOfDelivery({ at, place, signedBy, photo, coords, className }: {
  at: string;
  place?: string;
  signedBy?: string;
  photo?: string;
  coords?: { lat: number; lng: number };
  className?: string;
}) {
  return (
    <figure className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <figcaption className="text-xs">
        <b>Delivered {at}</b>
        {place ? <span className="block text-muted-foreground">Left {place}</span> : null}
        {signedBy ? <span className="block">Signed for by <b>{signedBy}</b></span> : null}
      </figcaption>
      {photo ? <img src={photo} alt="The driver's photo at the door" className="max-h-48 rounded border border-border object-cover" /> : null}
      {coords ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {/* Where the SCAN happened, not where the parcel is. */}
          <span className="block font-sans">Where the driver's handset scanned it — not necessarily the doorstep.</span>
        </p>
      ) : null}
    </figure>
  );
}
