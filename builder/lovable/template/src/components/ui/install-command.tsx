import * as React from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * How to install this. One package, four package managers.
 *
 * THE `$` IS NOT IN THE COPIED STRING. It is painted as an `aria-hidden`,
 * unselectable prompt character, and what the clipboard gets is the command
 * alone. Copying the prompt with the command is the single most common bug in
 * this widget and it produces `$: command not found` — an error that reads like
 * the package is broken.
 *
 * The choice of manager is REMEMBERED, in `localStorage`, and shared by every
 * one of these on the page. A README has this block four times; picking pnpm at
 * the top and finding npm again at each of the others is the `sdk-tabs`
 * complaint, so it gets the `sdk-tabs` answer — with its own key, because which
 * package manager somebody uses and which language they read examples in are
 * not the same preference.
 *
 * Real tabs — one tab stop, arrow keys — since moving across four managers with
 * the keyboard is normal here.
 *
 * `commands` overrides the lot for anything that is not an npm-shaped install:
 * a `brew install`, a curl script, a `pip install`.
 */
const KEY = "package-manager";
const DEFAULT_MANAGERS = ["npm", "pnpm", "yarn", "bun"];

function build(manager: string, pkg: string, dev?: boolean) {
  if (manager === "npm") return `npm install ${dev ? "-D " : ""}${pkg}`;
  if (manager === "bun") return `bun add ${dev ? "-d " : ""}${pkg}`;
  return `${manager} add ${dev ? "-D " : ""}${pkg}`;
}

export function usePackageManager(fallback: string) {
  const [pm, setPm] = React.useState(fallback);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setPm(saved);
    } catch { /* private mode */ }
  }, []);
  const set = React.useCallback((next: string) => {
    setPm(next);
    try { localStorage.setItem(KEY, next); } catch { /* as above */ }
  }, []);
  return [pm, set] as const;
}

export function InstallCommand({
  pkg, dev, managers = DEFAULT_MANAGERS, commands, value, onChange, className,
}: {
  /** The package name. Ignored when `commands` is given. */
  pkg?: string;
  /** Install as a dev dependency. */
  dev?: boolean;
  managers?: string[];
  /** Manager -> the exact command, for anything not npm-shaped. */
  commands?: Record<string, string>;
  value?: string;
  onChange?: (manager: string) => void;
  className?: string;
}) {
  const names = commands ? Object.keys(commands) : managers;
  const [own, setOwn] = usePackageManager(names[0] ?? "npm");
  const active = value ?? (names.includes(own) ? own : names[0]);
  const pick = onChange ?? setOwn;
  const id = React.useId();

  if (!active) return null;
  const command = commands ? commands[active] : build(active, pkg ?? "", dev);
  if (!command) return null;

  return (
    <div data-slot="install-command" className={cn("overflow-hidden rounded-md border border-border", className)}>
      <div role="tablist" aria-label="Package manager"
        onKeyDown={(e) => {
          const i = names.indexOf(active);
          if (e.key === "ArrowRight") { e.preventDefault(); pick(names[(i + 1) % names.length]); }
          if (e.key === "ArrowLeft") { e.preventDefault(); pick(names[(i - 1 + names.length) % names.length]); }
        }}
        className="flex gap-1 border-b border-border bg-muted px-1 pt-1">
        {names.map((m) => (
          <button key={m} role="tab" type="button"
            aria-selected={m === active}
            aria-controls={`${id}-panel`}
            tabIndex={m === active ? 0 : -1}
            onClick={() => pick(m)}
            className={cn("cursor-pointer rounded-t px-2.5 py-1 text-xs",
              m === active ? "bg-background font-medium" : "text-muted-foreground hover:text-foreground")}>
            {m}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" className="flex items-center gap-2 px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-sm">
          <span aria-hidden className="me-2 select-none text-muted-foreground">$</span>
          {command}
        </code>
        <CopyButton value={command} label={`Copy ${active} command`} iconOnly />
      </div>
    </div>
  );
}
