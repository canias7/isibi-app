import { cn } from "@/lib/utils";
/**
 * One piece of kit on the books.
 *
 * WHERE IT IS AND WHO HAS IT ARE THE TWO FIELDS THE ROW EXISTS FOR. An asset
 * register that lists what you own and not where it went is an inventory of
 * things nobody can find, which is the state most of them are in.
 *
 * "IN STOCK" AND "NOT ON HIRE" ARE DIFFERENT. Kit off hire but still in a van,
 * or back but not yet checked, is not available to promise to the next customer,
 * and a two-state flag makes double-booking inevitable.
 *
 * THE SERIAL NUMBER IS SHOWN IN FULL, because it is what an insurer, a police
 * report and the manufacturer's warranty all ask for, and it is invariably
 * truncated in a list to make room for a picture.
 *
 * NO DEPRECIATED VALUE. What it is worth depends on an accounting policy this
 * component does not have, and showing a figure derived from a guess makes it
 * into a fact.
 */
export function AssetRow({ name, serial, state = "available", withWhom, location, lastSeen, className }: {
  name: string;
  /** In full. Insurers ask for all of it. */
  serial?: string;
  /** More than two states, deliberately. */
  state?: "available" | "on hire" | "back, not checked" | "in for repair" | "written off" | "missing";
  withWhom?: string;
  location?: string;
  lastSeen?: string;
  className?: string;
}) {
  const promisable = state === "available";
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{name}</span>
          {serial && <span className="block text-xs tabular-nums text-muted-foreground">{serial}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", promisable ? "text-muted-foreground" : "font-medium")}>
          {state.charAt(0).toUpperCase() + state.slice(1)}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {[withWhom && `With ${withWhom}`, location, lastSeen && `last seen ${lastSeen}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {state === "back, not checked" && (
        <p className="text-xs">
          Back but not checked over. Do not promise it to anybody until somebody has looked at it.
        </p>
      )}
      {state === "missing" && !withWhom && (
        <p className="text-xs font-medium">Nobody recorded as having it. That is where a serial number earns its keep.</p>
      )}
    </li>
  );
}
