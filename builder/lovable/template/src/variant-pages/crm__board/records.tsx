// crm/board — THE BOARD IS THE WORK SURFACE. In the records-first family the
// table leads and a board sits below it as a second lens; here that is
// inverted, because work that MOVES THROUGH STAGES is read by where it is
// stuck rather than by what is in it. The table stays, underneath, because the
// board cannot total a column and somebody always wants the number.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BulkActions } from "@/components/ui/bulk-actions";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Money } from "@/components/ui/money";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSearch } from "@/components/ui/table-search";
export const Route = createFileRoute("/records")({ component: P });
type Deal = {
  id: string; deal: string; company: string; stage: "enquiry" | "quoted" | "survey" | "won";
  priority: "high" | "medium" | "low"; owner: string; value: number; column: string; days: number;
};
const DEALS: Deal[] = [
  { id: "d1", deal: "Shop refit, full joinery", company: "Fern & Co", stage: "quoted", priority: "high", owner: "Rosa", value: 24800, column: "quoted", days: 11 },
  { id: "d2", deal: "Oak staircase", company: "The Old Rectory", stage: "enquiry", priority: "medium", owner: "Sam", value: 9200, column: "enquiry", days: 2 },
  { id: "d3", deal: "Café counter rebuild", company: "Corner Room", stage: "won", priority: "medium", owner: "Rosa", value: 6400, column: "won", days: 1 },
  { id: "d4", deal: "Wardrobes, three rooms", company: "Hillcrest House", stage: "quoted", priority: "low", owner: "Ade", value: 11600, column: "quoted", days: 24 },
  { id: "d5", deal: "Window seats and shutters", company: "Marchmont flat", stage: "enquiry", priority: "high", owner: "Sam", value: 4300, column: "enquiry", days: 6 },
  { id: "d6", deal: "Boardroom table", company: "Gray & Partner", stage: "won", priority: "low", owner: "Ade", value: 7800, column: "won", days: 3 },
  { id: "d7", deal: "Bar front, reclaimed elm", company: "The Wire Mill", stage: "survey", priority: "high", owner: "Rosa", value: 18400, column: "survey", days: 4 },
  { id: "d8", deal: "Library shelving, 14m", company: "Walkley Library", stage: "quoted", priority: "medium", owner: "Sam", value: 15900, column: "quoted", days: 31 },
  { id: "d9", deal: "Two sash windows", company: "Marchmont flat", stage: "quoted", priority: "low", owner: "Ade", value: 2900, column: "quoted", days: 19 },
  { id: "d10", deal: "Kitchen island", company: "Hollin House", stage: "survey", priority: "medium", owner: "Rosa", value: 8600, column: "survey", days: 9 },
];
const STAGE_BADGE = { enquiry: "neutral", survey: "neutral", quoted: "warning", won: "success" } as const;
const COLUMNS = [
  { key: "enquiry", label: "Enquiry" },
  { key: "survey", label: "Survey booked" },
  // The limit is the point of a board. Six quotes out is the studio's ceiling
  // and a column over it is visible from the doorway.
  { key: "quoted", label: "Quoted", limit: 3 },
  { key: "won", label: "Won" },
];
function P() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState(DEALS.map((d) => ({ ...d })));
  const shown = cards.filter((d) => (d.deal + d.company + d.owner).toLowerCase().includes(q.toLowerCase()));
  const totals = COLUMNS.map((c) => ({
    ...c,
    count: shown.filter((d) => d.column === c.key).length,
    value: shown.filter((d) => d.column === c.key).reduce((s, d) => s + d.value, 0),
  }));
  const columns: Column<Deal>[] = [
    { key: "deal", header: "Deal", cell: (d) => <span className="font-medium">{d.deal}</span> },
    { key: "company", header: "Company" },
    { key: "stage", header: "Stage", cell: (d) => <StatusBadge state={STAGE_BADGE[d.stage]}>{d.stage}</StatusBadge> },
    { key: "days", header: "Days in stage", numeric: true, cell: (d) => (
      <span className={d.days > 14 ? "font-semibold tabular-nums" : "tabular-nums"}>{d.days}</span>
    ) },
    { key: "owner", header: "Owner" },
    { key: "value", header: "Value", numeric: true, cell: (d) => <Money amount={d.value} /> },
  ];
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-lg font-semibold tracking-tight">Brindle</p>
          <span className="text-sm text-muted-foreground">Pipeline</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a className="font-medium" href="#/records" aria-current="page">Board</a>
          <a className="text-muted-foreground hover:text-foreground" href="#/record">Latest record</a>
          <a className="text-muted-foreground hover:text-foreground" href="#/">Sign out</a>
        </nav>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <TableSearch value={q} onChange={setQ} placeholder="Search deals, companies, owners" count={shown.length} total={cards.length} />
        <FilterBar filters={[{ key: "open", label: "Stage: not lost" }, { key: "q3", label: "This quarter" }]} onRemove={() => {}} onClear={() => {}} />
      </div>

      {selected.size > 0 && (
        <div className="mt-3">
          <BulkActions count={selected.size} onClear={() => setSelected(new Set())} actions={[
            { label: "Move to quoted", onSelect: () => setSelected(new Set()) },
            { label: "Reassign", onSelect: () => setSelected(new Set()) },
            { label: "Archive", onSelect: () => setSelected(new Set()), destructive: true },
          ]} />
        </div>
      )}

      {/* THE BOARD FIRST AND WHOLE. This is the inversion: in the base family
          this sits below a table, and here it is the surface. */}
      <section className="mt-6">
        <KanbanBoard cards={shown} columns={COLUMNS}
          onMove={(id, column) => setCards(cards.map((c) => (c.id === id ? { ...c, column, stage: column as Deal["stage"] } : c)))}
          renderCard={(c) => (
            <a href="#/record" className="block">
              <p className="text-sm font-medium">{c.deal}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.company} · <Money amount={c.value} /></p>
              <p className="mt-1.5 flex items-center gap-2 text-xs">
                <PriorityBadge level={c.priority} />
                {/* AGE IN THE STAGE, on the card. A board hides how long
                    something has been stuck, which is the one thing a stuck
                    deal has in common with every other stuck deal. */}
                <span className={c.days > 14 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {c.days}d in stage
                </span>
              </p>
            </a>
          )} />
      </section>

      {/* WHAT A BOARD CANNOT DO: total a column. Kept underneath rather than
          discarded, because somebody always wants the number and the answer
          "drag them and count" is not one. */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((t) => (
          <div key={t.key} className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums"><Money amount={t.value} /></p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t.count} {t.count === 1 ? "deal" : "deals"}
              {t.limit && t.count > t.limit ? ` · ${t.count - t.limit} over the limit` : ""}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-base font-medium">The same pipeline, as a table</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For when you want it sorted by days-in-stage rather than by where it sits. Same records —
          moving a card up there changes a row down here.
        </p>
        <div className="mt-4">
          <DataTable columns={columns} rows={shown} rowKey={(d) => d.id}
            onRowClick={() => { location.hash = "#/record"; }}
            empty="No deals match — clear the search." />
        </div>
      </section>
    </main>
  );
}
