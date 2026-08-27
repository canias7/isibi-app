import * as React from "react";
import { MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Check your email" — the screen after a sign-in link is sent.
 *
 * It says the ADDRESS it went to. Half the times this screen fails, it is a
 * typo, and showing what was typed is the only way anybody notices. It also
 * offers the way BACK to fix it, which a page that only says "check your inbox"
 * does not.
 *
 * It names the SPAM FOLDER, without apology. That is where the message is in a
 * meaningful share of cases and there is no clever alternative — telling people
 * to look is the entire remedy.
 *
 * The screen does NOT poll or advance on its own. The link is usually opened on
 * a different device, and a page that redirects itself on success leaves the
 * person staring at a phone while their laptop moves on — or, worse, decides
 * the login failed and clears the pending state.
 *
 * "Send it again" is deliberately paired with `otp-resend`'s countdown rather
 * than being free: each press sends another real message to a real inbox.
 */
export function MagicLinkSent({ email, onChangeEmail, resend, expiresIn, className }: {
  email: React.ReactNode;
  onChangeEmail?: () => void;
  resend?: React.ReactNode;
  expiresIn?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="magic-link-sent" className={cn("flex flex-col items-center gap-3 rounded-lg border border-border p-6 text-center", className)}>
      <MailCheck aria-hidden className="size-6" />
      <div>
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&rsquo;ve sent a sign-in link to <strong className="font-medium text-foreground">{email}</strong>.
          {expiresIn ? <> It works for {expiresIn}.</> : null}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Nothing yet? It sometimes lands in the spam folder.
      </p>
      {resend}
      {onChangeEmail ? (
        <button type="button" onClick={onChangeEmail}
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Wrong address? Go back and change it
        </button>
      ) : null}
    </div>
  );
}
