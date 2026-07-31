import * as React from "react";
import { useSeen } from "@/components/ui/hint-dot";
import { ShortcutKeys } from "@/components/ui/shortcut-overlay";
import { cn } from "@/lib/utils";
/**
 * "Tip: press ? for shortcuts" — one line, once, and only where keys
 * exist.
 *
 * SHOWN ONLY ON HOVER-CAPABLE DEVICES (the hotkey-badge rule): a
 * keyboard tip on a phone advertises hardware the reader does not have.
 * And DISMISSED IS FOREVER (useSeen) — a tip is an introduction; being
 * introduced weekly to the same fact is how tips train people to
 * dismiss everything, including the one that mattered.
 *
 * One line, muted, at most one `keys` chord — a tip listing five
 * shortcuts is the shortcut overlay wearing a disguise; link to the real
 * one instead (that is what the ? is).
 */
export function KeyboardTip({ tipKey = "keyboard-tip", keys = ["?"], children, className }: {
  tipKey?: string;
  keys?: string[];
  children?: React.ReactNode;
  className?: string;
}) {
  const { seen, markSeen } = useSeen(tipKey);
  const [touchOnly, setTouchOnly] = React.useState(true);
  React.useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    setTouchOnly(matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);
  if (seen || touchOnly) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span>Tip:</span>
      <span className="inline-flex items-center gap-1">
        press <ShortcutKeys keys={keys} />
      </span>
      {children ?? "for keyboard shortcuts"}
      <button type="button" onClick={markSeen} aria-label="Dismiss this tip"
        className="cursor-pointer underline underline-offset-2">
        Got it
      </button>
    </p>
  );
}
