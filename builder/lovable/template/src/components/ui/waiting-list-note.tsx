import { cn } from "@/lib/utils";
/**
 * Where somebody is on a list — described honestly.
 *
 * A POSITION NUMBER IS THE MOST MISLEADING THING THIS CAN SHOW, and the component
 * refuses to lead with one. Lists are not queues: people are added ahead on
 * urgency, cases move between lists, and "you are 41st" produces an expectation
 * of a countdown that then goes backwards. Time waited and what the service has
 * said are honest; a rank is not.
 *
 * IT SAYS WHAT WOULD CHANGE THE POSITION. Somebody whose symptoms change, or who
 * could take a short-notice slot, has an action available and does not know it.
 * That is the actionable half of this screen and it is almost never present.
 *
 * A LIST THAT IS NOT MOVING IS SAID SO. Being told nothing has moved is worse
 * than being told a service is paused, and people find out either way — one of
 * them takes six phone calls.
 *
 * NO PREDICTED DATE. It would be a guess about other people's clinical urgency,
 * given to somebody who will plan a life around it.
 */
export function WaitingListNote({ forWhat, weeksWaited, serviceSaid, shortNoticeAvailable, tellUsIf = [], listPaused, pausedNote, contact, className }: {
  forWhat: string;
  weeksWaited?: number;
  /** Only what the service itself has said. */
  serviceSaid?: string;
  /** A real action somebody can take. */
  shortNoticeAvailable?: boolean;
  /** What would change the position. */
  tellUsIf?: string[];
  listPaused?: boolean;
  pausedNote?: string;
  contact?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="waiting-list-note" className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{forWhat}</span>
        {weeksWaited !== undefined && (
          <span className="tabular-nums text-muted-foreground">
            {" "}
            · waiting {weeksWaited} {weeksWaited === 1 ? "week" : "weeks"}
          </span>
        )}
      </p>
      {listPaused && (
        <p className="font-medium">
          This list is not moving at the moment.{pausedNote ? ` ${pausedNote}` : ""}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {serviceSaid ?? "The service has not given a timescale. We will not invent one here."}
      </p>
      {shortNoticeAvailable && (
        <p className="text-xs font-medium">
          Say if you could come at short notice. Slots come up when somebody cancels and they go to whoever can take
          them.
        </p>
      )}
      {tellUsIf.length > 0 && (
        <p className="text-xs">Tell us if {AND.format(tellUsIf)} — any of those can change where you are.</p>
      )}
      {contact && <p className="text-xs text-muted-foreground">{contact}</p>}
      <p className="text-xs text-muted-foreground">
        There is no position number here on purpose. Lists are not queues — people are added ahead on urgency, so a
        rank would go backwards.
      </p>
    </div>
  );
}
