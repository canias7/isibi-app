import * as React from "react";
/**
 * Announces a message to a screen reader without showing anything.
 *
 * The element must be in the DOM BEFORE the text changes, or nothing is
 * announced — which is why this renders an empty region rather than appearing
 * along with its message. That single rule is what most hand-rolled live
 * regions get wrong.
 *
 * `polite` waits for a pause; `assertive` interrupts, and is for a failure
 * somebody has to act on. Interrupting for "saved" is why people turn
 * announcements off.
 */
export function LiveRegion({ message, urgency = "polite" }: {
  message?: string | null; urgency?: "polite" | "assertive";
}) {
  return (
    <div className="sr-only" role={urgency === "assertive" ? "alert" : "status"}
      aria-live={urgency} aria-atomic="true">
      {message ?? ""}
    </div>
  );
}
/**
 * The same thing as a hook, for a page that announces from several places.
 * Re-announces an identical message by appending a zero-width space, since a
 * live region ignores text it considers unchanged.
 */
export function useAnnounce() {
  const [message, setMessage] = React.useState("");
  const say = React.useCallback((text: string) => {
    setMessage((prev) => (prev === text ? text + "​" : text));
  }, []);
  return { message, say };
}
