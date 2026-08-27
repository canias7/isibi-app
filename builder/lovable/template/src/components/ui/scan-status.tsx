import { cn } from "@/lib/utils";
/**
 * Whether an uploaded file has been checked yet.
 *
 * PENDING IS NOT SAFE AND MUST NOT LOOK SAFE. A file that has been uploaded but
 * not scanned is the state most implementations render identically to a clean
 * one, and it is the state in which somebody downloads the thing the scan would
 * have caught.
 *
 * A BLOCKED FILE STAYS LISTED, with the reason. Removing it silently makes an
 * uploader think the upload failed, and they try again — usually several times,
 * with the same file.
 *
 * All four states are words. A shield icon in three colours is exactly the
 * pattern that says nothing in greyscale and nothing to a screen reader, on the
 * one row where being wrong matters most.
 */
export function ScanStatus({ state, reason, className }: {
  state: "pending" | "clean" | "blocked" | "skipped";
  /** Why it was blocked or skipped. */
  reason?: string;
  className?: string;
}) {
  const WORD = {
    pending: "Not checked yet",
    clean: "Checked",
    blocked: "Blocked",
    skipped: "Not checked",
  } as const;
  const loud = state === "blocked" || state === "pending";
  return (
    <p data-slot="scan-status" role="status" className={cn("text-xs", loud ? "font-medium" : "text-muted-foreground", className)}>
      {WORD[state]}
      {reason && <span className="font-normal text-muted-foreground"> — {reason}</span>}
    </p>
  );
}
