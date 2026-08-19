import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Why it is going back — and the reason changes what happens next.
 *
 * "FAULTY" AND "CHANGED MY MIND" ARE DIFFERENT TRANSACTIONS. One is free to
 * return with rights that outlast the window, the other may cost postage and
 * may not. Showing the same flat list and the same outcome is how shops
 * charge people for their own mistakes — so each reason states its
 * consequence right there, before it is chosen.
 *
 * A PHOTO IS ASKED FOR ONLY WHERE IT HELPS. Demanding one for change-of-mind
 * is friction with no purpose; for damaged or wrong-item it settles the
 * claim without a conversation.
 *
 * FREE TEXT IS OPTIONAL EXCEPT FOR "SOMETHING ELSE" — the report-reason rule,
 * because that option says nothing on its own.
 */
export type ReturnReasonOption = {
  key: string;
  label: string;
  outcome: string;
  wantsPhoto?: boolean;
  needsDetail?: boolean;
};

export const RETURN_REASONS: ReturnReasonOption[] = [
  { key: "faulty", label: "Faulty or damaged", outcome: "Free return, full refund — postage is on us.", wantsPhoto: true },
  { key: "wrong", label: "Not what I ordered", outcome: "Free return, full refund — postage is on us.", wantsPhoto: true },
  { key: "fit", label: "Does not fit", outcome: "Return postage is deducted from the refund." },
  { key: "mind", label: "Changed my mind", outcome: "Return postage is deducted from the refund." },
  { key: "other", label: "Something else", outcome: "We will read it and come back to you.", needsDetail: true },
];

export function ReturnReason({ reasons = RETURN_REASONS, value, detail, onChange, onPhoto, className }: {
  reasons?: ReturnReasonOption[];
  value?: string;
  detail: string;
  onChange: (v: { value: string; detail: string }) => void;
  onPhoto?: (file: File) => void;
  className?: string;
}) {
  const chosen = reasons.find((r) => r.key === value);
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="text-sm font-medium">Why are you sending it back?</legend>
      {reasons.map((r) => (
        <label key={r.key} className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" name="return-reason" checked={value === r.key}
            onChange={() => onChange({ value: r.key, detail })}
            className="mt-0.5 size-3.5 cursor-pointer accent-foreground" />
          <span>
            {r.label}
            {/* The consequence, before the choice - not after it. */}
            <span className="block text-xs text-muted-foreground">{r.outcome}</span>
          </span>
        </label>
      ))}
      {chosen ? (
        <div className="flex flex-col gap-1.5 ps-6">
          <textarea value={detail} rows={2}
            onChange={(e) => onChange({ value: chosen.key, detail: e.target.value })}
            placeholder={chosen.needsDetail ? "What happened? (needed for this reason)" : "Anything that helps (optional)"}
            className="resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {chosen.wantsPhoto && onPhoto ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="file" accept="image/*" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
              <span className="rounded-md border border-border px-2 py-1">Add a photo</span>
              <span className="text-muted-foreground">Settles it without a conversation.</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
