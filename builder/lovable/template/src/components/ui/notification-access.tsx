import { PermissionPrompt } from "@/components/ui/permission-prompt";
/**
 * Asking to send notifications, with what will be sent listed first.
 *
 * IT LISTS WHAT THE NOTIFICATIONS WILL BE. This is the permission people refuse
 * most, and they refuse it because "allow notifications" is an unbounded
 * promise — it could mean an appointment reminder or six marketing pushes a
 * week. Naming them makes the request finite and answerable.
 *
 * THE EMAIL OR SMS ALTERNATIVE IS THE FALLBACK, and for a reminder it is
 * usually the better channel anyway — a push notification on a phone that has
 * been reinstalled is a reminder nobody gets.
 *
 * IT MUST BE ASKED ON A GESTURE. Chrome and Firefox both ignore
 * `Notification.requestPermission()` outside a user gesture now, so a prompt
 * fired on load does not merely annoy — it silently does nothing, which looks
 * exactly like a working feature that never sends anything.
 *
 * Same `PermissionPrompt` shape as camera and location, so a refusal reads
 * identically wherever the reader meets one.
 */
export function NotificationAccess({ state, onAsk, kinds = [], frequency, alternative, className }: {
  state: "ask" | "asking" | "denied" | "granted" | "unavailable";
  onAsk: () => void;
  /** What will be sent — "when your appointment is tomorrow". */
  kinds?: string[];
  /** How often, at most — "no more than one a week". */
  frequency?: string;
  /** Email or SMS instead. */
  alternative?: React.ReactNode;
  className?: string;
}) {
  const list = kinds.length === 0 ? "" :
    kinds.length === 1 ? ` We will send you a notification ${kinds[0]}.` :
    ` We will send you a notification ${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}.`;
  return (
    <PermissionPrompt className={className} title="Send you notifications" state={state} onAsk={onAsk}
      askLabel="Turn on notifications"
      reason={`Notifications let us reach you without an email.${list}${frequency ? ` ${frequency}.` : ""}`}
      fallback={alternative} />
  );
}
