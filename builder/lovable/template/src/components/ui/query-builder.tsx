import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Where status is Cancelled AND price is over £30" — filters built visually.
 *
 * THE JOINER IS ONE CHOICE FOR THE WHOLE GROUP, not per row. Mixed AND and OR
 * without parentheses is genuinely ambiguous, and every implementation that
 * allows it produces a query the person did not mean — usually a much wider one
 * than they expected, which on a delete is expensive.
 *
 * THE OPERATORS OFFERED DEPEND ON THE FIELD'S TYPE. "Contains" on a date and
 * "is after" on a status are how a builder produces filters the backend refuses,
 * and the error lands far from the cause.
 *
 * The whole thing is stated in PLAIN ENGLISH under the rows, so what is about
 * to run is readable without parsing the widgets. That sentence is what
 * somebody checks before pressing Apply.
 *
 * An EMPTY value is a real, distinct thing — "status is empty" is a filter
 * people want — so a row with no value is not silently dropped; it uses the
 * `is empty` operator.
 */
export type Field = { key: string; label: string; type: "text" | "number" | "date" | "enum"; values?: string[] };
export type Rule = { id: number; field: string; op: string; value: string };

const OPS: Record<Field["type"], { key: string; label: string; noValue?: boolean }[]> = {
  text: [{ key: "contains", label: "contains" }, { key: "is", label: "is" }, { key: "empty", label: "is empty", noValue: true }],
  number: [{ key: "eq", label: "is" }, { key: "gt", label: "is over" }, { key: "lt", label: "is under" }],
  date: [{ key: "on", label: "is on" }, { key: "after", label: "is after" }, { key: "before", label: "is before" }],
  enum: [{ key: "is", label: "is" }, { key: "not", label: "is not" }],
};

export function describeRules(rules: Rule[], fields: Field[], joiner: "and" | "or") {
  const parts = rules.map((r) => {
    const f = fields.find((x) => x.key === r.field);
    const op = OPS[f?.type ?? "text"].find((o) => o.key === r.op);
    return `${f?.label ?? r.field} ${op?.label ?? r.op}${op?.noValue ? "" : ` ${r.value || "…"}`}`;
  });
  return parts.length ? parts.join(` ${joiner} `) : "no filters";
}

export function QueryBuilder({ fields, rules, joiner, onRules, onJoiner, className }: {
  fields: Field[];
  rules: Rule[];
  joiner: "and" | "or";
  onRules: (next: Rule[]) => void;
  onJoiner: (next: "and" | "or") => void;
  className?: string;
}) {
  const next = React.useRef(rules.reduce((n, r) => Math.max(n, r.id), 0) + 1);
  const typeOf = (key: string) => fields.find((f) => f.key === key)?.type ?? "text";
  const set = (id: number, patch: Partial<Rule>) =>
    onRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Match</span>
        {/* One joiner for the group: mixed AND/OR without brackets is ambiguous. */}
        <select value={joiner} onChange={(e) => onJoiner(e.target.value as "and" | "or")}
          aria-label="Match all or any" className="h-7 cursor-pointer rounded border border-border bg-background px-1.5">
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
        <span className="text-muted-foreground">of these</span>
      </div>

      {rules.map((r) => {
        const type = typeOf(r.field);
        const ops = OPS[type];
        const op = ops.find((o) => o.key === r.op) ?? ops[0];
        const field = fields.find((f) => f.key === r.field);
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-1.5">
            <select value={r.field} aria-label="Field"
              onChange={(e) => set(r.id, { field: e.target.value, op: OPS[typeOf(e.target.value)][0].key, value: "" })}
              className="h-8 cursor-pointer rounded border border-border bg-background px-1.5 text-xs">
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select value={op.key} onChange={(e) => set(r.id, { op: e.target.value })} aria-label="Condition"
              className="h-8 cursor-pointer rounded border border-border bg-background px-1.5 text-xs">
              {ops.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {op.noValue ? null : type === "enum" && field?.values ? (
              <select value={r.value} onChange={(e) => set(r.id, { value: e.target.value })} aria-label="Value"
                className="h-8 cursor-pointer rounded border border-border bg-background px-1.5 text-xs">
                <option value="">Choose…</option>
                {field.values.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <input value={r.value} onChange={(e) => set(r.id, { value: e.target.value })} aria-label="Value"
                type={type === "date" ? "date" : "text"} inputMode={type === "number" ? "decimal" : undefined}
                className="h-8 w-28 rounded border border-border bg-background px-1.5 text-xs outline-none focus-visible:border-ring" />
            )}
            <button type="button" onClick={() => onRules(rules.filter((x) => x.id !== r.id))}
              aria-label="Remove this filter"
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        );
      })}

      <button type="button"
        onClick={() => onRules([...rules, { id: next.current++, field: fields[0].key, op: OPS[fields[0].type][0].key, value: "" }])}
        className="inline-flex cursor-pointer items-center gap-1 self-start rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
        <Plus aria-hidden className="size-3" /> Add a filter
      </button>
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">
        Showing rows where <strong className="font-medium text-foreground">{describeRules(rules, fields, joiner)}</strong>.
      </p>
    </div>
  );
}
