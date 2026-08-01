import { cn } from "@/lib/utils";
/**
 * A booked room — with who has actually said they are coming.
 *
 * A REHEARSAL WITHOUT THE RHYTHM SECTION IS NOT A REHEARSAL, and the component
 * says which parts are missing rather than counting heads. Four of six sounds
 * fine and is useless if the two absent are the drummer and the bassist.
 *
 * NO REPLY IS NOT THE SAME AS NO. Most people never answer, and a room booked
 * on the assumption that silence means yes is the ordinary way a session is
 * wasted. The three states are kept apart.
 *
 * THE BACKLINE IS PART OF THE BOOKING. Whether the room has a kit and an amp
 * decides what everybody has to carry, and it is the question asked in the car
 * park.
 *
 * LOAD-IN AND LOAD-OUT EAT THE SLOT. A three-hour booking is two hours of
 * playing, and a component showing only the booked time overstates every
 * session.
 */
export function RehearsalSlot({ room, when, minutes, loadMinutes = 0, backline = [], attendance = [], className }: {
  room: string;
  /** Free text — "Thursday, 19:00". */
  when: string;
  minutes?: number;
  /** Time lost to getting in and out. */
  loadMinutes?: number;
  /** What the room provides. */
  backline?: string[];
  attendance?: { name: string; part?: string; reply?: "yes" | "no" | "none" }[];
  className?: string;
}) {
  const yes = attendance.filter((a) => a.reply === "yes");
  const no = attendance.filter((a) => a.reply === "no");
  const silent = attendance.filter((a) => !a.reply || a.reply === "none");
  const playing = minutes !== undefined ? Math.max(0, minutes - loadMinutes) : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{room}</span>
        <span className="block">{when}</span>
      </p>
      {minutes !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {minutes} minutes booked
          {loadMinutes > 0 && playing !== undefined && ` — about ${playing} of playing after getting in and out`}
        </p>
      )}
      {attendance.length > 0 && (
        <>
          <p className="text-xs tabular-nums text-muted-foreground">
            {yes.length} coming · {no.length} cannot · {silent.length} have not replied
          </p>
          {no.length > 0 && (
            <p className="text-xs font-medium">
              Missing: {no.map((a) => a.part ?? a.name).join(", ")}.
            </p>
          )}
          {silent.length > 0 && (
            <p className="text-xs text-muted-foreground">
              No reply from {silent.map((a) => a.name).join(", ")} — that is not a yes.
            </p>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {backline.length > 0 ? `Room has ${backline.join(", ")}.` : "Bring everything — the room provides nothing."}
      </p>
    </div>
  );
}
