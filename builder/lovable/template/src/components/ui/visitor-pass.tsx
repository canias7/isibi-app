import { cn } from "@/lib/utils";
/**
 * Someone visiting — with the host's obligations stated up front.
 *
 * THE HOST HAS TO COLLECT THEM AND THE COMPONENT SAYS SO. A visitor left at a
 * reception desk that closes at five is the failure this whole process exists to
 * prevent, and "your host has been notified" is not the same as somebody coming
 * down.
 *
 * WHERE THE VISITOR MAY GO IS BOUNDED AND WRITTEN DOWN. A pass that opens
 * everything is the norm and is nobody's intention; naming the floors is both
 * more accurate and more useful than a badge colour.
 *
 * THE PASS EXPIRES AND SAYS WHEN, IN WORDS. A visitor whose pass silently stops
 * working is stuck between two locked doors, which is worse than being refused
 * at the front.
 *
 * NO PHOTOGRAPH TAKEN AT THE DESK. A picture of every visitor is a face database
 * built by a coworking space, and a name on a list does the same job for the
 * thing the list is actually for.
 */
export function VisitorPass({ visitor, host, hostNotified, hostCollecting, expiresAt, allowedAreas = [], arrived, className }: {
  visitor: string;
  host?: string;
  hostNotified?: boolean;
  /** Not the same as notified. */
  hostCollecting?: boolean;
  expiresAt?: string;
  /** Bounded and written down. */
  allowedAreas?: string[];
  arrived?: boolean;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="visitor-pass" className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">{visitor}</p>
      <p className={cn("text-xs", hostCollecting ? "text-muted-foreground" : "font-medium")}>
        {hostCollecting
          ? `${host ?? "Their host"} is on the way down.`
          : hostNotified
            ? `${host ?? "Their host"} has been told, which is not the same as somebody coming down. Nobody should be left at the desk.`
            : `No host recorded. Somebody has to come and collect ${visitor}.`}
      </p>
      <p className="text-xs text-muted-foreground">
        {allowedAreas.length > 0
          ? `Pass opens ${AND.format(allowedAreas)} — nothing else.`
          : "No areas set on this pass, so it opens whatever the default is. That is rarely what anybody intended."}
      </p>
      {expiresAt && (
        <p className="text-xs text-muted-foreground">
          Stops working at {expiresAt}. After that the doors will not open from the inside either.
        </p>
      )}
      {arrived === false && <p className="text-xs text-muted-foreground">Not arrived yet.</p>}
    </div>
  );
}
