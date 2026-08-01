import { cn } from "@/lib/utils";
/**
 * Which revision of a drawing this is — and whether it is the current one.
 *
 * BUILDING FROM A SUPERSEDED DRAWING IS THE EXPENSIVE MISTAKE. It happens
 * because revision C and revision D look identical on a phone screen, and
 * nothing on the sheet shouts. This states the status before anybody starts
 * setting out.
 *
 * "WHAT CHANGED" IS ON THE ROW. A revision note saying "windows moved 300mm
 * east" is the difference between rechecking one wall and rechecking a floor —
 * and it is written on the drawing where nobody looks.
 *
 * THE ISSUE PURPOSE IS SHOWN, because a drawing issued for comment and one
 * issued for construction are different documents with the same number, and
 * building from the first is a defect by definition.
 *
 * SUPERSEDED GETS AN ALERT, not a muted style. Somebody looking at this on site
 * is about to cut something.
 */
export function DrawingRevision({ number, revision, status, issuedFor, changed, supersededBy, date, className }: {
  /** Drawing number. */
  number: string;
  revision: string;
  status: "current" | "superseded" | "draft";
  /** "construction", "comment", "tender". */
  issuedFor?: string;
  /** What is different from the last one. */
  changed?: string;
  /** The revision that replaced it. */
  supersededBy?: string;
  /** Free text — "14 July 2026". */
  date?: string;
  className?: string;
}) {
  const old = status === "superseded";
  return (
    <div {...(old ? { role: "alert" as const } : {})}
      className={cn("space-y-0.5 rounded-md border px-3 py-2 text-sm",
        old ? "border-foreground/40 bg-muted/40" : "border-border", className)}>
      <p>
        <code className="font-mono text-xs">{number}</code>
        <span className="font-medium"> Rev {revision}</span>
        {issuedFor && <span className="text-muted-foreground"> · issued for {issuedFor}</span>}
        {date && <span className="text-muted-foreground"> · {date}</span>}
      </p>
      <p className={cn("text-xs", old ? "font-medium" : "text-muted-foreground")}>
        {old
          ? <>Do not build from this{supersededBy ? ` — Rev ${supersededBy} replaced it` : " — it has been superseded"}.</>
          : status === "draft"
            ? "Draft — not issued for construction."
            : "This is the current revision."}
      </p>
      {changed && <p className="text-xs text-muted-foreground">Changed: {changed}</p>}
    </div>
  );
}
