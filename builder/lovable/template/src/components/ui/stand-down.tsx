import { cn } from "@/lib/utils";
/**
 * Releasing people at the end — and what still has to happen.
 *
 * STANDING DOWN IS NOT FINISHING. Kit needs cleaning and restocking, somebody has
 * to write the log up, and the people who were there need checking on — and all
 * of it is dropped when the last person leaves believing it is over. The
 * outstanding list is the component.
 *
 * WELFARE IS ON THE LIST, NOT IN A POLICY. A long or difficult incident has a
 * cost to the people who worked it, and the moment it reliably gets skipped is
 * the moment everybody is tired and going home.
 *
 * RESOURCES ARE RELEASED INDIVIDUALLY. A blanket stand-down releases the one
 * crew still doing something, and they find out by being told to go home while
 * holding a hose.
 *
 * THE TIME IS RECORDED because everything afterwards — hours worked, costs,
 * whether a response met whatever it is measured against — is counted from it.
 */
export type Outstanding = { id: string; what: string; whose?: string; done?: boolean };

export function StandDown({ at, by, outstanding = [], released = [], stillWorking = [], className }: {
  at?: string;
  by?: string;
  /** The component. Standing down is not finishing. */
  outstanding?: Outstanding[];
  released?: string[];
  /** Released individually, never in a blanket. */
  stillWorking?: string[];
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const left = outstanding.filter((o) => !o.done);
  return (
    <div data-slot="stand-down" className={cn("space-y-1.5 text-sm", className)}>
      <p className="font-medium">
        Stood down{at ? ` at ${at}` : ""}
        {by ? ` by ${by}` : ""}.
      </p>
      {stillWorking.length > 0 && (
        <p className="text-xs font-medium">
          {AND.format(stillWorking)} {stillWorking.length === 1 ? "is" : "are"} still working. They are not released.
        </p>
      )}
      {released.length > 0 && (
        <p className="text-xs text-muted-foreground">Released: {AND.format(released)}.</p>
      )}
      {left.length > 0 ? (
        <>
          <p className="text-sm font-medium">
            {left.length} {left.length === 1 ? "thing" : "things"} still to do. This is where they get dropped.
          </p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {outstanding.map((o) => (
              <li key={o.id} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className={cn("min-w-0 flex-1", o.done && "text-muted-foreground")}>
                  {o.what}
                  {o.whose && <span className="block text-xs text-muted-foreground">{o.whose}</span>}
                </span>
                <span className={cn("shrink-0 text-xs", o.done ? "text-muted-foreground" : "font-medium")}>
                  {o.done ? "Done" : "Not yet"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Everything afterwards is done too.</p>
      )}
    </div>
  );
}
