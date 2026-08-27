import { cn } from "@/lib/utils";
/**
 * Who somebody is, as the platform knows them — name, since when, what is
 * confirmed.
 *
 * IT LISTS WHAT IS CONFIRMED AND WHAT IS NOT, side by side. A profile showing
 * only the ticks lets a reader assume everything else was checked too, which is
 * how a platform ends up implying a guarantee it never made. Both columns, or
 * neither means anything.
 *
 * "MEMBER SINCE" IS THE MOST USEFUL SINGLE FACT and the cheapest to provide.
 * Account age is the one signal that cannot be faked quickly, which is why it
 * appears on every marketplace that has been burned once.
 *
 * NO PHOTOGRAPH, deliberately. A face is not identity evidence, it invites
 * judgements that have nothing to do with the transaction, and the caller can
 * put an avatar next to this if the product wants one.
 *
 * INITIALS, NOT A FULL LEGAL NAME, when the caller passes a display name — how
 * much of somebody's name to reveal is a product decision, so the component
 * prints exactly what it is given.
 */
export function IdentitySummary({ name, since, confirmed = [], unconfirmed = [], note, className }: {
  name: string;
  /** Free text — "March 2024". */
  since?: string;
  /** Things that have been checked — "email", "phone". */
  confirmed?: string[];
  /** Things that have not. */
  unconfirmed?: string[];
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="identity-summary" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium">{name}</span>
        {since && <span className="block text-xs text-muted-foreground">Member since {since}</span>}
      </p>
      {(confirmed.length > 0 || unconfirmed.length > 0) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {confirmed.length > 0 && (
            <div className="contents">
              <dt className="text-muted-foreground">Confirmed</dt>
              <dd>{confirmed.join(", ")}</dd>
            </div>
          )}
          {unconfirmed.length > 0 && (
            <div className="contents">
              <dt className="text-muted-foreground">Not confirmed</dt>
              <dd className="text-muted-foreground">{unconfirmed.join(", ")}</dd>
            </div>
          )}
        </dl>
      )}
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
