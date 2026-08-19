import { NativeSelect } from "@/components/ui/native-select";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One line of a rule's condition: field, operator, value.
 *
 * THE OPERATORS COME FROM THE FIELD, not from a fixed list. "is more than" on a
 * name and "contains" on a date are nonsense that a single shared operator list
 * offers anyway — and a rule built from a nonsense pair either never fires or
 * throws somewhere nobody sees. The field carries its own.
 *
 * CHANGING THE FIELD CLEARS THE VALUE. Keeping it leaves "£50" sitting in a
 * condition about a customer's name, which reads as a real setting and is not.
 *
 * VALUE-LESS OPERATORS DROP THE INPUT, so "is empty" is not followed by a box
 * that will be ignored — the same rule `numeric-filter` follows.
 *
 * A SELECT OF ALLOWED VALUES WHEN THE FIELD HAS THEM. A rule matching a status
 * typed by hand breaks silently the day somebody renames the status, and a
 * typo'd value simply never matches — the quietest way for an automation to do
 * nothing.
 *
 * THE ROW WRAPS ON A NARROW SCREEN — three controls do not fit in 375px and
 * horizontal overflow is worse — and the remove button is pushed to the END of
 * whatever line it lands on. Measured: left where it fell, it wrapped onto its
 * own line directly under the value and read as a stray character rather than
 * as this row's action.
 */
export type ConditionField = {
  id: string;
  label: string;
  operators: { id: string; label: string; noValue?: boolean }[];
  /** Fixed values, when the field has them. */
  values?: { id: string; label: string }[];
};

export function ConditionRow({ fields, field, operator, value, onChange, onRemove, prefix, className }: {
  fields: ConditionField[];
  field: string;
  operator: string;
  value: string;
  onChange: (next: { field: string; operator: string; value: string }) => void;
  onRemove?: () => void;
  /** "if" on the first row, "and"/"or" after. */
  prefix?: string;
  className?: string;
}) {
  const f = fields.find((x) => x.id === field) ?? fields[0];
  const ops = f?.operators ?? [];
  const op = ops.find((o) => o.id === operator) ?? ops[0];
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
      <NativeSelect aria-label="Field" value={field} className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = fields.find((x) => x.id === e.target.value);
          onChange({ field: e.target.value, operator: next?.operators[0]?.id ?? "", value: "" });
        }}>
        {fields.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Operator" value={op?.id ?? ""} className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = ops.find((o) => o.id === e.target.value);
          onChange({ field, operator: e.target.value, value: next?.noValue ? "" : value });
        }}>
        {ops.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </NativeSelect>
      {!op?.noValue && (
        f?.values?.length
          ? (
            <NativeSelect aria-label="Value" value={value} className="h-9 w-auto text-sm"
              onChange={(e) => onChange({ field, operator, value: e.target.value })}>
              <option value="">Choose</option>
              {f.values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </NativeSelect>
          )
          : (
            <input aria-label="Value" value={value} onChange={(e) => onChange({ field, operator, value: e.target.value })}
              className="h-9 w-36 rounded-md border border-input bg-transparent px-2 text-sm" />
          )
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove this condition"
          className="ms-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
