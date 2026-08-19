import { cn } from "@/lib/utils";
/**
 * One limit on a plan, with what happens at the top of it.
 *
 * "WHAT HAPPENS WHEN YOU HIT IT" IS THE COLUMN EVERY PRICING TABLE OMITS. A row
 * saying "10,000 emails" does not say whether the 10,001st is charged, queued,
 * or refused — and those are three completely different products. It is the
 * only fact that makes a limit comparable between plans.
 *
 * UNLIMITED IS PRINTED AS A WORD AND QUALIFIED where the caller qualifies it.
 * A bare "Unlimited" beside a fair-use policy is the claim that gets a business
 * a surprise letter, so the footnote sits with the number.
 *
 * CURRENT USAGE IS OPTIONAL AND SHOWN INLINE. The same row serves a public
 * pricing page and a logged-in account screen, and there the number that
 * matters is how close they are.
 *
 * A `<tr>` for the caller's own table, so the plan columns stay theirs — the
 * same shape as `size-chart-row` and `count-sheet`.
 */
export function PlanLimitRow({ label, limit, unit, atLimit = "refused", note, used, className }: {
  label: string;
  /** null for unlimited. */
  limit: number | null;
  unit?: string;
  atLimit?: "refused" | "charged" | "queued" | "slowed";
  /** Qualifier — "subject to fair use". */
  note?: string;
  /** Current usage, on an account screen. */
  used?: number;
  className?: string;
}) {
  const WHAT = {
    refused: "then no more",
    charged: "then charged per extra",
    queued: "then held until it resets",
    slowed: "then slowed down",
  }[atLimit];
  return (
    <tr className={className}>
      <th scope="row" className="px-3 py-2 text-start text-sm font-normal">
        {label}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </th>
      <td className="px-3 py-2 text-end text-sm tabular-nums">
        {limit === null ? <span className="font-medium">Unlimited</span> : (
          <>
            {limit.toLocaleString()}
            {unit && <span className="text-xs text-muted-foreground"> {unit}</span>}
          </>
        )}
        {limit !== null && <span className="block text-xs text-muted-foreground">{WHAT}</span>}
        {used !== undefined && limit !== null && (
          <span className="block text-xs text-muted-foreground">{used.toLocaleString()} used</span>
        )}
      </td>
    </tr>
  );
}
