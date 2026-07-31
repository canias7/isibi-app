import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Two panes and arrows between them — available on the left, chosen on the
 * right.
 *
 * The right shape when the chosen set is long and ORDER DOES NOT MATTER:
 * assigning forty permissions to a role, picking twenty columns for a report.
 * Below about a dozen, a checkbox list is better and needs no explanation.
 *
 * Each pane says how many it holds and searches independently — a picker that
 * cannot search is unusable at exactly the size that justifies it. Search
 * filters what is SHOWN and never what "move all" moves; moving a hidden
 * option is how somebody grants a permission they never saw.
 */
export function TransferList({ options, selected, onChange, availableLabel = "Available",
  selectedLabel = "Selected", className }: {
  options: { value: string; label: string }[]; selected: string[];
  onChange: (v: string[]) => void;
  availableLabel?: string; selectedLabel?: string; className?: string;
}) {
  const [ql, setQl] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [markL, setMarkL] = React.useState<string[]>([]);
  const [markR, setMarkR] = React.useState<string[]>([]);
  const left = options.filter((o) => !selected.includes(o.value));
  const right = options.filter((o) => selected.includes(o.value));
  const show = (rows: typeof options, q: string) =>
    q ? rows.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : rows;

  const Pane = ({ label, rows, q, setQ, marks, setMarks }: {
    label: string; rows: typeof options; q: string; setQ: (s: string) => void;
    marks: string[]; setMarks: (v: string[]) => void;
  }) => (
    <div className="flex min-w-0 flex-1 flex-col rounded-md border border-border">
      <div className="space-y-2 border-b border-border p-2">
        <p className="text-xs font-medium">{label} <span className="tabular-nums text-muted-foreground">({rows.length})</span></p>
        <Input value={q} placeholder="Search" aria-label={`Search ${label}`} className="h-7 text-xs"
          onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="max-h-56 flex-1 overflow-y-auto p-1">
        {show(rows, q).map((o) => (
          <li key={o.value}>
            <button type="button" aria-pressed={marks.includes(o.value)}
              onClick={() => setMarks(marks.includes(o.value) ? marks.filter((v) => v !== o.value) : [...marks, o.value])}
              className={cn("w-full cursor-pointer truncate rounded px-2 py-1 text-left text-sm",
                marks.includes(o.value) ? "bg-muted font-medium" : "hover:bg-muted/60")}>
              {o.label}
            </button>
          </li>
        ))}
        {show(rows, q).length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">Nothing here</li>}
      </ul>
    </div>
  );

  return (
    <div className={cn("flex flex-col items-stretch gap-3 sm:flex-row", className)}>
      <Pane label={availableLabel} rows={left} q={ql} setQ={setQl} marks={markL} setMarks={setMarkL} />
      <div className="flex flex-row justify-center gap-1 sm:flex-col sm:justify-center">
        <Button type="button" size="icon-sm" variant="outline" aria-label="Add all"
          disabled={!left.length} onClick={() => { onChange(options.map((o) => o.value)); setMarkL([]); }}>
          <ChevronsRight className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Add selected"
          disabled={!markL.length} onClick={() => { onChange([...selected, ...markL]); setMarkL([]); }}>
          <ChevronRight className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Remove selected"
          disabled={!markR.length} onClick={() => { onChange(selected.filter((v) => !markR.includes(v))); setMarkR([]); }}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Remove all"
          disabled={!right.length} onClick={() => { onChange([]); setMarkR([]); }}>
          <ChevronsLeft className="size-4" />
        </Button>
      </div>
      <Pane label={selectedLabel} rows={right} q={qr} setQ={setQr} marks={markR} setMarks={setMarkR} />
    </div>
  );
}
