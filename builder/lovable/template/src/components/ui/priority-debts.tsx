import { cn } from "@/lib/utils";

/**
 * Which debts to pay FIRST, and why — the single most useful thing a free
 * debt-advice service tells anybody, and a thing no list component can express.
 *
 * THE ORDER IS THE ADVICE. A priority debt is not the biggest or the loudest:
 * it is the one whose creditor can take your home, your liberty or your heat.
 * Rent arrears of £400 outrank a £9,000 credit card, and the intuition of
 * everybody in that situation is the exact opposite — they pay whoever is
 * ringing them. So this component sorts by CONSEQUENCE and prints the
 * consequence next to every row, because "priority" as a bare label teaches
 * nothing.
 *
 * TWO GROUPS, ALWAYS BOTH SHOWN, and the second one is not an afterthought.
 * Hiding non-priority debts would leave somebody thinking the card debt has
 * gone away; showing them under a heading that says these creditors can be
 * made to wait is the reassurance the page exists to give.
 *
 * NO COLOUR ANYWHERE. This is a page read by somebody frightened, often on a
 * phone, sometimes printed at a library. A red band across the debts that can
 * take your house adds fear and no information — the consequence sentence
 * already carries it. The grouping is done with a heading and a rule, and it
 * survives greyscale, print and a screen reader in that order.
 */
export type Debt = {
  what: string;
  amount?: string | null;
  /** What this creditor can actually do. The whole reason for the ordering. */
  consequence: string;
  priority: boolean;
};

function Group({ title, note, items }: { title: string; note: string; items: Debt[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{note}</p>
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {items.map((d) => (
          <li key={d.what} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
            <span className="font-medium">{d.what}</span>
            {d.amount && <span className="tabular-nums text-sm text-muted-foreground">{d.amount}</span>}
            <span className="w-full text-sm text-muted-foreground">{d.consequence}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PriorityDebts({ debts, className }: {
  debts: Debt[];
  className?: string;
}) {
  if (!debts.length) return null;
  return (
    <div className={cn("space-y-8", className)}>
      <Group
        title="Deal with these first"
        note="Not because they are the largest — because of what these creditors can do if nothing is agreed. Anyone here should be contacted before anyone below."
        items={debts.filter((d) => d.priority)}
      />
      <Group
        title="These can wait until the above are arranged"
        note="They will keep writing and it will feel like the opposite. They cannot take your home, your heat or your liberty, and an adviser can hold them off while the first list is sorted."
        items={debts.filter((d) => !d.priority)}
      />
    </div>
  );
}
