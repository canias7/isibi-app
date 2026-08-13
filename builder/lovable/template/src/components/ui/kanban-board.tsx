import * as React from "react";
import { cn, labelText } from "@/lib/utils";
/**
 * Columns of cards, dragged BETWEEN columns.
 *
 * THIS IS THE ONE THING `drag-list` AND `sortable-list` CANNOT DO. They
 * reorder within a single list; a board's whole point is that moving a card
 * changes its STATE (todo → doing), so the drop target carries meaning and
 * the callback reports both the column and the position.
 *
 * KEYBOARD IS NOT AN AFTERTHOUGHT (the drag-list rule at board scale): every
 * card carries move-left/move-right buttons, because drag is unreachable by
 * keyboard and unusable on a phone. The buttons are the accessible path and
 * the drag is the convenience, not the reverse.
 *
 * THE WIP LIMIT REFUSES AT THE DROP and says why. A limit that only colours
 * the header is decoration; a limit that silently accepts the drop is a lie.
 * Over the limit, the column says "3 of 3 — finish one first".
 *
 * `lanes` splits the board into rows as well, so a card has a column AND a
 * lane. That is a prop, not a second component — the swimlane board is this
 * board with a row axis.
 */
export type BoardCard = { id: string; column: string; lane?: string };

export function KanbanBoard<T extends BoardCard>({
  cards, columns, lanes, renderCard, onMove, className,
}: {
  cards: T[];
  columns: { key: string; label: React.ReactNode; limit?: number }[];
  lanes?: { key: string; label: React.ReactNode }[];
  renderCard: (card: T) => React.ReactNode;
  onMove: (id: string, column: string) => void;
  className?: string;
}) {
  const [over, setOver] = React.useState<string | null>(null);
  const rows = lanes ?? [{ key: "", label: null as React.ReactNode }];

  const full = (col: { key: string; limit?: number }, lane: string) =>
    col.limit != null &&
    cards.filter((c) => c.column === col.key && (lanes ? c.lane === lane : true)).length >= col.limit;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="flex min-w-max gap-3">
        {columns.map((col) => (
          <div key={col.key} className="flex w-64 shrink-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-0.5">
              <span className="text-sm font-semibold">{col.label}</span>
              {col.limit != null ? (
                <span className={cn("text-[11px] tabular-nums",
                  full(col, "") ? "font-medium" : "text-muted-foreground")}>
                  {cards.filter((c) => c.column === col.key).length} of {col.limit}
                </span>
              ) : null}
            </div>
            {rows.map((lane) => {
              const key = `${col.key}::${lane.key}`;
              const mine = cards.filter((c) => c.column === col.key && (lanes ? c.lane === lane.key : true));
              const blocked = full(col, lane.key);
              return (
                <div key={key}>
                  {lanes ? <p className="px-0.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{lane.label}</p> : null}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setOver(key); }}
                    onDragLeave={() => setOver((o) => (o === key ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(null);
                      const id = e.dataTransfer.getData("text/plain");
                      // The limit refuses the drop; it does not merely decorate.
                      if (!id || blocked) return;
                      onMove(id, col.key);
                    }}
                    className={cn("flex min-h-16 flex-col gap-2 rounded-lg border border-dashed p-2",
                      over === key && !blocked ? "border-foreground bg-muted" : "border-border",
                      over === key && blocked && "border-foreground")}
                  >
                    {mine.map((card) => {
                      const i = columns.findIndex((c) => c.key === col.key);
                      return (
                        <div key={card.id} draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                          className="rounded-md border border-border bg-card p-2 text-sm shadow-sm">
                          {renderCard(card)}
                          {/* The accessible path: drag is the convenience.
                              A column's label is a ReactNode, so `String()`
                              named these two buttons "Move to [object Object]"
                              — and an arrow glyph has no other name. */}
                          <div className="mt-1.5 flex gap-1">
                            <button type="button" disabled={i <= 0}
                              onClick={() => onMove(card.id, columns[i - 1].key)}
                              aria-label={`Move to ${labelText(columns[i - 1]?.label) || "the previous column"}`}
                              className="cursor-pointer rounded border border-border px-1 text-xs disabled:cursor-not-allowed disabled:opacity-30">←</button>
                            <button type="button" disabled={i >= columns.length - 1 || full(columns[i + 1], lane.key)}
                              onClick={() => onMove(card.id, columns[i + 1].key)}
                              aria-label={`Move to ${labelText(columns[i + 1]?.label) || "the next column"}`}
                              className="cursor-pointer rounded border border-border px-1 text-xs disabled:cursor-not-allowed disabled:opacity-30">→</button>
                          </div>
                        </div>
                      );
                    })}
                    {blocked && over === key ? (
                      <p className="text-[11px] font-medium">At the limit — finish one first.</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
