import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A discount code box that says WHY a code did not work.
 *
 * "INVALID CODE" IS THE WORST MESSAGE IN CHECKOUT. Expired, wrong products,
 * under the minimum, already used and not-a-code are five different problems
 * with five different next steps, and collapsing them into one string sends
 * people to support. `check` returns a reason and the reason is shown.
 *
 * AN APPLIED CODE IS REMOVABLE and states what it took off — a discount you
 * cannot see the size of is one nobody trusts.
 *
 * CODES ARE UPPERCASED AND TRIMMED on the way in, because they are read off
 * emails and printed cards, and a trailing space failing silently is the
 * single most common false rejection.
 */
export function PromoField({ applied, onApply, onRemove, currency = "GBP", className }: {
  applied?: { code: string; offMinor: number } | null;
  onApply: (code: string) => Promise<{ ok: boolean; reason?: string }>;
  onRemove?: () => void;
  currency?: string;
  className?: string;
}) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState<string | null>(null);
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);

  if (applied) {
    return (
      <p className={cn("flex flex-wrap items-baseline gap-2 text-sm", className)}>
        <span><b>{applied.code}</b> applied — <span className="tabular-nums">−{fmt(applied.offMinor)}</span></span>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Remove
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <form className={cn("flex flex-col gap-1", className)}
      onSubmit={async (e) => {
        e.preventDefault();
        // Read off an email or a card: trailing spaces and case must not fail.
        const clean = code.trim().toUpperCase();
        if (!clean) return;
        setBusy(true);
        const res = await onApply(clean);
        setBusy(false);
        setReason(res.ok ? null : res.reason ?? "That code did not work.");
        if (res.ok) setCode("");
      }}>
      <div className="flex gap-1.5">
        <input value={code} onChange={(e) => { setCode(e.target.value); setReason(null); }}
          placeholder="Discount code" aria-label="Discount code"
          className="h-9 w-40 rounded-md border border-input bg-background px-2.5 text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <button type="submit" disabled={busy || !code.trim()}
          className="cursor-pointer rounded-md border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Checking…" : "Apply"}
        </button>
      </div>
      {reason ? <p className="text-xs font-medium">{reason}</p> : null}
    </form>
  );
}
