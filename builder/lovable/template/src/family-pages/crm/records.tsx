// crm — the work surface. A toolbar (search, filters, bulk actions on
// the selection) over the records table; a row opens the record. The board
// below is the SAME records through the stage lens — the family's `board`
// variant, not a second dataset.
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BulkActions } from "@/components/ui/bulk-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Money } from "@/components/ui/money";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSearch } from "@/components/ui/table-search";
export const Route = createFileRoute("/records")({ component: P });

type Deal = {
  id: string; deal: string; company: string; stage: "enquiry" | "quoted" | "won";
  priority: "high" | "medium" | "low"; owner: string; value: number; column: string;
};

const DEALS: Deal[] = [
  { id: "d1", deal: "Shop refit, full joinery", company: "Fern & Co", stage: "quoted", priority: "high", owner: "Rosa", value: 24800, column: "quoted" },
  { id: "d2", deal: "Oak staircase", company: "The Old Rectory", stage: "enquiry", priority: "medium", owner: "Sam", value: 9200, column: "enquiry" },
  { id: "d3", deal: "Café counter rebuild", company: "Corner Room", stage: "won", priority: "medium", owner: "Rosa", value: 6400, column: "won" },
  { id: "d4", deal: "Wardrobes, three rooms", company: "Hillcrest House", stage: "quoted", priority: "low", owner: "Ade", value: 11600, column: "quoted" },
  { id: "d5", deal: "Window seats and shutters", company: "Marchmont flat", stage: "enquiry", priority: "high", owner: "Sam", value: 4300, column: "enquiry" },
  { id: "d6", deal: "Boardroom table", company: "Gray & Partner", stage: "won", priority: "low", owner: "Ade", value: 7800, column: "won" },
];

const STAGE_BADGE = { enquiry: "neutral", quoted: "warning", won: "success" } as const;

function P() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState(DEALS.map((d) => ({ ...d })));
  const shown = DEALS.filter((d) => (d.deal + d.company + d.owner).toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const columns: Column<Deal>[] = [
    { key: "sel", header: "", width: "2.5rem", cell: (d) => (
      <Checkbox aria-label={`Select ${d.deal}`} checked={selected.has(d.id)} onCheckedChange={(v) => toggle(d.id, v === true)} onClick={(e) => e.stopPropagation()} />
    ) },
    { key: "deal", header: "Deal", cell: (d) => <span className="font-medium">{d.deal}</span> },
    { key: "company", header: "Company" },
    { key: "stage", header: "Stage", cell: (d) => <StatusBadge state={STAGE_BADGE[d.stage]}>{d.stage}</StatusBadge> },
    { key: "priority", header: "Priority", cell: (d) => <PriorityBadge level={d.priority} /> },
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
          <a className="font-medium" href="/records" aria-current="page">Records</a>
          <a className="text-muted-foreground hover:text-foreground" href="/record">Latest record</a>
          <a className="text-muted-foreground hover:text-foreground" href="/">Sign out</a>
        </nav>
      </header>

      {/* The toolbar: search with the live count, then the applied filters. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <TableSearch value={q} onChange={setQ} placeholder="Search deals, companies, owners" count={shown.length} total={DEALS.length} />
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

      <div className="mt-4">
        <DataTable columns={columns} rows={shown} rowKey={(d) => d.id}
          onRowClick={() => { navigate({ to: "/record" }); }}
          empty="No deals match — clear the search." />
      </div>

      {/* The board variant: the same records through the stage lens. */}
      <section className="mt-12">
        <h2 className="text-base font-medium">The same pipeline, as a board</h2>
        <p className="mt-1 text-sm text-muted-foreground">Drag a card to move the deal — the table above is the same records.</p>
        <div className="mt-4">
          <KanbanBoard cards={cards}
            columns={[{ key: "enquiry", label: "Enquiry" }, { key: "quoted", label: "Quoted" }, { key: "won", label: "Won" }]}
            onMove={(id, column) => setCards(cards.map((c) => (c.id === id ? { ...c, column } : c)))}
            renderCard={(c) => (
              <a href="/record" className="block">
                <p className="text-sm font-medium">{c.deal}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.company} · <Money amount={c.value} /></p>
              </a>
            )} />
        </div>
      </section>
    </main>
  );
}
