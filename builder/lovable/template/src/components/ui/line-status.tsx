import { cn } from "@/lib/utils";
/**
 * Whether the connection is working — answered before anything else is shown.
 *
 * THE FIRST LINE ANSWERS "IS IT ME OR IS IT YOU". That is the only question
 * somebody has when they load this page, and the usual layout makes them read
 * past a diagram, a speed graph and four green ticks to find out. A known fault
 * in the area is stated at the top, in a sentence.
 *
 * AN ESTIMATED FIX TIME IS SHOWN ONLY WHEN THERE IS ONE. "Estimated restoration:
 * TBC" is worse than silence — it looks like information and is not. When there
 * is no estimate the component says nobody has given one, which is the honest
 * and more useful sentence.
 *
 * SPEED IS SHOWN AGAINST WHAT WAS SOLD, not on its own. 38 Mbps means nothing;
 * 38 against a promised 67 is a complaint, and against a promised 35 is fine.
 *
 * NO SIGNAL BARS. Bars are a scale nobody defines, they differ between vendors,
 * and they are unreadable to anybody who cannot compare small shapes by height.
 */
export function LineStatus({ up, knownFault, faultNote, estimatedFixAt, downloadMbps, uploadMbps, promisedDownloadMbps, since, className }: {
  up?: boolean;
  /** A fault in the area, not on this line. */
  knownFault?: boolean;
  faultNote?: string;
  /** Only shown when there really is one. */
  estimatedFixAt?: string;
  downloadMbps?: number;
  uploadMbps?: number;
  /** What was sold. Without it a speed says nothing. */
  promisedDownloadMbps?: number;
  /** How long it has been in this state. */
  since?: string;
  className?: string;
}) {
  const slow =
    downloadMbps !== undefined &&
    promisedDownloadMbps !== undefined &&
    downloadMbps < promisedDownloadMbps * 0.7;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium">
        {knownFault
          ? "There is a fault in your area. It is not something at your end."
          : up === false
            ? "Your line is down."
            : "Your line is working."}
        {since ? ` (${since})` : ""}
      </p>
      {knownFault && faultNote && <p className="text-xs">{faultNote}</p>}
      {(knownFault || up === false) && (
        <p className="text-xs text-muted-foreground">
          {estimatedFixAt
            ? `Expected back by ${estimatedFixAt}.`
            : "Nobody has given a time for it yet. We will say when there is one rather than putting a guess here."}
        </p>
      )}
      {downloadMbps !== undefined && (
        <p className={cn("text-xs tabular-nums", slow ? "font-medium" : "text-muted-foreground")}>
          {downloadMbps} Mbps down
          {uploadMbps !== undefined ? `, ${uploadMbps} up` : ""}
          {promisedDownloadMbps !== undefined ? ` — you were sold ${promisedDownloadMbps}` : ""}
          {slow ? ". That is far enough below to be worth raising." : "."}
        </p>
      )}
    </div>
  );
}
