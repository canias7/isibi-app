import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A grid you move around with the arrow keys and type straight into.
 *
 * ROVING TABINDEX, not a tab stop per cell. A 12×30 grid with every cell
 * focusable is 360 presses to tab past, which makes the rest of the page
 * unreachable in practice; one tab stop for the whole grid plus arrow keys
 * inside it is the pattern every real grid uses and the one screen readers
 * expect from `role="grid"`.
 *
 * Typing a printable character STARTS an edit with that character, the way a
 * spreadsheet does — the alternative is pressing Enter first, which nobody
 * does, so the first keystroke of every value is silently swallowed.
 *
 * Enter commits and moves DOWN, Tab commits and moves right. Escape restores
 * the value the cell had when the edit started.
 */
export function SpreadsheetGrid({
  columns, rows, onChange, rowHeader, className,
}: {
  columns: { key: string; header: string; align?: "left" | "right"; readOnly?: boolean }[];
  rows: Record<string, string>[];
  onChange: (rowIndex: number, key: string, value: string) => void;
  rowHeader?: (rowIndex: number) => React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = React.useState({ r: 0, c: 0 });
  const [draft, setDraft] = React.useState<string | null>(null);
  const original = React.useRef("");
  const cellRef = React.useRef<HTMLTableCellElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (draft == null) cellRef.current?.focus();
    else inputRef.current?.focus();
  }, [active, draft]);

  const go = (dr: number, dc: number) => {
    setActive((a) => ({
      r: Math.max(0, Math.min(rows.length - 1, a.r + dr)),
      c: Math.max(0, Math.min(columns.length - 1, a.c + dc)),
    }));
  };
  const startEdit = (seed?: string) => {
    if (columns[active.c]?.readOnly) return;
    const cur = rows[active.r]?.[columns[active.c].key] ?? "";
    original.current = cur;
    setDraft(seed ?? cur);
  };
  const commit = (move: "down" | "right" | "none") => {
    if (draft != null && draft !== original.current) onChange(active.r, columns[active.c].key, draft);
    setDraft(null);
    if (move === "down") go(1, 0);
    if (move === "right") go(0, 1);
  };

  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table role="grid" className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {rowHeader ? <th scope="col" className="w-10 px-2 py-1.5" /> : null}
            {columns.map((c) => (
              <th key={c.key} scope="col"
                className={cn("border-r border-border px-2 py-1.5 font-medium last:border-r-0",
                  c.align === "right" ? "text-right" : "text-left")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {rowHeader ? (
                <th scope="row" className="w-10 border-r border-border bg-muted/50 px-2 py-1 text-center text-xs font-normal text-muted-foreground tabular-nums">
                  {rowHeader(r)}
                </th>
              ) : null}
              {columns.map((c, ci) => {
                const on = active.r === r && active.c === ci;
                const editing = on && draft != null;
                return (
                  <td
                    key={c.key}
                    ref={on ? cellRef : undefined}
                    tabIndex={on && !editing ? 0 : -1}
                    aria-selected={on}
                    onClick={() => { setDraft(null); setActive({ r, c: ci }); }}
                    onDoubleClick={() => { setActive({ r, c: ci }); startEdit(); }}
                    onKeyDown={(e) => {
                      if (editing) return;
                      if (e.key === "ArrowDown") { e.preventDefault(); go(1, 0); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); go(-1, 0); }
                      else if (e.key === "ArrowLeft") { e.preventDefault(); go(0, -1); }
                      else if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); go(0, 1); }
                      else if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); startEdit(); }
                      else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); if (!c.readOnly) onChange(r, c.key, ""); }
                      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); startEdit(e.key); }
                    }}
                    className={cn("border-r border-border p-0 last:border-r-0",
                      c.readOnly && "bg-muted/40",
                      on && "outline-2 -outline-offset-2 outline-ring",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}
                  >
                    {editing ? (
                      <input
                        ref={inputRef}
                        value={draft ?? ""}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit("none")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commit("down"); }
                          else if (e.key === "Tab") { e.preventDefault(); commit("right"); }
                          else if (e.key === "Escape") { e.preventDefault(); setDraft(null); }
                        }}
                        className={cn("w-full bg-background px-2 py-1 outline-none", c.align === "right" && "text-right tabular-nums")}
                      />
                    ) : (
                      <span className={cn("block px-2 py-1", c.align === "right" ? "text-right tabular-nums" : "text-left")}>
                        {row[c.key] || " "}
                      </span>
                    )}
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
