import { cn } from "@/lib/utils";
/**
 * A customer's own domain, with the state it is really in.
 *
 * DNS-OK AND CERTIFICATE-OK ARE SEPARATE STATES. A domain whose records point
 * correctly but whose certificate has not been issued yet serves a browser
 * warning — which looks far worse to a visitor than a domain that plainly does
 * not resolve. Every custom-domain screen collapses these into "pending" and
 * leaves people refreshing.
 *
 * PROPAGATION IS EXPLAINED, because it is the reason a correct configuration
 * still fails for an hour and the single largest source of support contact
 * here. "Correct, waiting to spread" is a state somebody can wait out calmly.
 *
 * IT SHOWS THE CURRENT VALUE ALONGSIDE THE EXPECTED ONE when they disagree.
 * "Wrong record" sends somebody to check; "we see 1.2.3.4, it should be
 * isibi.app" is the fix in one line.
 *
 * `role="status"`, because this changes while somebody is watching it and the
 * change is the thing they are waiting for.
 */
export function CustomDomain({ domain, state, expected, seen, className }: {
  domain: string;
  state: "unconfigured" | "wrong" | "propagating" | "certificate" | "live";
  /** What the record should be. */
  expected?: string;
  /** What we can see right now. */
  seen?: string;
  className?: string;
}) {
  const WORD = {
    unconfigured: "Not set up yet",
    wrong: "Pointing somewhere else",
    propagating: "Correct — waiting for it to spread",
    certificate: "Getting a certificate",
    live: "Live",
  } as const;
  const NOTE = {
    unconfigured: "Add the record below at your domain provider.",
    wrong: "The record exists but does not point at us.",
    propagating: "DNS changes can take up to an hour to reach everywhere. Nothing more to do.",
    certificate: "Visitors may see a security warning until this finishes — usually a few minutes.",
    live: "",
  } as const;
  return (
    <div data-slot="custom-domain" role="status" className={cn("space-y-1 rounded-md border border-border p-3 text-sm", className)}>
      <p>
        <code className="font-mono text-xs">{domain}</code>
        <span className={cn("block", state !== "live" && "font-medium")}>{WORD[state]}</span>
      </p>
      {NOTE[state] && <p className="text-xs text-muted-foreground">{NOTE[state]}</p>}
      {(expected || seen) && state !== "live" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {expected && (<><dt className="text-muted-foreground">Should be</dt><dd><code className="font-mono">{expected}</code></dd></>)}
          {seen && (<><dt className="text-muted-foreground">We see</dt><dd><code className="font-mono">{seen}</code></dd></>)}
        </dl>
      )}
    </div>
  );
}
