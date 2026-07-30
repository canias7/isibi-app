import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * "Which of your columns is the email address?"
 *
 * Required fields that are still unmapped are called out by name at the top,
 * because the failure this prevents is an import of four hundred contacts
 * with no addresses on any of them — discovered afterwards.
 *
 * Every field can be set to "Don't import", which is not the same as leaving
 * it unmapped: one is a decision and the other is an oversight, and the
 * summary has to be able to tell them apart.
 */
export function ColumnMapper({ fields, headers, mapping, onChange, sample, className }: {
  fields: { key: string; label: string; required?: boolean }[];
  headers: string[];
  mapping: Record<string, string>;
  onChange: (fieldKey: string, header: string) => void;
  sample?: Record<string, string>;
  className?: string;
}) {
  const missing = fields.filter((f) => f.required && !mapping[f.key]);
  return (
    <div className={cn("space-y-3", className)}>
      {missing.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Still to match: {missing.map((f) => f.label).join(", ")}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Field</th>
            <th className="py-2 font-medium">Your column</th>
            {sample && <th className="py-2 font-medium">First row</th>}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-b border-border last:border-0">
              <td className="py-2 pr-4">
                {f.label}{f.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                {f.required && <span className="sr-only"> (required)</span>}
              </td>
              <td className="py-2 pr-4">
                <NativeSelect value={mapping[f.key] ?? ""} aria-label={`Column for ${f.label}`}
                  className="h-8 text-xs" onChange={(e) => onChange(f.key, e.target.value)}>
                  <option value="">Don't import</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </NativeSelect>
              </td>
              {sample && (
                <td className="max-w-40 truncate py-2 text-xs text-muted-foreground">
                  {mapping[f.key] ? sample[mapping[f.key]] : ""}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
