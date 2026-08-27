import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A small editable grid — the table inside a document, not a data table.
 *
 * The FIRST ROW IS A HEADER and is rendered as `<th>`. A grid of identical
 * inputs is unreadable to a screen reader, which announces every cell with no
 * idea which column it belongs to.
 *
 * Arrow keys move between cells, which is the difference between this and
 * forty tab stops. Tab still moves normally, so the grid is not a keyboard
 * trap.
 *
 * The last row and column cannot be removed — a table with no cells is a
 * state nothing downstream handles.
 */
export function TableEditor({ rows, onChange, className }: {
  rows: string[][]; onChange: (rows: string[][]) => void; className?: string;
}) {
  const cols = rows[0]?.length ?? 0;
  const set = (r: number, c: number, v: string) =>
    onChange(rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? v : cell)) : row)));
  const move = (e: React.KeyboardEvent, r: number, c: number) => {
    const to = e.key === "ArrowDown" ? [r + 1, c] : e.key === "ArrowUp" ? [r - 1, c]
      : e.key === "ArrowRight" && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length ? [r, c + 1]
      : e.key === "ArrowLeft" && (e.target as HTMLInputElement).selectionStart === 0 ? [r, c - 1] : null;
    if (!to) return;
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${to[0]}-${to[1]}"]`);
    if (el) { e.preventDefault(); el.focus(); el.select(); }
  };
  const cell = (r: number, c: number) => (
    <input data-cell={`${r}-${c}`} value={rows[r][c]}
      aria-label={r === 0 ? `Column ${c + 1} heading` : `${rows[0][c] || `Column ${c + 1}`}, row ${r}`}
      className={cn("w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-muted", r === 0 && "font-medium")}
      onChange={(e) => set(r, c, e.target.value)} onKeyDown={(e) => move(e, r, c)} />
  );
  return (
    <div data-slot="table-editor" className={cn("space-y-2", className)}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {rows[0]?.map((_, c) => <th key={c} className="border-e border-border p-0 last:border-e-0">{cell(0, c)}</th>)}
              <th className="w-9 p-0" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((_, i) => {
              const r = i + 1;
              return (
                <tr key={r} className="border-b border-border last:border-0">
                  {rows[r].map((_, c) => <td key={c} className="border-e border-border p-0 last:border-e-0">{cell(r, c)}</td>)}
                  <td className="p-0 text-center">
                    {rows.length > 2 && (
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete row ${r}`}
                        onClick={() => onChange(rows.filter((_, x) => x !== r))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline"
          onClick={() => onChange([...rows, Array(cols).fill("")])}>
          <Plus className="size-4" />Row
        </Button>
        <Button type="button" size="sm" variant="outline"
          onClick={() => onChange(rows.map((r) => [...r, ""]))}>
          <Plus className="size-4" />Column
        </Button>
        {cols > 1 && (
          <Button type="button" size="sm" variant="ghost"
            onClick={() => onChange(rows.map((r) => r.slice(0, -1)))}>
            Remove column
          </Button>
        )}
      </div>
    </div>
  );
}
