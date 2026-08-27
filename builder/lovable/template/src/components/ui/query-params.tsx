import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A query string, taken apart.
 *
 * REPEATED KEYS ARE KEPT. `?tag=a&tag=b` is the normal way arrays are passed
 * and it is what most APIs expect, so a viewer built on `Object.fromEntries` —
 * which silently keeps only the last — reports the wrong request. `URLSearchParams`
 * is iterated directly for exactly that reason.
 *
 * Values are shown DECODED, with the raw form beside anything that changed.
 * `%20`s and `+`s are noise when reading, and are the whole problem when
 * debugging — so both, only when they differ.
 *
 * An EMPTY value is shown as such rather than as a blank cell: `?debug` and
 * `?debug=` and no `debug` at all are three different requests, and servers
 * treat them differently.
 *
 * Nothing here decides that a parameter is a secret, because a query string
 * should not carry one — it is in browser history, in the referrer and in every
 * access log. `mask` is there for the cases where it does anyway.
 */
export function parseQuery(input: string): [string, string][] {
  const q = input.includes("?") ? input.slice(input.indexOf("?") + 1) : input;
  const out: [string, string][] = [];
  // Iterated rather than fromEntries: repeated keys are how arrays are passed.
  new URLSearchParams(q).forEach((v, k) => out.push([k, v]));
  return out;
}

export function QueryParams({ query, mask = [], className }: {
  query: string;
  mask?: string[];
  className?: string;
}) {
  const rows = React.useMemo(() => parseQuery(query), [query]);
  const raw = React.useMemo(() => {
    const q = query.includes("?") ? query.slice(query.indexOf("?") + 1) : query;
    return q.split("&").filter(Boolean).map((p) => p.split("=").slice(1).join("="));
  }, [query]);

  if (rows.length === 0) {
    return <p data-slot="query-params" className={cn("text-xs text-muted-foreground", className)}>No query parameters.</p>;
  }
  return (
    <table className={cn("w-full border-collapse overflow-hidden rounded-md border border-border font-mono text-xs", className)}>
      <tbody>
        {rows.map(([k, v], i) => {
          const secret = mask.some((m) => m.toLowerCase() === k.toLowerCase());
          const encoded = raw[i];
          return (
            <tr key={k + i} className="border-b border-border align-top last:border-0">
              <th scope="row" className="w-1/3 px-3 py-1 text-start font-medium break-all">{k}</th>
              <td className="px-3 py-1 break-all">
                {secret ? "•".repeat(Math.min(24, Math.max(8, v.length)))
                  : v === "" ? <span className="text-muted-foreground italic">(empty)</span>
                  : v}
                {!secret && encoded && encoded !== v ? (
                  <span className="block text-muted-foreground">raw: {encoded}</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
