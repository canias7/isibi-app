import { cn } from "@/lib/utils";
/**
 * The public-facing site notice — for neighbours, not for the site team.
 *
 * IT IS WRITTEN FOR SOMEBODY STANDING ON THE PAVEMENT. A notice listing a
 * contract number and a CDM coordinator answers none of the questions a
 * neighbour has: what is being built, how long, what the hours are, and who to
 * ring about the noise. Those four, in that order.
 *
 * THE COMPLAINT NUMBER IS PROMINENT, because the alternative is the council or
 * the site gate — both of which cost far more than a phone call answered by
 * somebody who can move a delivery.
 *
 * WORKING HOURS ARE STATED INCLUDING WEEKENDS. Most disputes are about
 * Saturday mornings, and a notice giving only weekday hours implies none.
 *
 * IT IS LARGE TEXT. This is printed at A2 and read from two metres away
 * through a fence, and the usual dense legal layout is unreadable at that
 * distance.
 */
export function HoardingNotice({ what, from, to, hours = [], contactName, contactPhone, outOfHoursPhone, className }: {
  /** What is being built, in plain words. */
  what: string;
  /** Free text — "March 2026". */
  from?: string;
  to?: string;
  /** Each line — "Monday to Friday, 8am to 6pm". */
  hours?: string[];
  contactName?: string;
  contactPhone?: string;
  outOfHoursPhone?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 rounded-md border border-border p-4", className)}>
      <div>
        <p className="text-lg font-medium">{what}</p>
        {(from || to) && (
          <p className="text-sm text-muted-foreground">
            {from && to ? `${from} to ${to}` : from ? `From ${from}` : `Until ${to}`}
          </p>
        )}
      </div>
      {hours.length > 0 && (
        <div>
          <p className="text-sm font-medium">Working hours</p>
          <ul className="text-sm">
            {hours.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      )}
      <div>
        <p className="text-sm font-medium">If something is wrong, ring us</p>
        {contactName && <p className="text-sm">{contactName}</p>}
        {contactPhone && (
          <p className="text-lg">
            <a href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
              {contactPhone}
            </a>
          </p>
        )}
        {outOfHoursPhone && (
          <p className="text-sm text-muted-foreground">
            Out of hours:{" "}
            <a href={`tel:${outOfHoursPhone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
              {outOfHoursPhone}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
