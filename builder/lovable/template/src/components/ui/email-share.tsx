import * as React from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Email this" — a prefilled mailto link.
 *
 * EVERY PART IS `encodeURIComponent`-ED, and the body's newlines become `%0A`.
 * An unencoded ampersand in a subject silently truncates the body at that
 * point, which is how a share link arrives with half a sentence — and an
 * apostrophe or a `#` breaks it in a different way. This is the entire
 * technical content of the component and it is got wrong constantly.
 *
 * THE BODY IS CAPPED at ~1,800 characters. Browsers and mail clients truncate a
 * long `mailto:` at wildly different lengths, some silently — so it is trimmed
 * here, visibly, rather than being cut somewhere unpredictable.
 *
 * It is a real `<a href="mailto:">`, not a button running `location.href`. A
 * link can be middle-clicked, copied and opened in a chosen client, and it does
 * nothing at all when no mail client is configured — which is the correct
 * failure, rather than a page that appears to hang.
 *
 * No recipient is prefilled unless the caller gives one: `mailto:` with a
 * stranger's address in a share button is how somebody emails the wrong person.
 */
export function mailtoUrl({ to = "", subject = "", body = "", cc, bcc, max = 1800 }: {
  to?: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
  max?: number;
}) {
  const trimmed = body.length > max ? body.slice(0, max - 1) + "…" : body;
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : null,
    trimmed ? `body=${encodeURIComponent(trimmed)}` : null,
    cc ? `cc=${encodeURIComponent(cc)}` : null,
    bcc ? `bcc=${encodeURIComponent(bcc)}` : null,
  ].filter(Boolean);
  return `mailto:${encodeURIComponent(to)}${params.length ? `?${params.join("&")}` : ""}`;
}

export function EmailShare({ to, subject, body, label = "Email this", className }: {
  to?: string;
  subject?: string;
  body?: string;
  label?: string;
  className?: string;
}) {
  const href = mailtoUrl({ to, subject, body });
  const long = (body?.length ?? 0) > 1800;
  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <a href={href}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
        <Mail aria-hidden className="size-3.5" />
        {label}
      </a>
      {long ? (
        <span className="text-xs text-muted-foreground">The message was shortened to fit a mail link.</span>
      ) : null}
    </span>
  );
}
