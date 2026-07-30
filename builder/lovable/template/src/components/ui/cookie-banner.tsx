import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The consent strip.
 *
 * Accept and Decline are given EQUAL weight, which is both the honest design and
 * what the law in most places requires — a prominent Accept beside a buried
 * Decline is the pattern regulators fine people for.
 */
export function CookieBanner({
  message = "We use cookies to see which pages are read. Nothing is shared.",
  policyHref, storageKey = "cookie-consent", onDecision, className,
}: {
  message?: string; policyHref?: string; storageKey?: string;
  onDecision?: (accepted: boolean) => void; className?: string;
}) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    try { setShow(!localStorage.getItem(storageKey)); } catch { setShow(false); }
  }, [storageKey]);
  if (!show) return null;
  const decide = (ok: boolean) => {
    try { localStorage.setItem(storageKey, ok ? "accepted" : "declined"); } catch { /* private mode */ }
    setShow(false); onDecision?.(ok);
  };
  return (
    <div role="dialog" aria-label="Cookies"
      className={cn("fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4", className)}>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {message}{policyHref && <> <a href={policyHref} className="underline underline-offset-4">Read more</a>.</>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => decide(false)}>Decline</Button>
          <Button size="sm" onClick={() => decide(true)}>Accept</Button>
        </div>
      </div>
    </div>
  );
}
