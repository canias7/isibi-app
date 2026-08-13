import { Check, X, Clock } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * One person's decision on one thing — name, verdict, when.
 *
 * THE VERDICT IS AN ICON AND A WORD, never a coloured dot. A column of green
 * and red circles is the single most common sign-off UI and it says nothing at
 * all in greyscale, in a printed audit pack, or to a reader who cannot
 * distinguish the two — which is a problem when the printed pack is the thing
 * somebody signs.
 *
 * WAITING IS A REAL STATE, not an empty cell. A blank beside a name reads as a
 * rendering failure or as "not required", and neither is what "we are still
 * waiting on Sam" means.
 *
 * THE TIMESTAMP IS PART OF THE VERDICT. An approval with no time on it cannot
 * answer whether it happened before or after the thing changed, which is the
 * only question anybody asks an approval trail.
 *
 * A `<li>` by design — sign-offs are a list, and `ApproverList` composes these.
 */
export function SignOffRow({ name, role, state, at, note, className }: {
  name: string;
  role?: string;
  state: "approved" | "rejected" | "waiting";
  /** ISO date-time. */
  at?: string;
  note?: string;
  className?: string;
}) {
  const Icon = state === "approved" ? Check : state === "rejected" ? X : Clock;
  const word = state === "approved" ? "Approved" : state === "rejected" ? "Rejected" : "Waiting";
  const d = at ? toDate(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", state === "waiting" && "text-muted-foreground")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block">
          {name}
          {role && <span className="ml-1.5 text-muted-foreground">{role}</span>}
        </span>
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block text-xs", state === "waiting" ? "text-muted-foreground" : "font-medium")}>{word}</span>
        {ok && (
          <time dateTime={d!.toISOString()} className="block text-xs text-muted-foreground">
            {d!.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </time>
        )}
      </span>
    </li>
  );
}
