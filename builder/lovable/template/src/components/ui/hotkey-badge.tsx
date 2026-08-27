import * as React from "react";
import { ShortcutKeys } from "@/components/ui/shortcut-overlay";
import { cn } from "@/lib/utils";
/**
 * A small kbd hint beside a control — that knows when not to exist.
 *
 * HIDDEN ON TOUCH-ONLY DEVICES. `Ctrl K` on a phone is a promise the
 * hardware cannot keep; `(hover: none) and (pointer: coarse)` is the
 * closest honest signal for "no keyboard culture here", and the badge
 * renders nothing rather than decorating. (A tablet with a keyboard
 * attached reports hover:none too — the cost of the wrong guess there is
 * a missing hint, not a lying one, which is the survivable direction.)
 *
 * It renders the platform-correct glyphs via ShortcutKeys (one place
 * knows about ⌘ vs Ctrl) and is aria-hidden: the control's own label
 * should carry the shortcut for AT (`aria-keyshortcuts`), not a
 * decorative chip.
 */
export function HotkeyBadge({ keys, className }: { keys: string[]; className?: string }) {
  const [touchOnly, setTouchOnly] = React.useState(false);
  React.useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(hover: none) and (pointer: coarse)");
    const read = () => setTouchOnly(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  if (touchOnly) return null;
  return (
    <span data-slot="hotkey-badge" aria-hidden className={cn("inline-flex", className)}>
      <ShortcutKeys keys={keys} />
    </span>
  );
}
