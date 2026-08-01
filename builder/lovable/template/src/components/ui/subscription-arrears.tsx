import { cn } from "@/lib/utils";
/**
 * Members behind on subscriptions — handled the way a club should.
 *
 * IT SEPARATES FORGOTTEN FROM UNAFFORDABLE. Most arrears are a lapsed standing
 * order and a reminder fixes them; a few are somebody who cannot pay, and the
 * right response is a quiet conversation about a concessionary rate rather than
 * a third demand. Treating both the same loses the second person entirely.
 *
 * THE SUSPENSION RULE IS STATED IN ADVANCE. Members removed from a team sheet
 * or refused at a door without warning is how a club loses somebody for good
 * over a small sum.
 *
 * IT IS NOT A PUBLIC LIST. Arrears are shown to whoever administers them, and
 * the component says so — a defaulters list on a noticeboard is a thing clubs
 * genuinely still do.
 *
 * THE TOTAL IS SHOWN because for a small club it is often the difference
 * between solvent and not, and it is the number a treasurer reports.
 */
export type ArrearsMember = {
  id: string;
  name: string;
  amount: number;
  monthsBehind?: number;
  lastRemindedOn?: string;
  /** True where they have said they are struggling. */
  hardship?: boolean;
};

export function SubscriptionArrears({ members, suspendAfterMonths, concessionNote, currency = "GBP", locale = "en-GB", className }: {
  members: ArrearsMember[];
  /** When membership is suspended. */
  suspendAfterMonths?: number;
  /** What to offer somebody who cannot pay. */
  concessionNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  const total = members.reduce((n, m) => n + m.amount, 0);
  const hardship = members.filter((m) => m.hardship);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{money(total)} outstanding</span>
        <span className="text-muted-foreground"> · {members.length} {members.length === 1 ? "member" : "members"}</span>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {members.map((m) => (
          <li key={m.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1">{m.name}</span>
              <span className="shrink-0 tabular-nums">{money(m.amount)}</span>
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {m.monthsBehind !== undefined && `${m.monthsBehind} ${m.monthsBehind === 1 ? "month" : "months"} behind`}
              {m.monthsBehind !== undefined && m.lastRemindedOn ? " · " : ""}
              {m.lastRemindedOn && `reminded ${m.lastRemindedOn}`}
            </p>
            {m.hardship && (
              <p className="text-xs font-medium">
                Has said they are struggling — this is a conversation, not a reminder.
              </p>
            )}
          </li>
        ))}
      </ul>
      {suspendAfterMonths !== undefined && (
        <p className="text-xs text-muted-foreground">
          Membership is suspended after {suspendAfterMonths} months. Tell people before it happens, not after.
        </p>
      )}
      {hardship.length > 0 && concessionNote && <p className="text-xs">{concessionNote}</p>}
      <p className="text-xs text-muted-foreground">
        For whoever handles subscriptions. This is not a list to put on a noticeboard.
      </p>
    </div>
  );
}
