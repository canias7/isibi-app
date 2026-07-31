import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The shape of a request or a response, as a reference table.
 *
 * REQUIRED IS SPELLED OUT, on every field, in both directions. An asterisk
 * convention means the reader has to notice the absence of a mark to conclude
 * "optional", and absence is the thing eyes are worst at. `Required` and
 * `Optional` are two words.
 *
 * The DEFAULT is a column of its own, because "optional" and "optional,
 * defaults to 20" are different facts and the second is usually what somebody
 * came to find.
 *
 * Nested objects are shown by INDENTED PATH — `address.postcode` — rather than
 * a collapsible tree. A schema reference is read by searching for a field name,
 * and a name hidden inside a collapsed parent cannot be found with the
 * browser's own find.
 *
 * An enum lists its values inline. "string" for a field that only accepts three
 * words is the most common way an API reference wastes somebody's afternoon.
 */
export type SchemaField = {
  name: string;
  type: string;
  required?: boolean;
  description?: React.ReactNode;
  default?: React.ReactNode;
  values?: string[];
  depth?: number;
};

export function SchemaViewer({ fields, title, className }: {
  fields: SchemaField[];
  title?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      {title ? <p className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">{title}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="px-3 py-1.5 text-left font-medium">Field</th>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">Type</th>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">Required</th>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">Default</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.name} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + (f.depth ?? 0) * 1}rem` }}>
                  <code className="font-mono font-medium">{f.name}</code>
                  {f.description ? (
                    <span className="block max-w-80 text-muted-foreground">{f.description}</span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">
                  <code className="font-mono text-muted-foreground">{f.type}</code>
                  {f.values?.length ? (
                    <span className="block text-muted-foreground">
                      one of{" "}
                      {f.values.map((v, i) => (
                        <React.Fragment key={v}>
                          {i > 0 ? ", " : null}
                          <code className="font-mono">{v}</code>
                        </React.Fragment>
                      ))}
                    </span>
                  ) : null}
                </td>
                <td className={cn("px-3 py-1.5 whitespace-nowrap", f.required ? "font-medium" : "text-muted-foreground")}>
                  {f.required ? "Required" : "Optional"}
                </td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                  {f.default ?? (f.required ? "" : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
