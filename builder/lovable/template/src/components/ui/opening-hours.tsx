import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DayHours = {
  /** 0 = Sunday, matching Date.getDay(). */
  day: number;
  label: string;
  /** "09:00" / "18:00", or null for closed. */
  open?: string | null;
  close?: string | null;
};

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Opening hours, with an honest "Open now".
 *
 * The state is computed from the VISITOR's clock, which is the only clock that
 * matters to somebody deciding whether to walk over. A row with no times reads
 * as closed rather than as missing data.
 */
export function OpeningHours({ days, now, className }: {
  days: DayHours[];
  /** Injectable for tests and for rendering a fixed moment. */
  now?: Date;
  className?: string;
}) {
  const d = now ?? new Date();
  const today = d.getDay();
  const mins = d.getHours() * 60 + d.getMinutes();
  const row = days.find((x) => x.day === today);
  const o = row && row.open ? toMin(row.open) : null;
  const c = row && row.close ? toMin(row.close) : null;
  const openNow = o != null && c != null && mins >= o && mins < c;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <span className="font-medium">Opening hours</span>
        <Badge variant={openNow ? "default" : "secondary"}>{openNow ? "Open now" : "Closed"}</Badge>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {days.map((x) => (
            <tr key={x.day} className={cn("border-b border-border last:border-0", x.day === today && "font-medium")}>
              <th scope="row" className="py-1.5 text-left font-normal">{x.label}</th>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {x.open && x.close ? `${x.open} – ${x.close}` : "Closed"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
