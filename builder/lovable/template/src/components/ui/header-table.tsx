import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * HTTP headers, with the sensitive ones masked.
 *
 * THE MASK LIST IS BY NAME, MATCHED CASE-INSENSITIVELY, and it is a default
 * that can be added to. Header names arrive in whatever case the server sent —
 * `Authorization`, `authorization`, `AUTHORIZATION` are all real — so a
 * case-sensitive comparison leaks the very thing this exists to hide, on a
 * majority of responses.
 *
 * `set-cookie` and `cookie` are masked too, not just `authorization`. A session
 * cookie in a screenshot is the same credential as a bearer token, and it is
 * the one people forget.
 *
 * Headers are sorted, with the masked ones NOT moved. Grouping them together
 * would make "which of these is secret" a fact about position, which stops
 * being true the moment somebody adds one.
 *
 * Long values WRAP rather than truncating. A truncated `content-security-policy`
 * is worse than useless — the interesting part of a long header is never the
 * first forty characters.
 */
const SENSITIVE = ["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key", "api-key", "x-auth-token"];

export function isSensitiveHeader(name: string, extra: string[] = []) {
  const n = name.toLowerCase();
  return SENSITIVE.includes(n) || extra.some((e) => e.toLowerCase() === n);
}

export function HeaderTable({ headers, mask = [], title, className }: {
  headers: Record<string, string> | [string, string][];
  mask?: string[];
  title?: React.ReactNode;
  className?: string;
}) {
  const [shown, setShown] = React.useState<Set<string>>(new Set());
  const rows = React.useMemo(() => {
    const list = Array.isArray(headers) ? headers : Object.entries(headers);
    return [...list].sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
  }, [headers]);

  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      {title ? <p className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">{title}</p> : null}
      <table className="w-full border-collapse font-mono text-xs">
        <tbody>
          {rows.map(([k, v]) => {
            const secret = isSensitiveHeader(k, mask);
            const open = shown.has(k);
            return (
              <tr key={k} className="border-b border-border align-top last:border-0">
                <th scope="row" className="w-1/3 px-3 py-1 text-left font-medium break-all">{k}</th>
                <td className="px-3 py-1 break-all">
                  {secret && !open ? "•".repeat(Math.min(28, Math.max(8, v.length))) : v}
                </td>
                <td className="w-8 px-1 py-1">
                  {secret ? (
                    <button type="button" aria-label={open ? `Hide ${k}` : `Show ${k}`} aria-pressed={open}
                      onClick={() => setShown((s) => {
                        const next = new Set(s);
                        if (next.has(k)) next.delete(k); else next.add(k);
                        return next;
                      })}
                      className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground">
                      {open ? <EyeOff aria-hidden className="size-3" /> : <Eye aria-hidden className="size-3" />}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
