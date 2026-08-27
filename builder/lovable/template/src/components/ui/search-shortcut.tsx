import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The search affordance in a header, with its keyboard shortcut printed on it.
 *
 * "/" IS IGNORED WHILE TYPING. Binding a bare character globally means pressing
 * it inside any text field focuses the search box instead of typing it, which
 * breaks every form on the page — the same guard `shortcut-overlay` needs and
 * the same reason.
 *
 * The key is shown with the PLATFORM's modifier, so a Mac sees ⌘K and everyone
 * else Ctrl K. This is the discovery mechanism for the palette; printing the
 * wrong key is worse than printing none.
 *
 * Below `sm` it is an ICON ONLY with a real accessible name. A full search box
 * in a phone header crowds out the logo and the menu, and the keyboard hint is
 * meaningless there anyway.
 *
 * It is a BUTTON, not an input. It opens `command-bar`; an input that is really
 * a trigger accepts a keystroke and then loses it when the palette takes focus.
 */
export function useSearchKey(onOpen: () => void, key = "/") {
  const openRef = React.useRef(onOpen);
  openRef.current = onOpen;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const bare = e.key === key && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!combo && !bare) return;
      const el = e.target as HTMLElement | null;
      // Never steal a keystroke from a field somebody is typing in.
      if (bare && el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      openRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [key]);
}

export function SearchShortcut({ onOpen, placeholder = "Search", className }: {
  onOpen: () => void;
  placeholder?: string;
  className?: string;
}) {
  const mac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  return (
    <button data-slot="search-shortcut" type="button" onClick={onOpen} aria-label={placeholder}
      className={cn("inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted",
        "sm:w-56", className)}>
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate text-start sm:block">{placeholder}</span>
      <kbd aria-hidden className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] sm:block">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
