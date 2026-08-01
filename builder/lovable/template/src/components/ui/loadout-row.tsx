import { cn } from "@/lib/utils";
/**
 * A saved setup — with what is missing before it can be used.
 *
 * AN UNUSABLE LOADOUT IS THE COMMON CASE AND IS THE HEADLINE. Saved setups
 * reference things that get sold, expire or are locked behind something not yet
 * finished, and a list that shows them all as available produces a player
 * discovering it at the start of a match.
 *
 * WHAT IS LOCKED SAYS HOW IT UNLOCKS. "Locked" is a dead end; "unlocks at level
 * 22" is a plan, and it costs nothing extra to store.
 *
 * IT DOES NOT SCORE THE LOADOUT. A power number invites optimisation towards
 * one figure, which flattens variety and is usually wrong about the actual
 * match-up — and it makes every unconventional setup look like a mistake.
 *
 * THE SLOTS ARE NAMED. A row of icons is unreadable to anybody using a screen
 * reader and unsearchable for everybody, and slot names are how players
 * actually talk about a build.
 */
export type LoadoutSlot = {
  id: string;
  slot: string;
  item?: string;
  /** Why it cannot be used. */
  lockedReason?: string;
  /** How to unlock it. */
  unlocksAt?: string;
};

export function LoadoutRow({ name, slots, inUse, className }: {
  name: string;
  slots: LoadoutSlot[];
  inUse?: boolean;
  className?: string;
}) {
  const problems = slots.filter((s) => s.lockedReason || !s.item);
  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="min-w-0 flex-1 font-medium">{name}</span>
        {inUse && <span className="shrink-0 text-xs text-muted-foreground">In use</span>}
      </p>
      {problems.length > 0 && (
        <p className="text-sm font-medium">
          This cannot be used as saved — {problems.length} {problems.length === 1 ? "slot has" : "slots have"} a problem.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {slots.map((s) => (
          <li key={s.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{s.slot}</span>
            <span className={cn("min-w-0 flex-1", (!s.item || s.lockedReason) && "font-medium")}>
              {s.item || "Empty"}
              {s.lockedReason && (
                <span className="block text-xs font-normal">
                  {s.lockedReason}
                  {s.unlocksAt ? ` — ${s.unlocksAt}` : ""}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
