import { cn } from "@/lib/utils";
/**
 * One shot — with whether it has actually been got.
 *
 * "IN THE CAN" IS THE ONLY STATE THAT COUNTS. A shot list is used at the end of
 * a day to decide whether the scene is finished, and a list showing planned
 * shots without their status cannot answer that — which is how a production
 * discovers on the last day that a coverage shot was never taken.
 *
 * SETUPS ARE COUNTED, NOT SHOTS. A day's work is bounded by how many times the
 * camera moves and is relit, and six shots from one setup is an hour where two
 * shots from two setups is three.
 *
 * THE LENS AND THE MOVE ARE PART OF THE ROW, because they determine the setup
 * time and because matching coverage later needs to know what was used.
 *
 * A DROPPED SHOT STAYS IN THE LIST, marked. Coverage is cut for time constantly,
 * and a list that deletes them loses the record of what the edit will not have.
 */
export function ShotListRow({ shot, size, lens, move, setup, description, state = "planned", className }: {
  /** "14A-3". */
  shot: string;
  /** "Wide", "Mid two-shot", "Close on hands". */
  size?: string;
  lens?: string;
  /** "Static", "Slow push", "Handheld". */
  move?: string;
  /** Which camera setup it belongs to. */
  setup?: string | number;
  description?: string;
  state?: "planned" | "shot" | "dropped";
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{shot}</span>
        <span className={cn("min-w-0 flex-1", state === "dropped" && "text-muted-foreground line-through")}>
          {size ?? "Size not set"}
          {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", state === "shot" ? "font-medium" : "text-muted-foreground")}>
          {state === "shot" ? "In the can" : state === "dropped" ? "Dropped" : "To shoot"}
        </span>
      </p>
      <p className="ps-17 text-xs text-muted-foreground">
        {[lens, move, setup !== undefined ? `setup ${setup}` : undefined].filter(Boolean).join(" · ")}
      </p>
    </li>
  );
}
