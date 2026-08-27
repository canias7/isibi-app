import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
/**
 * The report flow — pick a concrete reason, then send.
 *
 * REASONS ARE CONCRETE CATEGORIES, never a bare "Report". A report that says
 * nothing gives a moderator nothing to act on, so the categories do the work
 * and free text is OPTIONAL — required only for "something else", because
 * that reason says nothing by itself. Nobody owes an essay to report spam.
 *
 * IT SAYS THE REPORTED PERSON IS NOT TOLD WHO REPORTED THEM. Fear of
 * retaliation is the main reason reports do not get made, and the one
 * sentence that answers it costs a line.
 *
 * REPORT IS NOT BLOCK. Reporting asks a moderator to look; blocking is
 * personal and immediate. Conflating them is how people expect one and get
 * the other — if the caller supports blocking, pass `onBlock` and it is
 * offered as the separate thing it is.
 *
 * Submit stays disabled until a reason is picked — an empty report teaches
 * the moderator to ignore reports.
 */
export type ReportReason = { key: string; label: string; meaning?: string; needsDetail?: boolean };

export const DEFAULT_REPORT_REASONS: ReportReason[] = [
  { key: "spam", label: "Spam", meaning: "Adverts, links, repeated posting" },
  { key: "abuse", label: "Harassment or abuse", meaning: "Targets a person" },
  { key: "false", label: "False information", meaning: "Wrong on purpose" },
  { key: "other", label: "Something else", needsDetail: true },
];

export function ReportReasonForm({ what = "this", reasons = DEFAULT_REPORT_REASONS, onSubmit, onCancel, onBlock, className }: {
  what?: string;
  reasons?: ReportReason[];
  onSubmit: (reason: string, detail: string) => void;
  onCancel?: () => void;
  onBlock?: () => void;
  className?: string;
}) {
  const [picked, setPicked] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const chosen = reasons.find((r) => r.key === picked);
  const blocked = !picked || (chosen?.needsDetail && !detail.trim());

  return (
    <form data-slot="report-reason-form"
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}
      onSubmit={(e) => { e.preventDefault(); if (!blocked) onSubmit(picked, detail.trim()); }}
    >
      <p className="text-sm font-medium">Report {what}</p>
      <RadioGroup value={picked} onValueChange={setPicked} className="gap-2">
        {reasons.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-start gap-2.5">
            <RadioGroupItem value={r.key} className="mt-0.5" />
            <span className="text-sm leading-tight">
              {r.label}
              {r.meaning ? <span className="block text-xs text-muted-foreground">{r.meaning}</span> : null}
            </span>
          </label>
        ))}
      </RadioGroup>
      {/* Free text is optional unless the reason says nothing by itself. */}
      {picked ? (
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={chosen?.needsDetail ? "What is wrong with it? (needed for this reason)" : "Anything that helps (optional)"}
          className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={blocked}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          Send report
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
        ) : null}
        {/* Block is the personal, immediate act — a different thing, offered as one. */}
        {onBlock ? (
          <button type="button" onClick={onBlock}
            className="ms-auto cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Just block them instead
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">They are not told who reported them.</p>
    </form>
  );
}
