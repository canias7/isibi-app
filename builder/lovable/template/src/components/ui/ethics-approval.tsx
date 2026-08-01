import { cn } from "@/lib/utils";
/**
 * The approval a study runs under — with its expiry and its amendments.
 *
 * APPROVAL EXPIRES AND THE EXPIRY IS THE HEADLINE. Work done after it lapses is
 * unapproved research, which cannot be published and in many jurisdictions
 * cannot lawfully have happened — and it lapses silently while everybody is
 * busy doing the study.
 *
 * THE APPROVED PROTOCOL VERSION IS SHOWN AGAINST THE CURRENT ONE. Running an
 * amended protocol before its amendment is approved is the most common serious
 * breach, and it happens because the amendment feels minor to the team making
 * it.
 *
 * CONDITIONS OF APPROVAL ARE LISTED. Committees approve subject to conditions —
 * a change to a consent form, a data-sharing restriction — and those conditions
 * are part of the approval rather than advice.
 *
 * THE COMMITTEE AND THE REFERENCE ARE SHOWN because every subsequent
 * correspondence, publication and audit is keyed to them.
 */
export function EthicsApproval({ committee, reference, approvedOn, expiresOn, expired, approvedVersion, currentVersion, conditions = [], amendmentsPending, className }: {
  committee: string;
  reference?: string;
  /** Free text — "14 March 2026". */
  approvedOn?: string;
  expiresOn?: string;
  expired?: boolean;
  /** The protocol version the committee approved. */
  approvedVersion?: string;
  /** What the team is actually running. */
  currentVersion?: string;
  conditions?: string[];
  /** Amendments submitted and not yet approved. */
  amendmentsPending?: number;
  className?: string;
}) {
  const drifted = approvedVersion !== undefined && currentVersion !== undefined && approvedVersion !== currentVersion;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(expired && "font-medium")}>
        {expired
          ? `Approval expired${expiresOn ? ` on ${expiresOn}` : ""} — work done since is unapproved.`
          : expiresOn
            ? `Approved until ${expiresOn}`
            : "Approved, with no expiry recorded"}
      </p>
      <p className="text-xs text-muted-foreground">
        {committee}
        {reference && ` · ${reference}`}
        {approvedOn && ` · approved ${approvedOn}`}
      </p>
      {drifted && (
        <p className="text-xs font-medium">
          Approved for protocol {approvedVersion}; the team is running {currentVersion}. That difference needs approving before it is used.
        </p>
      )}
      {amendmentsPending !== undefined && amendmentsPending > 0 && (
        <p className="text-xs tabular-nums">
          {amendmentsPending} {amendmentsPending === 1 ? "amendment is" : "amendments are"} awaiting approval — do not implement them yet.
        </p>
      )}
      {conditions.length > 0 && (
        <div className="space-y-0.5 pt-0.5">
          <p className="text-xs">Approved subject to:</p>
          <ul className="text-xs text-muted-foreground">
            {conditions.map((c, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
