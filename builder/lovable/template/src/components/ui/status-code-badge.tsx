import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An HTTP status code, with what it means.
 *
 * The NAME is next to the number, always. "404" is universally known; 422, 409
 * and 502 are not, and a table of bare numbers makes the reader look each one
 * up — which is the work this badge exists to remove.
 *
 * The class is carried by FILL, not hue: 2xx is solid, 3xx is outlined, 4xx is
 * outlined-bold, 5xx is solid-bold. Green/amber/red is the convention and it is
 * useless in greyscale, in print, and to anyone who cannot separate those hues
 * — in a log full of these, that is the whole scanning signal.
 *
 * An UNKNOWN code still renders, with its class inferred from the leading
 * digit. APIs invent codes, and a badge that refuses one it does not recognise
 * turns a slightly unusual response into a blank cell.
 */
const NAMES: Record<number, string> = {
  200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 402: "Payment Required", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 409: "Conflict", 410: "Gone", 413: "Payload Too Large", 415: "Unsupported Media Type",
  422: "Unprocessable Content", 429: "Too Many Requests",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

export function statusName(code: number) {
  return NAMES[code] ?? (
    code >= 500 ? "Server Error" : code >= 400 ? "Client Error"
      : code >= 300 ? "Redirect" : code >= 200 ? "Success" : "Informational");
}

export function StatusCodeBadge({ code, showName = true, className }: {
  code: number;
  showName?: boolean;
  className?: string;
}) {
  const cls = Math.floor(code / 100);
  return (
    <span data-slot="status-code-badge" className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
      cls === 2 && "bg-muted text-foreground",
      cls === 3 && "border border-border text-muted-foreground",
      cls === 4 && "border-2 border-foreground font-medium text-foreground",
      cls === 5 && "bg-foreground font-semibold text-background",
      (cls < 2 || cls > 5) && "border border-dashed border-border text-muted-foreground",
      className)}>
      <span className="tabular-nums">{code}</span>
      {showName ? <span className="font-normal">{statusName(code)}</span> : (
        <span className="sr-only">{statusName(code)}</span>
      )}
    </span>
  );
}
