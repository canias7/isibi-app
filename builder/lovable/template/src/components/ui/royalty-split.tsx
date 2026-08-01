import { cn } from "@/lib/utils";
/**
 * Who owns what share — checked to add to 100, because it usually does not.
 *
 * A SPLIT THAT DOES NOT TOTAL 100% IS THE COMMONEST AND MOST EXPENSIVE MISTAKE
 * HERE. It is agreed verbally in a room, written down months later by one
 * person, and discovered when money arrives and cannot be paid out. One line of
 * arithmetic prevents the whole thing.
 *
 * WRITING AND PUBLISHING SHARES ARE SEPARATE TOTALS, each summing to 100
 * independently. A single list conflates the song with its publishing, which
 * are genuinely different rights owned by different parties in different
 * proportions.
 *
 * THE SPLIT IS ONLY WORTH ANYTHING SIGNED. An unsigned sheet is a note of what
 * somebody believed, and the component says whether every party has agreed
 * rather than assuming the list is the agreement.
 *
 * IT SHOWS SHARES AS PERCENTAGES TO TWO DECIMAL PLACES, because three equal
 * writers is 33.33 + 33.33 + 33.34, and rounding it to whole numbers loses a
 * percent that has to go somewhere.
 */
export type Share = { id: string; party: string; role?: string; percent: number; agreed?: boolean };

export function RoyaltySplit({ writing = [], publishing = [], className }: {
  writing?: Share[];
  publishing?: Share[];
  className?: string;
}) {
  const block = (title: string, shares: Share[]) => {
    if (shares.length === 0) return null;
    const total = Number(shares.reduce((n, s) => n + s.percent, 0).toFixed(2));
    const off = Math.abs(total - 100) > 0.001;
    const unsigned = shares.filter((s) => s.agreed === false || s.agreed === undefined);
    return (
      <div key={title} className="space-y-0.5">
        <p className="text-xs font-medium">{title}</p>
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {shares.map((s) => (
            <li key={s.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {s.party}
                {s.role && <span className="text-xs text-muted-foreground"> · {s.role}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{s.percent.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
        <p className={cn("text-xs tabular-nums", off ? "font-medium" : "text-muted-foreground")}>
          {off ? `Adds up to ${total}%, not 100% — this cannot be paid out.` : "Adds up to 100%."}
        </p>
        {unsigned.length > 0 && (
          <p className="text-xs font-medium">
            {unsigned.length} {unsigned.length === 1 ? "party has" : "parties have"} not agreed this in writing.
          </p>
        )}
      </div>
    );
  };
  return (
    <div className={cn("space-y-2", className)}>
      {block("Writing", writing)}
      {block("Publishing", publishing)}
    </div>
  );
}
