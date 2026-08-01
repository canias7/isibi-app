import { cn } from "@/lib/utils";
/**
 * An email as it will arrive — headers included, because they are the message.
 *
 * THE SUBJECT AND PREHEADER ARE PART OF THE PREVIEW. Most recipients decide
 * from those two lines alone and never open the body, yet every email preview
 * shows the body and leaves the subject in a form field somewhere above.
 *
 * THE FROM NAME AND ADDRESS ARE BOTH SHOWN. "Vance & Co" from
 * `noreply@mail3.sender.example` is what lands in a spam folder, and the
 * mismatch is invisible unless the address is displayed beside the name.
 *
 * A MISSING PREHEADER IS CALLED OUT, because when it is absent the inbox fills
 * that space with whatever the body starts with — usually "View this email in
 * your browser", which is the single most wasted line in email.
 *
 * IT IS A STATIC RENDER, NOT AN IFRAME. Every client rewrites the HTML anyway,
 * so a pixel-perfect preview is a promise that cannot be kept; what this shows
 * honestly is the part that is ours.
 */
export function EmailPreview({ fromName, fromAddress, subject, preheader, children, replyTo, className }: {
  fromName: string;
  fromAddress: string;
  subject: string;
  /** The line shown after the subject in most inboxes. */
  preheader?: string;
  children?: React.ReactNode;
  replyTo?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border p-3 text-sm">
        <dt className="text-muted-foreground">From</dt>
        <dd className="min-w-0">
          {fromName}
          <span className="block break-all text-xs text-muted-foreground">{fromAddress}</span>
        </dd>
        {replyTo && (<><dt className="text-muted-foreground">Reply to</dt><dd className="break-all">{replyTo}</dd></>)}
        <dt className="text-muted-foreground">Subject</dt>
        <dd className="font-medium">{subject}</dd>
        <dt className="text-muted-foreground">Preview line</dt>
        <dd className={cn(!preheader && "text-muted-foreground italic")}>
          {preheader || "not set — the inbox will show whatever the email starts with"}
        </dd>
      </dl>
      {children && <div className="rounded-md border border-border p-3 text-sm">{children}</div>}
    </div>
  );
}
