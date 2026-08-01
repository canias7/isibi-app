import { cn } from "@/lib/utils";
/**
 * Something is wrong with a batch — what was decided, and what stopped it
 * happening again.
 *
 * DISPOSITION AND ROOT CAUSE ARE DIFFERENT QUESTIONS AND BOTH ARE ASKED. What
 * happens to these parts (scrap, rework, use as-is, return) is today's
 * decision; why it happened is next month's. A record capturing only the first
 * is a scrapping log, and the same fault comes back.
 *
 * "USE AS-IS" REQUIRES A NAMED APPROVER. It is the disposition that ships a
 * known-defective part to a customer, it is sometimes exactly right, and it is
 * the one that must never be anonymous.
 *
 * THE QUANTITY AFFECTED IS SEPARATE FROM THE QUANTITY INSPECTED. Ten bad out of
 * twelve checked in a batch of 4,000 is an unanswered question about the other
 * 3,988, and a single count hides it.
 *
 * THE CORRECTIVE ACTION IS SHOWN WITH ITS OWN STATE, because an action recorded
 * and never done is the ordinary outcome and looks identical to one completed.
 */
export type Disposition = "scrap" | "rework" | "use-as-is" | "return" | "undecided";

const WORDS: Record<Disposition, string> = {
  scrap: "Scrap",
  rework: "Rework",
  "use-as-is": "Use as-is",
  return: "Return to supplier",
  undecided: "Not yet decided",
};

export function Nonconformance({ reference, item, problem, inspected, affected, batchSize, disposition = "undecided", approvedBy, rootCause, correctiveAction, actionDone, className }: {
  reference?: string;
  item: string;
  problem: string;
  /** How many were checked. */
  inspected?: number;
  /** How many of those were bad. */
  affected?: number;
  /** How many are in the batch altogether. */
  batchSize?: number;
  disposition?: Disposition;
  approvedBy?: string;
  rootCause?: string;
  correctiveAction?: string;
  actionDone?: boolean;
  className?: string;
}) {
  const unchecked = batchSize !== undefined && inspected !== undefined ? batchSize - inspected : undefined;
  const needsApproval = disposition === "use-as-is" && !approvedBy;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{item}</span>
        {reference && <span className="block font-mono text-xs text-muted-foreground">{reference}</span>}
      </p>
      <p className="text-xs">{problem}</p>
      {(inspected !== undefined || affected !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {affected !== undefined && inspected !== undefined
            ? `${affected} bad of ${inspected} checked`
            : affected !== undefined
              ? `${affected} affected`
              : `${inspected} checked`}
          {batchSize !== undefined && ` · batch of ${batchSize}`}
        </p>
      )}
      {unchecked !== undefined && unchecked > 0 && (
        <p className="text-xs font-medium tabular-nums">{unchecked} in the batch have not been checked.</p>
      )}
      <p className={cn("text-xs", disposition === "undecided" || needsApproval ? "font-medium" : "")}>
        {WORDS[disposition]}
        {approvedBy && <span className="font-normal text-muted-foreground"> · approved by {approvedBy}</span>}
      </p>
      {needsApproval && (
        <p className="text-xs font-medium">Shipping a known defect needs a named approver.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {rootCause ? `Cause: ${rootCause}` : "No root cause recorded — this will happen again."}
      </p>
      {correctiveAction && (
        <p className={cn("text-xs", actionDone ? "text-muted-foreground" : "font-medium")}>
          {correctiveAction} — {actionDone ? "done" : "not done yet"}
        </p>
      )}
    </div>
  );
}
