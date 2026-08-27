import { cn } from "@/lib/utils";
/**
 * The same room at every layout, because the number changes with each.
 *
 * "THE BARN HOLDS 120" IS TRUE OF ONE ARRANGEMENT AND FALSE OF THE OTHER FIVE.
 * Seated at round tables it is 120, standing it is 200, in rows it is 160, and
 * with a dance floor it is 90 — so a single capacity figure is wrong for
 * whatever the enquirer is actually planning, and they find out on the viewing.
 * That is the whole reason this exists.
 *
 * THE COLUMNS ARE DERIVED from the layouts the rooms actually declare, in first
 * appearance order, rather than taken as a prop. Passed separately, a caller
 * adds cabaret to one room and it silently does not render — the failure being
 * a missing number in a table nobody can tell is incomplete. Same reasoning as
 * the computed goal difference in `league-table`.
 *
 * A LAYOUT A ROOM CANNOT DO IS AN EM DASH, NOT A ZERO. Zero reads as "we tried
 * and it fits nobody"; the dash reads as "not that shape", which is what a room
 * with pillars down the middle actually means. Announced as "not available" for
 * anyone hearing the table rather than seeing it.
 *
 * `size` AND `note` ARE ON THE ROW, not in a paragraph underneath. Floor area
 * and "own bar, own entrance, step-free" are the two things that decide a hire
 * after the number does, and they are buried on every venue site there is.
 */
export type Room = {
  name: string;
  /**
   * Layout name → how many it holds. A layout the room cannot do is simply
   * absent.
   *
   * `number | undefined`, NOT `number`, and that is not pedantry. Written the
   * strict way, an array of rooms where one does Boardroom and the others do
   * not is a union whose other members carry `Boardroom?: undefined` — and
   * `undefined` is not assignable to a `number` index signature, so `TS2322`
   * and the page is refused. The honest caller, listing only the layouts each
   * room really does, could not compile; the only shape that would have was a
   * lie. Same family as the `PublicRow` and `RowId` failures.
   */
  capacities: Record<string, number | undefined>;
  /** "14m × 9m", "126m²". Free text — venues quote it differently. */
  size?: string | null;
  /** "Own bar and entrance, step-free throughout". */
  note?: string | null;
};
export function CapacityTable({ rooms, caption, className }: {
  rooms: Room[];
  caption?: string;
  className?: string;
}) {
  if (!rooms.length) return null;
  // First-appearance order, so the venue's own priority survives.
  const layouts: string[] = [];
  for (const r of rooms) for (const k of Object.keys(r.capacities ?? {})) if (!layouts.includes(k)) layouts.push(k);
  return (
    <div data-slot="capacity-table" className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="pb-3 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-start text-xs uppercase tracking-widest text-muted-foreground">
            <th scope="col" className="py-2 pe-4 font-medium">Room</th>
            {layouts.map((l) => (
              <th key={l} scope="col" className="py-2 pe-4 text-end font-medium">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.name} className="border-b border-border/60 align-baseline">
              <th scope="row" className="py-3.5 pe-4 text-start font-[inherit]">
                <span className="font-medium">{r.name}</span>
                {r.size && <span className="block text-xs text-muted-foreground">{r.size}</span>}
                {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
              </th>
              {layouts.map((l) => {
                const n = r.capacities?.[l];
                return (
                  <td key={l} className="py-3.5 pe-4 text-end tabular-nums">
                    {typeof n === "number"
                      ? n
                      : <><span aria-hidden="true" className="text-muted-foreground">—</span><span className="sr-only">not available in this layout</span></>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
