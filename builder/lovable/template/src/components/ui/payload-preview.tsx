import { cn } from "@/lib/utils";
/**
 * The JSON an event will send, with secrets already removed.
 *
 * REDACTION HAPPENS HERE, BY KEY NAME. A payload preview is the most likely
 * place in any product for a token or a card number to be screenshotted into a
 * support ticket — and the caller reaching for `JSON.stringify` will not think
 * of it. The default key list catches the usual suspects and the caller can add
 * more.
 *
 * REDACTED KEYS ARE SHOWN AS PRESENT-BUT-HIDDEN, not removed. A missing key
 * changes the shape of the example, and somebody building against it writes
 * code for a payload that does not exist.
 *
 * IT IS A `<pre>` WITH A SCROLL CONTAINER, because a wide JSON line must not
 * make the whole page scroll sideways — the rule the rest of this kit follows
 * for tables and code.
 *
 * DEPTH IS NOT LIMITED but the caller can pass a sample. Truncating nested
 * objects produces a preview that lies about the structure, which is the one
 * thing a payload example must not do.
 */
const DEFAULT_SECRETS = ["password", "secret", "token", "authorization", "api_key", "apikey", "card", "cvv", "pan"];

function redact(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, keys));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keys.some((s) => k.toLowerCase().includes(s)) ? "«hidden»" : redact(v, keys);
    }
    return out;
  }
  return value;
}

export function PayloadPreview({ payload, secretKeys = [], label = "What we will send", className }: {
  payload: unknown;
  /** Extra key fragments to hide, on top of the built-in list. */
  secretKeys?: string[];
  label?: string;
  className?: string;
}) {
  const keys = [...DEFAULT_SECRETS, ...secretKeys.map((k) => k.toLowerCase())];
  const safe = redact(payload, keys);
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-2.5">
        <pre className="font-mono text-xs">{JSON.stringify(safe, null, 2)}</pre>
      </div>
      <p className="text-xs text-muted-foreground">Anything sensitive is hidden here but sent in full.</p>
    </div>
  );
}
