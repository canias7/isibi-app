import * as React from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Take a CSV and hand back rows.
 *
 * The parser handles QUOTED FIELDS, which is the whole reason not to use
 * `split(",")`: an address, a note or a company name with a comma in it
 * shifts every column after it, and the import succeeds with the data
 * silently in the wrong fields.
 *
 * It also strips the UTF-8 BOM. Excel writes one on every CSV it saves, and
 * without this the first column header is `﻿name`, which matches nothing.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }   // "" is a literal quote
        else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}
export function CsvImport({ onRows, maxBytes = 5 * 1024 * 1024, className }: {
  onRows: (rows: string[][], fileName: string) => void; maxBytes?: number; className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className={cn("space-y-2", className)}>
      <input ref={ref} type="file" accept=".csv,text/csv" className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";                      // so the same file can be picked twice
          if (!f) return;
          setError(null);
          if (f.size > maxBytes) return setError(`That file is too big — ${Math.round(maxBytes / 1024 / 1024)} MB is the limit.`);
          try {
            const rows = parseCsv(await f.text());
            if (!rows.length) return setError("That file has no rows in it.");
            onRows(rows, f.name);
          } catch { setError("We couldn't read that file."); }
        }} />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()}>
        <Upload className="size-4" />Choose a CSV file
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
