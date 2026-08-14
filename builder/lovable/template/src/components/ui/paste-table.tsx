import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Paste straight out of a spreadsheet.
 *
 * Splits on TABS, which is what a copy from Excel, Numbers or Sheets actually
 * puts on the clipboard — not commas. For most small imports this replaces
 * the whole save-as-CSV-then-upload round trip, which is several steps where
 * people give up.
 *
 * The row and column count is echoed live, so a paste that came through as
 * one long column is obvious before anything is committed.
 */
export function PasteTable({ onRows, label = "Paste your rows", rows: rowsProp = 8, className }: {
  onRows: (rows: string[][]) => void; label?: string; rows?: number; className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = React.useId();
  const [text, setText] = React.useState("");
  const parsed = React.useMemo(() => text.split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t")), [text]);
  React.useEffect(() => { onRows(parsed); }, [parsed]);
  const cols = parsed.length ? Math.max(...parsed.map((r) => r.length)) : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={uid + "-paste-table"}>{label}</Label>
      <Textarea id={uid + "-paste-table"} rows={rowsProp} value={text} spellCheck={false}
        className="font-mono text-xs" placeholder="Copy the cells in your spreadsheet and paste them here"
        onChange={(e) => setText(e.target.value)} />
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {parsed.length === 0 ? "Nothing pasted yet."
          : `${parsed.length} ${parsed.length === 1 ? "row" : "rows"}, ${cols} ${cols === 1 ? "column" : "columns"}`}
      </p>
    </div>
  );
}
