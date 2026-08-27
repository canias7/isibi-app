import { cn } from "@/lib/utils";
/**
 * Permission to film somewhere — with what it actually covers.
 *
 * THE PERMITTED USE IS THE FIELD THAT BITES. A release signed for a student
 * film does not cover a commercial release, and the distinction surfaces at
 * delivery when an insurer or a broadcaster asks for the paperwork — years
 * after everybody has forgotten.
 *
 * WHOEVER SIGNED MUST HAVE BEEN ABLE TO. A tenant cannot grant filming rights
 * to a building they rent, and a release signed by the wrong person is worth
 * nothing at exactly the moment it is needed.
 *
 * DATES AND HOURS ARE PART OF THE PERMISSION. Overrunning a permitted window is
 * the ordinary reason a shoot is stopped, and it is usually because nobody on
 * the floor knew there was one.
 *
 * WHAT IS EXCLUDED IS LISTED — rooms, signage, third-party artwork. Clearing a
 * building does not clear the painting on its wall, and that is a delivery
 * problem discovered in the edit.
 */
export function LocationRelease({ location, signedBy, signatoryRole, canGrant, permittedUse, dates, hours, excludes = [], feeNote, className }: {
  location: string;
  signedBy?: string;
  /** "Owner", "Managing agent", "Tenant". */
  signatoryRole?: string;
  /** False where the signatory does not have the right to grant it. */
  canGrant?: boolean;
  /** "Any use, in perpetuity", "Student film only". */
  permittedUse?: string;
  /** Free text — "12 to 14 August". */
  dates?: string;
  /** "07:00 to 19:00, no amplified sound after 18:00". */
  hours?: string;
  /** What the release does not cover. */
  excludes?: string[];
  feeNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="location-release" className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">{location}</p>
      <p className="text-xs text-muted-foreground">
        {signedBy ? `Signed by ${signedBy}` : "Unsigned"}
        {signatoryRole && ` · ${signatoryRole}`}
      </p>
      {canGrant === false && (
        <p className="text-xs font-medium">
          This signatory may not have the right to grant filming here — get the owner's signature as well.
        </p>
      )}
      <p className={cn("text-xs", permittedUse ? "" : "font-medium")}>
        {permittedUse
          ? `Covers: ${permittedUse}.`
          : "The permitted use is not stated, which means it is unclear what this release covers."}
      </p>
      {(dates || hours) && (
        <p className="text-xs text-muted-foreground">
          {[dates, hours].filter(Boolean).join(" · ")}
        </p>
      )}
      {/* A list, not a sentence built from the caller's fragments. Joined into
          prose, capitalised entries read as "Does not cover The upstairs flat",
          and a real release excludes more things than a sentence can hold. */}
      {excludes.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs">Does not cover:</p>
          <ul className="text-xs text-muted-foreground">
            {excludes.map((e, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{e}</span></li>
            ))}
          </ul>
        </div>
      )}
      {feeNote && <p className="text-xs text-muted-foreground">{feeNote}</p>}
    </div>
  );
}
