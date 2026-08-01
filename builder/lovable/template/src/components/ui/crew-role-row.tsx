import { cn } from "@/lib/utils";
/**
 * A crew member on a production — with the rate and the terms.
 *
 * THE RATE IS SHOWN WITH ITS BASIS. A day rate, a weekly rate and a buyout are
 * different deals with different overtime consequences, and "£350" alone is the
 * source of most freelance disputes on a small production.
 *
 * WHAT THE RATE INCLUDES IS NAMED. A kit fee, a vehicle and a mileage
 * allowance are commonly folded in or not, and the difference is a third of the
 * money on a camera or sound job.
 *
 * A DEAL MEMO EITHER EXISTS OR IT DOES NOT, and the component says which. An
 * unpapered crew booking is the normal state of a small shoot and the reason
 * people are not paid for months.
 *
 * DEPARTMENT AND ROLE ARE SEPARATE, because a call sheet groups by department
 * and a credit list by role, and one field cannot serve both.
 */
export function CrewRoleRow({ name, role, department, rate, rateBasis = "a day", includes = [], dealMemoSigned, daysBooked, className }: {
  name: string;
  role: string;
  department?: string;
  /** Pre-formatted — "£350". */
  rate?: string;
  /** "a day", "a week", "buyout for the shoot". */
  rateBasis?: string;
  /** Kit, vehicle, mileage. */
  includes?: string[];
  dealMemoSigned?: boolean;
  daysBooked?: number;
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {name}
          <span className="block text-xs text-muted-foreground">
            {role}
            {department && ` · ${department}`}
          </span>
        </span>
        {rate && <span className="shrink-0 tabular-nums">{rate} {rateBasis}</span>}
      </p>
      {/* Joined rather than interleaved: the separator was conditional on the
          INCLUDES side, so an empty list ran the two clauses together as
          "14 days bookedno kit or vehicle included". */}
      <p className="text-xs text-muted-foreground">
        {[
          daysBooked !== undefined ? `${daysBooked} ${daysBooked === 1 ? "day" : "days"} booked` : null,
          includes.length > 0 ? `includes ${includes.join(", ")}` : "no kit or vehicle included",
        ].filter(Boolean).join(" · ")}
      </p>
      <p className={cn("text-xs", dealMemoSigned ? "text-muted-foreground" : "font-medium")}>
        {dealMemoSigned
          ? "Deal memo signed."
          : "No signed deal memo — this is how people end up unpaid for months."}
      </p>
    </li>
  );
}
