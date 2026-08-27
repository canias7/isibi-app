import * as React from "react";
import { Bell, BellOff, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The browser-push subscribe button, with the three states permission has.
 *
 * "DENIED" IS PERMANENT AND THE BUTTON MUST SAY SO. Once somebody has refused
 * notification permission, `requestPermission` resolves immediately as denied
 * without ever showing a prompt — so a button that keeps offering to enable
 * them does nothing, forever, with no explanation. The remedy is in the
 * browser's own settings and the text has to say that.
 *
 * IT ASKS ONLY ON A DELIBERATE PRESS. Requesting permission on page load is the
 * pattern that got the API restricted in the first place; browsers now require
 * a user gesture, and asking before somebody knows what the site is gets
 * refused — permanently, per the point above.
 *
 * IT SAYS WHAT THE NOTIFICATIONS WILL BE. "Enable notifications" is a request
 * for a permission with no stated purpose, which is what people refuse.
 *
 * `Notification` is feature-detected: it does not exist in an iframe on iOS, in
 * some in-app browsers, or on any non-secure origin.
 */
export function pushPermission(): "unsupported" | NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function SubscribeToggle({ subscribed, what, onSubscribe, onUnsubscribe, busy, className }: {
  subscribed?: boolean;
  what?: React.ReactNode;
  onSubscribe: () => void | Promise<void>;
  onUnsubscribe?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [permission, setPermission] = React.useState<"unsupported" | NotificationPermission>("default");
  React.useEffect(() => { setPermission(pushPermission()); }, []);

  if (permission === "unsupported") {
    return (
      <p data-slot="subscribe-toggle" className={cn("text-xs text-muted-foreground", className)}>
        This browser cannot show notifications.
      </p>
    );
  }

  // Denied is permanent: requestPermission resolves instantly and shows no prompt.
  if (permission === "denied") {
    return (
      <p className={cn("text-xs", className)}>
        <span className="font-medium">Notifications are blocked for this site.</span>{" "}
        <span className="text-muted-foreground">
          Turn them back on in your browser&rsquo;s settings for this page — nothing here can ask again.
        </span>
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (subscribed) { onUnsubscribe?.(); return; }
          // Only on a press: asking on load is what gets it refused for good.
          const granted = await Notification.requestPermission();
          setPermission(granted);
          if (granted === "granted") await onSubscribe();
        }}
        aria-pressed={!!subscribed}
        className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:pointer-events-none disabled:opacity-60",
          subscribed ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}
      >
        {busy ? <Loader aria-hidden className="size-3.5 motion-safe:animate-spin" />
          : subscribed ? <Bell aria-hidden className="size-3.5" />
          : <BellOff aria-hidden className="size-3.5" />}
        {subscribed ? "Notifications on" : "Turn on notifications"}
      </button>
      {what ? <span className="text-xs text-muted-foreground">{what}</span> : null}
    </div>
  );
}
