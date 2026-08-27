import { cn } from "@/lib/utils";
/**
 * A second person to try — with their relationship, and whether they may be
 * told anything.
 *
 * "MAY WE DISCUSS DETAILS?" IS THE FIELD THAT MATTERS. An emergency contact who
 * can be told the appointment is cancelled and one who may only be asked to
 * pass on a message are different permissions, and staff assume the first
 * unless told otherwise — which is how somebody's business ends up discussed
 * with their neighbour.
 *
 * THE RELATIONSHIP IS FREE TEXT, not a dropdown. Families and households do not
 * fit a fixed list, and a picker offering eight options makes somebody choose
 * the least wrong one, which is worse data than what they would have typed.
 *
 * "ONLY IN AN EMERGENCY" IS A SEPARATE FLAG from being an alternate. Plenty of
 * people give a partner as a routine second number and a parent as
 * emergency-only, and collapsing the two produces calls nobody wanted.
 *
 * A `<dl>`, so each fact is attached to its label when read aloud.
 */
export function AlternateContact({ name, relationship, phone, email, mayDiscuss, emergencyOnly, className }: {
  name: string;
  /** Free text — "partner", "my neighbour Jo". */
  relationship?: string;
  phone?: string;
  email?: string;
  /** Whether details may be shared with them. */
  mayDiscuss?: boolean;
  emergencyOnly?: boolean;
  className?: string;
}) {
  return (
    <dl data-slot="alternate-contact" className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm", className)}>
      <dt className="text-muted-foreground">Name</dt>
      <dd>
        {name}
        {relationship && <span className="text-muted-foreground"> · {relationship}</span>}
      </dd>
      {phone && (<><dt className="text-muted-foreground">Phone</dt><dd>{phone}</dd></>)}
      {email && (<><dt className="text-muted-foreground">Email</dt><dd className="break-all">{email}</dd></>)}
      <dt className="text-muted-foreground">Details</dt>
      <dd className={cn(!mayDiscuss && "font-medium")}>
        {mayDiscuss ? "May be discussed with them" : "Do not discuss — pass on a message only"}
      </dd>
      {emergencyOnly && (
        <>
          <dt className="text-muted-foreground">Use</dt>
          <dd className="font-medium">In an emergency only</dd>
        </>
      )}
    </dl>
  );
}
