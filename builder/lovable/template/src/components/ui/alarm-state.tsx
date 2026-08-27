import { cn } from "@/lib/utils";
/**
 * What the alarm system is doing — and what stops it being set.
 *
 * AN OPEN DOOR THAT BLOCKS SETTING IS THE MOST USEFUL THING THIS CAN SAY.
 * "Cannot set" alone sends somebody walking the building; naming the zone is
 * the difference between ten seconds and ten minutes at the end of a shift, and
 * it is why systems get left unset.
 *
 * PART-SET IS A REAL STATE, NOT HALF OF SET. Perimeter armed with people
 * inside is normal at night and is neither "on" nor "off"; presenting it as a
 * binary makes somebody disarm the whole system to move around.
 *
 * IT DOES NOT COUNT DOWN. An exit timer on a screen encourages people to watch
 * a phone instead of leaving, and the panel by the door already does it audibly.
 *
 * A FAULT IS DISTINGUISHED FROM AN ALARM. A tamper or a low battery needs an
 * engineer tomorrow; an activation needs somebody now, and one word for both
 * produces either panic or complacency.
 */
export type AlarmMode = "set" | "part-set" | "unset" | "alarm" | "fault";

const WORDS: Record<AlarmMode, string> = {
  set: "Set",
  "part-set": "Part set",
  unset: "Unset",
  alarm: "Alarm activated",
  fault: "Fault",
};

export function AlarmState({ mode, area, blockingZones = [], faultNote, lastSetBy, lastSetAt, className }: {
  mode: AlarmMode;
  area?: string;
  /** What is stopping it being set. */
  blockingZones?: string[];
  faultNote?: string;
  lastSetBy?: string;
  lastSetAt?: string;
  className?: string;
}) {
  const urgent = mode === "alarm";
  return (
    <div data-slot="alarm-state" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(urgent && "font-medium")}>
        {WORDS[mode]}
        {area && <span className="text-muted-foreground"> · {area}</span>}
      </p>
      {mode === "part-set" && (
        <p className="text-xs text-muted-foreground">
          The perimeter is armed and the inside is not — normal with people still in the building.
        </p>
      )}
      {blockingZones.length > 0 && (
        <p className="text-xs font-medium">
          Cannot be set: {blockingZones.join(", ")} {blockingZones.length === 1 ? "is" : "are"} open.
        </p>
      )}
      {mode === "fault" && (
        <p className="text-xs">
          {faultNote ?? "A fault, not an activation — it needs an engineer, not a response."}
        </p>
      )}
      {(lastSetBy || lastSetAt) && (
        <p className="text-xs text-muted-foreground">
          {lastSetBy ? `Last set by ${lastSetBy}` : "Last set"}
          {lastSetAt && ` at ${lastSetAt}`}
        </p>
      )}
    </div>
  );
}
