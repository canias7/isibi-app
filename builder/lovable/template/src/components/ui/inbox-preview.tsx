import { cn } from "@/lib/utils";
/**
 * The one line an email gets in a crowded inbox, at its real length.
 *
 * IT TRUNCATES AT REALISTIC LIMITS AND SHOWS THE CUT. A subject that reads
 * perfectly in a settings field arrives as "Your appointment with Vance & Co
 * is confirmed for Fri…" — and the useful half is gone. Seeing the truncation
 * is the only way to write for it.
 *
 * PHONE AND DESKTOP ARE BOTH SHOWN, because they cut at very different points —
 * around 35 characters on a phone against 60 on a desktop client — and writing
 * for one leaves the other broken. The phone one is first, since that is where
 * most mail is read.
 *
 * THE PREHEADER SHARES THE LINE. Inboxes run subject and preview text together,
 * so a preheader repeating the subject wastes the whole line — visible here and
 * nowhere else.
 *
 * LIMITS ARE APPROXIMATE AND SAID TO BE. Every client differs and none
 * publishes a number; a component asserting an exact cut would be confidently
 * wrong.
 */
export function InboxPreview({ fromName, subject, preheader, phoneChars = 35, desktopChars = 60, className }: {
  fromName: string;
  subject: string;
  preheader?: string;
  phoneChars?: number;
  desktopChars?: number;
  className?: string;
}) {
  const line = [subject, preheader].filter(Boolean).join(" — ");
  const cut = (n: number) => (line.length > n ? line.slice(0, n) : line);
  const row = (label: string, n: number) => (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label} · about {n} characters</p>
      <p className="mt-0.5 truncate text-sm">
        <span className="font-medium">{fromName}</span>
      </p>
      <p className="text-sm">
        {cut(n)}
        {line.length > n && <span className="text-muted-foreground">…</span>}
      </p>
    </div>
  );
  return (
    <div data-slot="inbox-preview" className={cn("space-y-2", className)}>
      {row("On a phone", phoneChars)}
      {row("On a desktop", desktopChars)}
      <p className="text-xs text-muted-foreground">
        Every mail app cuts at a different point — these are rough. Put what matters first.
      </p>
    </div>
  );
}
