import * as React from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A ready-to-run `curl` command for one API call.
 *
 * SECRETS ARE MASKED ON SCREEN AND REAL ON COPY. That is the whole design.
 * Showing the live key means every screenshot and every screen share leaks it;
 * copying a masked one gives somebody a command that fails with 401 and no clue
 * why. A reveal toggle covers the case where it has to be read aloud or typed.
 *
 * Values are SHELL-QUOTED, single quotes, with the one escape that matters:
 * `'` inside a single-quoted string is closed, escaped and reopened, because
 * there is no way to escape it inside. A JSON body with an apostrophe in it —
 * a customer called O'Brien — otherwise produces a command that fails to parse.
 *
 * One flag per LINE with a trailing backslash. A single-line curl with four
 * headers wraps into an unreadable block and cannot be edited by anyone.
 *
 * The body is pretty-printed in the command, which is valid: the JSON is inside
 * quotes and the whitespace is data curl passes through unchanged.
 */
export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildCurl({ method = "GET", url, headers = {}, body }: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const lines = [`curl -X ${method} ${shellQuote(url)}`];
  for (const [k, v] of Object.entries(headers)) lines.push(`  -H ${shellQuote(`${k}: ${v}`)}`);
  if (body) lines.push(`  -d ${shellQuote(body)}`);
  return lines.join(" \\\n");
}

export function CurlExample({ method = "GET", url, headers = {}, body, secrets = [], className }: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  secrets?: string[];
  className?: string;
}) {
  const [shown, setShown] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const real = React.useMemo(() => buildCurl({ method, url, headers, body }), [method, url, headers, body]);
  const masked = React.useMemo(() => {
    let out = real;
    for (const s of secrets) {
      if (!s) continue;
      out = out.split(s).join(s.slice(0, 4) + "•".repeat(Math.max(8, Math.min(24, s.length - 4))));
    }
    return out;
  }, [real, secrets]);

  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-1.5">
        <span className="font-mono text-xs font-semibold">{method}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
        {secrets.length ? (
          <button type="button" onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Hide the key" : "Show the key"} aria-pressed={shown}
            className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
            {shown ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
          </button>
        ) : null}
        <button type="button" aria-label="Copy the command"
          onClick={async () => {
            try { await navigator.clipboard.writeText(real); setCopied(true); setTimeout(() => setCopied(false), 2000); }
            catch { /* refused clipboard */ }
          }}
          className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
          {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">{shown ? real : masked}</pre>
      {secrets.length ? (
        <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          The key is hidden here and copied in full.
        </p>
      ) : null}
    </div>
  );
}
