import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The debounced check-with-the-server lifecycle, done once.
 *
 * FOUR STATES, AND IDLE IS ONE OF THEM: idle · checking · ok · failed.
 * An empty field is idle, not failed — validating absence before anyone
 * typed is the classic. TYPING IS NEVER BLOCKED and the check never
 * fires per keystroke: debounced (400ms), and the checking indicator
 * waits a further beat before appearing (the skeleton delay rule) so a
 * fast answer never flashes a spinner.
 *
 * STALE ANSWERS ARE DISCARDED BY SEQUENCE NUMBER (the instant-results
 * rule): the check for "gra" resolving after the check for "grace" must
 * not overwrite it — with a slow network and fast typing that is the
 * COMMON case, not the edge.
 *
 * The hook owns timing and staleness; what "valid" means stays in the
 * caller's `check`. Unmount cancels everything.
 */
export function useAsyncValidation(
  value: string,
  check: (value: string) => Promise<{ ok: boolean; message?: string }>,
  debounceMs = 400,
) {
  const [state, setState] = React.useState<{ status: "idle" | "checking" | "ok" | "failed"; message?: string }>({ status: "idle" });
  const seq = React.useRef(0);
  const checkRef = React.useRef(check);
  checkRef.current = check;

  React.useEffect(() => {
    if (!value.trim()) { setState({ status: "idle" }); return; }
    const mine = ++seq.current;
    let showChecking: ReturnType<typeof setTimeout> | null = null;
    const run = setTimeout(async () => {
      // The spinner waits its own beat - a fast answer never flashes one.
      showChecking = setTimeout(() => {
        if (seq.current === mine) setState({ status: "checking" });
      }, 250);
      try {
        const res = await checkRef.current(value);
        if (seq.current !== mine) return; // a newer value owns the field now
        setState(res.ok ? { status: "ok", message: res.message } : { status: "failed", message: res.message });
      } catch {
        if (seq.current === mine) setState({ status: "idle" }); // a broken checker must not block
      } finally {
        if (showChecking) clearTimeout(showChecking);
      }
    }, debounceMs);
    return () => { clearTimeout(run); if (showChecking) clearTimeout(showChecking); };
  }, [value, debounceMs]);

  return state;
}

export function AsyncValidationNote({ state, className }: {
  state: { status: "idle" | "checking" | "ok" | "failed"; message?: string };
  className?: string;
}) {
  if (state.status === "idle") return null;
  return (
    <p className={cn("text-xs", state.status === "failed" ? "font-medium" : "text-muted-foreground", className)}>
      {state.status === "checking" ? "Checking…" : state.message ?? (state.status === "ok" ? "Looks good." : "That will not work.")}
    </p>
  );
}
