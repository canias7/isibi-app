import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Where an order has got to — and what has NOT happened yet.
 *
 * `order-tracker` SHOWS THE HAPPY PATH as a progress bar. Real orders stall,
 * split, come back and get refunded, and a bar cannot say any of that. This
 * is a timeline where a step can be reached, skipped, failed or still ahead,
 * and the failed one carries what to do about it.
 *
 * FUTURE STEPS ARE HOLLOW AND UNDATED. Putting an estimated date on a step
 * that has not happened is how "arriving Tuesday" becomes a complaint on
 * Wednesday — estimates belong in `delivery-eta`, which is honest about
 * being a range.
 *
 * THE MOST RECENT REAL EVENT IS THE HEADLINE, repeated at the top, because
 * that is the only line most people read.
 */
export type OrderStep = {
  key: string;
  label: React.ReactNode;
  at?: string;
  state: "done" | "current" | "failed" | "ahead" | "skipped";
  detail?: React.ReactNode;
};

export function OrderTimeline({ steps, className }: { steps: OrderStep[]; className?: string }) {
  const latest = [...steps].reverse().find((s) => s.state === "done" || s.state === "current" || s.state === "failed");
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {latest ? (
        <p className="text-sm font-semibold">
          {latest.label}
          {latest.at ? <span className="font-normal text-muted-foreground"> · {latest.at}</span> : null}
        </p>
      ) : null}
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.key} className="flex gap-2.5">
            <span className="flex flex-col items-center">
              <span aria-hidden className={cn("mt-1 size-2.5 shrink-0 rounded-full border",
                s.state === "done" || s.state === "current" ? "border-foreground bg-foreground"
                  : s.state === "failed" ? "border-2 border-foreground bg-background"
                  : s.state === "skipped" ? "border-dashed border-border"
                  : "border-border bg-background")} />
              {i < steps.length - 1 ? (
                <span aria-hidden className={cn("w-px flex-1", s.state === "ahead" ? "bg-border" : "bg-foreground/40")} />
              ) : null}
            </span>
            <span className="pb-3">
              <span className={cn("block text-sm", s.state === "ahead" && "text-muted-foreground",
                s.state === "failed" && "font-medium")}>
                {s.label}
                {s.state === "skipped" ? <span className="text-muted-foreground"> — skipped</span> : null}
              </span>
              {/* Undated while it is still ahead: a date on a future step becomes a complaint. */}
              {s.at && s.state !== "ahead" ? <span className="block text-xs text-muted-foreground">{s.at}</span> : null}
              {s.detail ? <span className="block text-xs">{s.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
