import * as React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "1.2K watching" — a live count.
 *
 * It ROUNDS above a thousand. A counter reading 1,247 then 1,251 then 1,249
 * makes the page feel like it is twitching, and nobody has ever needed the last
 * two digits of an audience. `Intl.NumberFormat` with `compact` notation does
 * it in the reader's own locale — 1.2K in English, 1,2 k in French, 1.2万 in
 * Japanese — which a hand-written `k` suffix gets wrong everywhere else.
 *
 * Below a threshold it prints the EXACT number, because at small counts the
 * exact figure is the interesting part: "3 watching" and "8 watching" are
 * meaningfully different and both round to nothing.
 *
 * It is `aria-live="off"` by default. A number that changes every few seconds
 * announced each time makes the rest of the page unlistenable — this is ambient
 * information, and the one place it is worth interrupting for is nowhere.
 */
export function formatCount(n: number, exactBelow = 1000, locale?: string) {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < exactBelow) return n.toLocaleString(locale);
  try {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString(locale);
  }
}

export function ViewerCount({ count, verb = "watching", icon = true, exactBelow, className }: {
  count: number;
  verb?: string;
  icon?: boolean;
  exactBelow?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {icon ? <Eye aria-hidden className="size-3.5" /> : null}
      <span className="tabular-nums">{formatCount(count, exactBelow)}</span>
      <span>{verb}</span>
    </span>
  );
}
