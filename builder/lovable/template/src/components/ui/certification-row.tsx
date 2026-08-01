import { cn } from "@/lib/utils";
/**
 * One certification a business holds — and its scope, which is the catch.
 *
 * SCOPE IS THE FIELD THAT MATTERS AND IS ALWAYS DROPPED. An ISO certificate
 * covers named activities at named sites, not the whole company — so "we are
 * ISO 27001 certified" is routinely broader than the certificate says, and the
 * scope line is what makes the claim honest.
 *
 * THE CERTIFYING BODY IS NAMED, because a certificate is only as good as who
 * issued it, and self-declared conformity is a different thing from an audited
 * one wearing the same standard's name.
 *
 * SUSPENDED IS A STATE. A certificate can be suspended pending a corrective
 * action while still being within its dates — it is not expired and it is not
 * valid, and a two-state display has to call it one of those.
 *
 * A `<li>` composing into a list, like `credential-row` — this is the business
 * equivalent of that one and deliberately shares its shape.
 */
export function CertificationRow({ standard, scope, body, reference, state = "valid", validUntil, className }: {
  /** "ISO 27001". */
  standard: string;
  /** What it actually covers. */
  scope?: string;
  /** Who issued it. */
  body?: string;
  reference?: string;
  state?: "valid" | "suspended" | "expired" | "self-declared";
  /** Free text — "March 2027". */
  validUntil?: string;
  className?: string;
}) {
  const WORD = {
    valid: "Certified",
    suspended: "Suspended",
    expired: "Expired",
    "self-declared": "Self-declared",
  } as const;
  const weak = state !== "valid";
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className={cn("block", state === "expired" && "text-muted-foreground")}>{standard}</span>
        {scope && <span className="block text-xs">Covers {scope}</span>}
        <span className="block text-xs text-muted-foreground">
          {body}
          {body && reference ? " · " : ""}
          {reference && <span>ref {reference}</span>}
          {(body || reference) && validUntil ? " · " : ""}
          {validUntil && <span>until {validUntil}</span>}
        </span>
        {!scope && <span className="block text-xs text-muted-foreground">Scope not recorded</span>}
      </span>
      <span className={cn("shrink-0 text-xs", weak ? "font-medium" : "text-muted-foreground")}>
        {WORD[state]}
      </span>
    </li>
  );
}
