import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Size against colour, with the combinations that do not exist struck out.
 *
 * `variant-picker` IS A ROW OF OPTIONS and cannot express the thing that
 * actually goes wrong: medium exists, black exists, medium-in-black is sold
 * out. Two independent pickers let somebody choose an impossible pair and
 * only find out at the submit — a matrix answers it before the click.
 *
 * A SOLD-OUT CELL IS DISABLED AND STRUCK, NOT HIDDEN. Hiding it makes the
 * grid ragged and hides the pattern (this colour never comes in small),
 * which is information the buyer wants.
 *
 * ROW AND COLUMN HEADERS ARE REAL `<th scope>` — a screen reader announcing
 * "unavailable" with no idea which pair is unavailable is worse than
 * nothing, and the scope attributes are what let it say "Medium, Black".
 *
 * Stock counts ride the cell when given ("2 left"), because scarcity is the
 * other question a matrix is read for.
 */
export function VariantMatrix({ rows, cols, cells, selected, onSelect, className }: {
  rows: { key: string; label: string }[];
  cols: { key: string; label: string }[];
  /** `${rowKey}:${colKey}` -> stock; absent or 0 means unavailable. */
  cells: Record<string, number>;
  selected?: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <table className={cn("border-collapse text-xs", className)}>
      <thead>
        <tr>
          <td />
          {cols.map((c) => (
            <th key={c.key} scope="col" className="px-1.5 pb-1 font-medium">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row" className="pe-2 text-end font-medium">{r.label}</th>
            {cols.map((c) => {
              const key = `${r.key}:${c.key}`;
              const stock = cells[key] ?? 0;
              const out = stock <= 0;
              const isSel = selected === key;
              return (
                <td key={c.key} className="p-0.5">
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => onSelect(key)}
                    aria-pressed={isSel}
                    aria-label={`${r.label}, ${c.label}${out ? ", sold out" : stock <= 3 ? `, ${stock} left` : ""}`}
                    className={cn("flex h-9 w-16 flex-col items-center justify-center rounded border text-[10px] leading-tight",
                      out
                        ? "cursor-not-allowed border-border text-muted-foreground line-through"
                        : isSel
                          ? "cursor-pointer border-foreground bg-foreground text-background"
                          : "cursor-pointer border-border hover:bg-muted")}
                  >
                    {out ? "sold out" : <>
                      <span aria-hidden>✓</span>
                      {stock <= 3 ? <span className="tabular-nums">{stock} left</span> : null}
                    </>}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
