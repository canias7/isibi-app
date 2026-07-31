import * as React from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Download what is on screen as CSV, in the browser, with no server.
 *
 * The important part is not the commas — it is CSV INJECTION. Excel, Numbers,
 * LibreOffice and Sheets all EVALUATE a cell beginning `=`, `+`, `-` or `@`, so
 * a row somebody typed into a public form can become a live formula the moment
 * the owner opens their own export. Quoting does not help: the CSV parser
 * strips the quotes before the formula parser sees the cell. A leading
 * apostrophe is what those programs read as "this is text".
 *
 * `-` is handled narrowly, because it is also how every negative number starts:
 * a value that is simply a number is left alone.
 *
 * The button says what SCOPE it will write — "Export 24 rows" — because the
 * expectation after filtering a table is not the same for everyone, and the
 * cheapest way to settle it is to print the number on the button.
 */
const RISKY = /^[=+@\t\r]/;

export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  const safe = RISKY.test(s) || (s.startsWith("-") && !/^-?\d+(\.\d+)?$/.test(s)) ? "'" + s : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(columns: { key: string; header: string }[], rows: Record<string, unknown>[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(","));
  return [head, ...body].join("\r\n");
}

export function TableExport({ columns, rows, filename = "export.csv", label, className }: {
  columns: { key: string; header: string }[];
  rows: Record<string, unknown>[];
  filename?: string;
  label?: string;
  className?: string;
}) {
  const download = () => {
    const blob = new Blob(["﻿" + toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={download} disabled={rows.length === 0}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium",
        "hover:bg-muted disabled:pointer-events-none disabled:opacity-50", className)}>
      <Download aria-hidden className="size-3.5" />
      {label ?? `Export ${rows.length.toLocaleString()} ${rows.length === 1 ? "row" : "rows"}`}
    </button>
  );
}
