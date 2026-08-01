import { cn } from "@/lib/utils";
/**
 * One person occupying a paid seat — and whether they are using it.
 *
 * "LAST ACTIVE" IS WHAT MAKES THIS WORTH SHOWING. A seat list is a bill, and
 * the money is in the people who have not signed in since March — invisible in
 * every seat table, which shows names and roles and nothing about whether the
 * seat is earning its cost.
 *
 * A PENDING INVITE IS A SEPARATE STATE and is usually charged the same. Somebody
 * invited three months ago who never accepted is a seat being paid for with
 * nobody in it, and it reads as an ordinary member everywhere else.
 *
 * THE COST PER SEAT IS OPTIONAL AND SHOWN ON THE ROW, because the decision is
 * per person — "remove this one and save £12" is actionable where a total at
 * the bottom is not.
 *
 * NO REMOVE BUTTON HERE. Removing somebody has consequences for their work and
 * belongs behind its own confirmation, not a click in a billing table.
 */
export function SeatUsageRow({ name, email, role, state = "active", lastActive, cost, className }: {
  name: string;
  email?: string;
  role?: string;
  state?: "active" | "invited" | "suspended";
  /** Free text — "March", "2 hours ago". Absent means never. */
  lastActive?: string;
  /** Pre-formatted per-seat cost. */
  cost?: string;
  className?: string;
}) {
  const WORD = { active: "", invited: "Invite not accepted", suspended: "Suspended" } as const;
  const idle = state === "active" && !lastActive;
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className="block">
          {name}
          {role && <span className="text-muted-foreground"> · {role}</span>}
        </span>
        {email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
        <span className="block text-xs text-muted-foreground">
          {state === "invited"
            ? "Never signed in"
            : lastActive ? `Last used ${lastActive}` : "Never signed in"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {cost && <span className="block tabular-nums">{cost}</span>}
        {(WORD[state] || idle) && (
          <span className="block text-xs font-medium">{WORD[state] || "Paying for an unused seat"}</span>
        )}
      </span>
    </li>
  );
}
