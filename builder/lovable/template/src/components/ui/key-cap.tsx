import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One key, drawn as a key.
 *
 * IT RESOLVES THE MODIFIER TO THE PLATFORM. "Mod" renders ⌘ on a Mac and Ctrl
 * everywhere else, and "Alt" becomes ⌥ — telling a Mac user to press Ctrl+K
 * when the app listens for ⌘K is a shortcut that simply does not work, and
 * hard-coding either one is wrong for half the readers.
 *
 * The detection runs in an effect rather than at module scope, so a server
 * render and the first client render agree; without that the markup differs on
 * hydration and React replaces it, which flickers.
 *
 * A REAL `<kbd>`, which carries the meaning natively. The symbol is paired with
 * an `sr-only` word — "Command" is speakable and "⌘" is not, and a screen
 * reader reading a shortcut aloud as punctuation is no shortcut at all.
 */
const SYMBOL: Record<string, { mac: string; other: string; say: string }> = {
  mod: { mac: "⌘", other: "Ctrl", say: "Command or Control" },
  cmd: { mac: "⌘", other: "⌘", say: "Command" },
  ctrl: { mac: "⌃", other: "Ctrl", say: "Control" },
  alt: { mac: "⌥", other: "Alt", say: "Alt" },
  shift: { mac: "⇧", other: "Shift", say: "Shift" },
  enter: { mac: "↵", other: "Enter", say: "Enter" },
  esc: { mac: "Esc", other: "Esc", say: "Escape" },
  tab: { mac: "⇥", other: "Tab", say: "Tab" },
  backspace: { mac: "⌫", other: "Backspace", say: "Backspace" },
  up: { mac: "↑", other: "↑", say: "Up arrow" },
  down: { mac: "↓", other: "↓", say: "Down arrow" },
  left: { mac: "←", other: "←", say: "Left arrow" },
  right: { mac: "→", other: "→", say: "Right arrow" },
};

export function useIsMac() {
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

export function KeyCap({ k, className }: {
  /** A key name — "mod", "shift", "esc" — or a literal like "K". */
  k: string;
  className?: string;
}) {
  const mac = useIsMac();
  const entry = SYMBOL[k.toLowerCase()];
  const shown = entry ? (mac ? entry.mac : entry.other) : k.toUpperCase();
  const say = entry ? entry.say : k.toUpperCase();

  return (
    <kbd className={cn("inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-xs", className)}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{say}</span>
    </kbd>
  );
}
