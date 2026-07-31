import * as React from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
/**
 * Light and dark.
 *
 * Toggles the `dark` class, which is what this template's stylesheet keys off
 * (`@custom-variant dark`). Starts from the system preference rather than
 * assuming light, and remembers a deliberate choice.
 */
export function ThemeToggle({ storageKey = "theme", className }: { storageKey?: string; className?: string }) {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* private mode */ }
    const on = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDark(!!on);
    document.documentElement.classList.toggle("dark", !!on);
  }, [storageKey]);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem(storageKey, next ? "dark" : "light"); } catch { /* private mode */ }
  };
  return (
    <Button size="icon" variant="ghost" onClick={flip} className={className}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
