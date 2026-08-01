import { cn } from "@/lib/utils";
/**
 * What a volunteer role involves — written to be turned down safely.
 *
 * THE TIME COMMITMENT IS SPECIFIC AND HONEST. "A few hours a month" is what
 * every advert says and is why people leave after eight weeks having discovered
 * it was eight. A stated commitment loses some applicants and keeps the ones who
 * stay.
 *
 * IT SEPARATES WHAT IS ESSENTIAL FROM WHAT IS USEFUL. Volunteer adverts list
 * wishes as requirements and put off exactly the people who would be good at
 * it — most notably anybody who reads a list carefully before applying.
 *
 * ACCESSIBILITY IS ADDRESSED IN THE ROLE, not in a policy. Whether it can be
 * done sitting, from home, or without driving is what decides whether a
 * disabled volunteer can apply, and it is almost never stated.
 *
 * EXPENSES ARE STATED, because "unpaid" and "out of pocket" are different
 * things, and the second silently excludes anybody who cannot subsidise a
 * charity.
 */
export function RoleDescription({ title, purpose, commitment, essential = [], useful = [], accessibilityNote, expensesNote, supportedBy, className }: {
  title: string;
  /** Why the role exists. */
  purpose?: string;
  /** "Two hours a week, term time" — specific. */
  commitment?: string;
  /** Genuinely required. */
  essential?: string[];
  /** Nice to have, and labelled as such. */
  useful?: string[];
  /** Whether it can be done seated, remotely, without driving. */
  accessibilityNote?: string;
  expensesNote?: string;
  /** Who they would report to or work alongside. */
  supportedBy?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium">{title}</p>
      {purpose && <p className="text-xs">{purpose}</p>}
      <p className={cn("text-xs", commitment ? "" : "font-medium")}>
        {commitment ?? "No time commitment stated — say what it really is, or people leave after eight weeks."}
      </p>
      {essential.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">You will need</p>
          <ul className="text-xs text-muted-foreground">
            {essential.map((e, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{e}</span></li>
            ))}
          </ul>
        </div>
      )}
      {useful.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs">Useful, but we will teach you</p>
          <ul className="text-xs text-muted-foreground">
            {useful.map((u, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{u}</span></li>
            ))}
          </ul>
        </div>
      )}
      {accessibilityNote && <p className="text-xs">{accessibilityNote}</p>}
      <p className="text-xs text-muted-foreground">
        {expensesNote ?? "Expenses are not mentioned, which usually means people are subsidising us."}
      </p>
      {supportedBy && <p className="text-xs text-muted-foreground">You would work alongside {supportedBy}.</p>}
    </div>
  );
}
