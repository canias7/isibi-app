import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * When THIS happens, if THESE hold, do THAT.
 *
 * `query-builder` FILTERS ROWS and `cron-builder` is only a schedule. An
 * automation is a third thing — a trigger, some conditions and a list of
 * actions — and it is what every "when a booking arrives, email me and add a
 * tag" feature needs.
 *
 * THE WHOLE RULE IS RESTATED AS A SENTENCE underneath, always. A rule
 * assembled from selects is read wrongly by the person who wrote it more
 * often than any other control in an app, and the plain-English echo is the
 * only thing that catches "and" where they meant "or".
 *
 * ONE JOINER FOR THE WHOLE CONDITION LIST (the query-builder rule): mixed
 * and/or needs brackets, brackets need a tree, and a tree is a different
 * component. All-and or all-or covers the automations people actually write.
 *
 * A RULE WITH NO ACTIONS IS INCOMPLETE AND SAYS SO rather than saving
 * quietly — a trigger that fires and does nothing looks like a broken app,
 * not like an unfinished rule.
 */
export type Rule = {
  trigger: string;
  joiner: "all" | "any";
  conditions: { field: string; op: string; value: string }[];
  actions: string[];
};

export function RuleBuilder({ rule, onChange, triggers, fields, ops, actions, className }: {
  rule: Rule;
  onChange: (r: Rule) => void;
  triggers: { key: string; label: string }[];
  fields: { key: string; label: string }[];
  ops: { key: string; label: string }[];
  actions: { key: string; label: string }[];
  className?: string;
}) {
  const sel = "h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const label = (list: { key: string; label: string }[], k: string) => list.find((x) => x.key === k)?.label ?? k;

  const sentence = [
    `When ${label(triggers, rule.trigger).toLowerCase()}`,
    rule.conditions.length
      ? `and ${rule.joiner === "all" ? "all" : "any"} of these hold — ${rule.conditions
          .map((c) => `${label(fields, c.field)} ${label(ops, c.op)} ${c.value || "…"}`)
          .join(rule.joiner === "all" ? ", and " : ", or ")}`
      : "",
    rule.actions.length
      ? `then ${rule.actions.map((a) => label(actions, a).toLowerCase()).join(", then ")}.`
      : "then — nothing yet.",
  ].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium">When</span>
        <select value={rule.trigger} aria-label="When" onChange={(e) => onChange({ ...rule, trigger: e.target.value })} className={sel}>
          {triggers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        {rule.conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="w-10 text-muted-foreground">
              {i === 0 ? "if" : rule.joiner === "all" ? "and" : "or"}
            </span>
            <select value={c.field} aria-label="Field" className={sel}
              onChange={(e) => onChange({ ...rule, conditions: rule.conditions.map((x, j) => j === i ? { ...x, field: e.target.value } : x) })}>
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select value={c.op} aria-label="Condition" className={sel}
              onChange={(e) => onChange({ ...rule, conditions: rule.conditions.map((x, j) => j === i ? { ...x, op: e.target.value } : x) })}>
              {ops.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <input value={c.value} placeholder="value"
              onChange={(e) => onChange({ ...rule, conditions: rule.conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })}
              className="h-7 w-28 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <button type="button" aria-label="Remove this condition"
              onClick={() => onChange({ ...rule, conditions: rule.conditions.filter((_, j) => j !== i) })}
              className="cursor-pointer text-muted-foreground hover:text-foreground">×</button>
          </div>
        ))}
        <div className="flex items-center gap-2 ps-10">
          <button type="button"
            onClick={() => onChange({ ...rule, conditions: [...rule.conditions, { field: fields[0]?.key ?? "", op: ops[0]?.key ?? "", value: "" }] })}
            className="cursor-pointer text-xs underline underline-offset-2">Add a condition</button>
          {rule.conditions.length > 1 ? (
            <button type="button"
              onClick={() => onChange({ ...rule, joiner: rule.joiner === "all" ? "any" : "all" })}
              className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-[11px]">
              match {rule.joiner === "all" ? "all" : "any"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium">then</span>
        {actions.map((a) => {
          const on = rule.actions.includes(a.key);
          return (
            <button key={a.key} type="button" aria-pressed={on}
              onClick={() => onChange({ ...rule, actions: on ? rule.actions.filter((x) => x !== a.key) : [...rule.actions, a.key] })}
              className={cn("cursor-pointer rounded-full border px-2 py-0.5",
                on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
              {a.label}
            </button>
          );
        })}
      </div>

      {/* The echo catches "and" where they meant "or" - the whole point. */}
      <p className={cn("rounded-md bg-muted px-2.5 py-1.5 text-xs", !rule.actions.length && "font-medium")}>
        {sentence}
      </p>
      {!rule.actions.length ? (
        <p className="text-[11px] text-muted-foreground">Pick at least one action — a rule that fires and does nothing looks broken.</p>
      ) : null}
    </div>
  );
}
