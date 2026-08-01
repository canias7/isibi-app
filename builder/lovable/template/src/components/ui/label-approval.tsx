import { cn } from "@/lib/utils";
/**
 * A label going through sign-off — with the artwork version pinned to it.
 *
 * AN APPROVAL IS OF A VERSION, NOT OF A LABEL. Artwork changes after sign-off
 * constantly, and an approval that does not name the version it approved is
 * worthless the moment somebody nudges the ingredients box. The version is on
 * every approval line here.
 *
 * WHO CHECKED WHAT IS SEPARATE. Legal checks the claims, production checks the
 * barcode scans, and design checks it looks right — one "approved" tick makes it
 * impossible to know afterwards whether anybody read the ingredients at all.
 *
 * PRINTED QUANTITY IS SHOWN BECAUSE IT IS WHAT A LATE CHANGE COSTS. Forty
 * thousand labels already printed changes the conversation about a comma, and
 * the number is never on the approval screen.
 *
 * NO ARTWORK PREVIEW. A thumbnail small enough to sit in a row is too small to
 * read the small print on, which is exactly where the errors are, and it makes
 * people feel they have checked when they have not.
 */
export type Approval = { id: string; who: string; checks: string; version?: string; approved?: boolean; on?: string };

export function LabelApproval({ product, currentVersion, approvals, printedQuantity, className }: {
  product: string;
  currentVersion: string;
  approvals: Approval[];
  /** What a late change costs. */
  printedQuantity?: number;
  className?: string;
}) {
  const stale = approvals.filter((a) => a.approved && a.version && a.version !== currentVersion);
  const outstanding = approvals.filter((a) => !a.approved);
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{product}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{currentVersion}</span>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {approvals.map((a) => {
          const outOfDate = !!a.approved && !!a.version && a.version !== currentVersion;
          return (
            <li key={a.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {a.who}
                <span className="block text-xs text-muted-foreground">
                  Checks {a.checks}
                  {a.version ? ` · approved ${a.version}` : ""}
                </span>
              </span>
              <span
                className={cn("shrink-0 text-xs", a.approved && !outOfDate ? "text-muted-foreground" : "font-medium")}
              >
                {outOfDate ? "Old version" : a.approved ? (a.on ? `Signed ${a.on}` : "Signed") : "Not signed"}
              </span>
            </li>
          );
        })}
      </ul>
      {stale.length > 0 && (
        <p className="text-xs font-medium">
          {stale.length} {stale.length === 1 ? "approval was" : "approvals were"} given on an earlier version.{" "}
          {stale.length === 1 ? "It does" : "They do"} not carry over to {currentVersion}.
        </p>
      )}
      {outstanding.length > 0 && (
        <p className="text-xs font-medium">
          Still to sign: {outstanding.map((a) => a.who).join(", ")}.
        </p>
      )}
      {printedQuantity !== undefined && printedQuantity > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {printedQuantity.toLocaleString()} already printed. Any change from here means reprinting them.
        </p>
      )}
    </div>
  );
}
