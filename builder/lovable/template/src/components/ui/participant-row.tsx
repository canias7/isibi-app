import { cn } from "@/lib/utils";
/**
 * A participant, identified by code — never by name.
 *
 * THE COMPONENT TAKES NO NAME FIELD AT ALL, and that is a deliberate refusal
 * rather than an omission. A study screen showing names is a re-identification
 * risk in every shoulder-surf, screenshot and support ticket, and the reliable
 * way to prevent it is to make the value impossible to pass in.
 *
 * CONSENT IS SHOWN WITH ITS VERSION. Studies re-consent when a protocol
 * changes, and a participant consented under version 2 of a protocol now on
 * version 4 has not agreed to what is currently being done to them.
 *
 * WITHDRAWAL DISTINGUISHES FUTURE PARTICIPATION FROM DATA ALREADY COLLECTED.
 * They are separate choices with separate legal answers, and collapsing them
 * either deletes data that may lawfully be kept or keeps data that must go.
 *
 * THE NEXT VISIT IS SHOWN WITH ITS WINDOW. Protocol visits have permitted
 * ranges, and a visit outside its window is a deviation that has to be reported
 * — which is much cheaper to prevent than to document.
 */
export function ParticipantRow({ code, arm, consentVersion, protocolVersion, nextVisit, visitWindow, withdrawn, dataRetained, deviations, className }: {
  /** The study code. There is deliberately no name prop. */
  code: string;
  arm?: string;
  /** Which version they consented to. */
  consentVersion?: string;
  /** Which version is current. */
  protocolVersion?: string;
  /** Free text — "14 August". */
  nextVisit?: string;
  /** "±7 days". */
  visitWindow?: string;
  withdrawn?: boolean;
  /** Whether data already collected may be kept. */
  dataRetained?: boolean;
  deviations?: number;
  className?: string;
}) {
  const stale = consentVersion !== undefined && protocolVersion !== undefined && consentVersion !== protocolVersion;
  return (
    <li data-slot="participant-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          <code className="font-mono">{code}</code>
          {arm && <span className="text-muted-foreground"> · {arm}</span>}
        </span>
        {!withdrawn && nextVisit && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            Next {nextVisit}{visitWindow ? ` (${visitWindow})` : ""}
          </span>
        )}
      </p>
      {withdrawn ? (
        <p className="text-xs">
          Withdrawn from further participation.
          {dataRetained === undefined
            ? " Whether their existing data may be kept has not been recorded."
            : dataRetained
              ? " Data already collected is retained, as agreed."
              : " Data already collected must be removed."}
        </p>
      ) : null}
      {consentVersion && (
        <p className={cn("text-xs", stale ? "font-medium" : "text-muted-foreground")}>
          Consented to protocol {consentVersion}
          {stale && ` — the study is now on ${protocolVersion}, so they need re-consenting`}
        </p>
      )}
      {deviations !== undefined && deviations > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {deviations} protocol {deviations === 1 ? "deviation" : "deviations"} recorded.
        </p>
      )}
    </li>
  );
}
