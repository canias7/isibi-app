import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Recent sign-ins and attempts, with the one number that actually means
 * something at the top.
 *
 * SEPARATE SOURCES, not the failure count. Twenty-three failures from one
 * source is somebody who has forgotten their password; twenty-three from six
 * sources is not, and it is the difference between "ignore this" and "change
 * your password now". A screen reporting only the total makes the reader do
 * that arithmetic themselves, from a list they have to scroll.
 *
 * A KNOWN member is named. A stranger is a stable tag like `unknown·7f3a1c`
 * and never their address — an owner's real need on a failed sign-in is "the
 * same unknown address, forty times", which a per-site fingerprint answers
 * completely, and storing the address would turn every mistyped login into a
 * contact list of people who never had an account to consent with. The footnote
 * SAYS the tag is deliberate, or it reads as a bug.
 *
 * An attempt that stopped at the second factor is neither a sign-in nor a
 * failure and is shown as its own thing. Counted as a sign-in it says somebody
 * got in who did not; counted as nothing, a thief who had the password leaves
 * no trace at all.
 */
export function LoginHistory({
  events, signIns, failures, sources, blocked, className,
}: {
  events: { id: string; kind: "login" | "failed" | "2fa_required" | "blocked"; who?: React.ReactNode; tag?: string; device?: React.ReactNode; country?: React.ReactNode; at: React.ReactNode }[];
  signIns?: number;
  failures?: number;
  sources?: number;
  blocked?: number;
  className?: string;
}) {
  const anon = events.some((e) => !e.who && e.tag);
  const words: Record<string, string> = {
    login: "Signed in", failed: "Wrong password",
    "2fa_required": "Password correct, stopped at the second step", blocked: "Refused",
  };
  const stat = (n: number | undefined, label: string) => (
    <div>
      <p className="text-lg font-semibold tabular-nums">{n == null ? "—" : n.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stat(signIns, "sign-ins")}
        {stat(failures, "failed attempts")}
        {stat(sources, "separate sources")}
        {stat(blocked, "refused")}
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {events.length === 0 ? (
          <li className="p-4 text-center text-sm text-muted-foreground">Nothing recorded yet.</li>
        ) : events.map((e) => (
          <li key={e.id} className="flex items-baseline gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className={cn(e.kind === "login" ? "font-medium" : undefined)}>{words[e.kind]}</span>
                {" — "}
                {e.who ?? <code className="text-xs text-muted-foreground">{e.tag}</code>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[e.device, e.country].filter(Boolean).map((x, i) => <React.Fragment key={i}>{i ? " · " : ""}{x}</React.Fragment>)}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{e.at}</span>
          </li>
        ))}
      </ul>
      {anon ? (
        <p className="text-xs text-muted-foreground">
          Attempts from people without an account here show a tag rather than an address. The same tag is the
          same person, so forty of one tag and forty different tags mean different things.
        </p>
      ) : null}
    </div>
  );
}
