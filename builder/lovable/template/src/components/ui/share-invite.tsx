import * as React from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Inviting people to a document, by address or by link.
 *
 * THE LINK'S ACCESS LEVEL IS STATED NEXT TO THE COPY BUTTON, always. "Anyone
 * with the link can EDIT" is a very different thing from "can view", and the
 * commonest sharing accident is copying a link without noticing which one it
 * is. It is not a setting hidden behind a menu.
 *
 * ADDRESSES ARE ADDED AS CHIPS BEFORE SENDING, so several can go at once and a
 * typo can be removed rather than sent. A field that invites on Enter and
 * clears has already emailed a stranger by the time the mistake is spotted.
 *
 * NOTHING IS SENT UNTIL THE BUTTON IS PRESSED. Auto-inviting as each chip is
 * added means there is no moment at which the list can be checked.
 *
 * The role chosen for new invitees is shown on the button — "Invite 2 as
 * viewers" — because that is the last thing read before an irreversible send.
 *
 * A role carries a NOUN and a VERB, because the two sentences it appears in
 * need different words: "Invite 2 as viewers" and "Anyone with the link can
 * view". Using the label for both produced "Anyone with the link can viewer",
 * which is what it rendered as before somebody read it.
 */
export function ShareInvite({
  emails, onEmails, role, onRole, roles, linkAccess, linkUrl, onLinkAccess, onInvite, busy, className,
}: {
  emails: string[];
  onEmails: (next: string[]) => void;
  role: string;
  onRole: (role: string) => void;
  roles: { key: string; label: string; verb?: string }[];
  linkAccess?: string;
  linkUrl?: string;
  onLinkAccess?: (key: string) => void;
  onInvite?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const roleLabel = roles.find((r) => r.key === role)?.label ?? role;

  const add = () => {
    const t = draft.trim().replace(/,$/, "");
    if (!t || emails.includes(t)) { setDraft(""); return; }
    onEmails([...emails, t]);
    setDraft("");
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border p-1.5 focus-within:border-ring">
        {emails.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2 text-xs">
            {e}
            <button type="button" onClick={() => onEmails(emails.filter((x) => x !== e))}
              aria-label={`Remove ${e}`}
              className="cursor-pointer rounded-full px-1 text-muted-foreground hover:text-foreground">&times;</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !draft && emails.length) onEmails(emails.slice(0, -1));
          }}
          onBlur={add}
          type="email"
          autoComplete="off"
          placeholder={emails.length ? "" : "Email addresses"}
          aria-label="Email addresses"
          className="h-7 min-w-40 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="share-role" className="sr-only">Role for new people</label>
        <select id="share-role" value={role} onChange={(e) => onRole(e.target.value)}
          className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs">
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <button type="button" onClick={onInvite} disabled={emails.length === 0 || busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          {busy ? "Sending…" : `Invite ${emails.length || ""} as ${roleLabel.toLowerCase()}${emails.length === 1 ? "" : "s"}`.replace("  ", " ")}
        </button>
      </div>

      {linkUrl ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Link2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          {/* The level sits beside the copy button; it is the thing people miss. */}
          <label htmlFor="share-link" className="sr-only">Who can use the link</label>
          <select id="share-link" value={linkAccess} onChange={(e) => onLinkAccess?.(e.target.value)}
            className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs">
            <option value="off">Only invited people</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                Anyone with the link can {r.verb ?? r.label.toLowerCase()}
              </option>
            ))}
          </select>
          <button type="button" disabled={linkAccess === "off"}
            onClick={async () => {
              try { await navigator.clipboard.writeText(linkUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
              catch { /* refused clipboard */ }
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
            {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
