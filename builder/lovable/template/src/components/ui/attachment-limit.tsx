import { cn } from "@/lib/utils";
/**
 * How many files and how much room is left before uploading is refused.
 *
 * BOTH LIMITS AT ONCE, because a set of rules that only mentions the count lets
 * somebody add nine small files and then be refused on the tenth for total
 * size — an error that appears to contradict the stated rule. Whichever is
 * closer decides the sentence.
 *
 * SIZES ARE FORMATTED IN THE UNIT PEOPLE THINK IN. "8,912,896 bytes remaining"
 * is not a number anybody can weigh a photo against; "8.5 MB left" is.
 *
 * IT SAYS THE PER-FILE LIMIT SEPARATELY, since it is the one that surprises
 * people — plenty of room left in total and a single video still refused. That
 * is the rejection people report as a bug.
 *
 * IT GOES QUIET UNTIL IT MATTERS. Room stated on every form is noise; it speaks
 * up as the allowance runs down, which is the same discipline as
 * `ai-limit-note` and `slot-capacity`.
 */
function mb(bytes: number) {
  const v = bytes / 1_000_000;
  return v >= 10 ? `${Math.round(v)} MB` : `${v.toFixed(1)} MB`;
}

export function AttachmentLimit({ usedCount, maxCount, usedBytes, maxBytes, perFileBytes, warnAt = 0.7, className }: {
  usedCount: number;
  maxCount?: number;
  usedBytes?: number;
  maxBytes?: number;
  /** Largest single file allowed. */
  perFileBytes?: number;
  /** Fraction of either allowance at which it speaks up. */
  warnAt?: number;
  className?: string;
}) {
  const countShare = maxCount ? usedCount / maxCount : 0;
  const byteShare = maxBytes && usedBytes !== undefined ? usedBytes / maxBytes : 0;
  const share = Math.max(countShare, byteShare);
  const full = share >= 1;
  if (share < warnAt && !perFileBytes) return null;
  const filesLeft = maxCount ? Math.max(0, maxCount - usedCount) : null;
  const bytesLeft = maxBytes && usedBytes !== undefined ? Math.max(0, maxBytes - usedBytes) : null;
  return (
    <p className={cn("flex flex-wrap gap-x-3 gap-y-0.5 text-xs", full ? "text-foreground" : "text-muted-foreground", className)}>
      {share >= warnAt && (
        <span className={cn(full && "font-medium")}>
          {full ? "No room left"
            : filesLeft !== null && countShare >= byteShare
              ? `${filesLeft} more ${filesLeft === 1 ? "file" : "files"}`
              : bytesLeft !== null ? `${mb(bytesLeft)} left` : ""}
        </span>
      )}
      {perFileBytes && <span>Up to {mb(perFileBytes)} per file</span>}
    </p>
  );
}
