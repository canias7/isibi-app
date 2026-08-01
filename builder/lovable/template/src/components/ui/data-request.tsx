import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Asking for a copy of your data, or for it to be deleted, and seeing where
 * the request got to.
 *
 * THE STATE MACHINE IS THE COMPONENT. These requests take days, and the version
 * that ships everywhere is a button that fires and then shows nothing — so
 * somebody who is worried enough to ask presses it again, and again, and emails
 * support. Pending, ready and done are all visible here.
 *
 * IT STATES A DEADLINE where the caller has one. "We will reply within 30 days"
 * is what turns silence from alarming into expected, and it is usually a
 * promise the business has already made in writing somewhere nobody reads.
 *
 * A PENDING REQUEST BLOCKS A SECOND ONE, with the reason. Two identical
 * requests in a queue is work for a human and confusion for the reader; the
 * button says why it is disabled rather than being mysteriously grey.
 *
 * DOWNLOAD IS A PLAIN LINK once ready — no interstitial, no second
 * confirmation. Retrieving your own data should be the easy half.
 */
export function DataRequest({ kind, state, requestedAt, dueBy, downloadUrl, onRequest, busy, className }: {
  kind: "copy" | "delete";
  state: "none" | "pending" | "ready" | "done";
  /** Free text — "29 July". */
  requestedAt?: string;
  /** Free text — "within 30 days". */
  dueBy?: string;
  downloadUrl?: string;
  onRequest: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const title = kind === "copy" ? "A copy of your data" : "Delete your data";
  const cta = kind === "copy" ? "Request a copy" : "Request deletion";
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">{title}</p>
      {state === "pending" && (
        <p className="text-sm">
          Requested{requestedAt ? ` on ${requestedAt}` : ""}.
          <span className="text-muted-foreground">{dueBy ? ` We will reply ${dueBy}.` : " We are working on it."}</span>
        </p>
      )}
      {state === "ready" && kind === "copy" && (
        <p className="text-sm">
          Your copy is ready.{" "}
          {downloadUrl && <a href={downloadUrl} className="underline underline-offset-2">Download it</a>}
        </p>
      )}
      {state === "done" && (
        <p className="text-sm text-muted-foreground">
          {kind === "copy" ? "This request is complete." : "Your data has been deleted."}
        </p>
      )}
      {state === "none" && (
        <>
          {kind === "delete" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 accent-foreground" />
              <span>I understand this cannot be undone.</span>
            </label>
          )}
          <Button type="button" size="sm" onClick={onRequest}
            disabled={busy || (kind === "delete" && !confirmed)}>
            {cta}
          </Button>
        </>
      )}
      {state === "pending" && (
        <p className="text-xs text-muted-foreground">You cannot make another request until this one is finished.</p>
      )}
    </div>
  );
}
