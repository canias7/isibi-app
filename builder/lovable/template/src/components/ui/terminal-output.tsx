import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Command output, as it came back.
 *
 * ANSI ESCAPE CODES ARE STRIPPED, not rendered. Real output is full of them and
 * printed raw they appear as `[0;32m` litter through every line; rendering
 * them properly means a colour parser and a palette this monochrome kit does
 * not have. Stripping is the honest option and it makes the text copyable —
 * which is what somebody wants from a terminal panel.
 *
 * `\r` is handled, because a progress bar rewrites its line with a carriage
 * return and a viewer that keeps them shows forty copies of the same line.
 * Only the last segment of each line survives, which is what the terminal
 * itself displays.
 *
 * The COMMAND is shown above its output with a `$`, and the `$` is
 * `aria-hidden` and `select-none` so copying the command does not bring a
 * prompt character that then fails to run.
 *
 * A non-zero exit code is stated. Output that simply stops is ambiguous between
 * finished and crashed.
 */
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

export function stripAnsi(text: string) {
  return text.replace(ANSI, "");
}

export function applyCarriageReturns(text: string) {
  return text.split("\n").map((line) => {
    const parts = line.split("\r");
    return parts[parts.length - 1];
  }).join("\n");
}

export function TerminalOutput({ command, output, exitCode, running, className }: {
  command?: string;
  output: string;
  exitCode?: number;
  running?: boolean;
  className?: string;
}) {
  const clean = React.useMemo(() => applyCarriageReturns(stripAnsi(output)), [output]);
  const [copied, setCopied] = React.useState(false);

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-muted/40", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          {command ? (
            <>
              <span aria-hidden className="me-1.5 text-muted-foreground select-none">$</span>
              {command}
            </>
          ) : <span className="text-muted-foreground">Output</span>}
        </code>
        <button type="button" aria-label="Copy output"
          onClick={async () => {
            try { await navigator.clipboard.writeText(clean); setCopied(true); setTimeout(() => setCopied(false), 2000); }
            catch { /* a refused clipboard is not worth an error here */ }
          }}
          className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">{clean}</pre>
      {running ? (
        <p aria-live="polite" className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">Still running…</p>
      ) : exitCode != null ? (
        <p className={cn("border-t border-border px-3 py-1.5 text-xs",
          exitCode === 0 ? "text-muted-foreground" : "font-medium")}>
          {exitCode === 0 ? "Finished." : `Exited with code ${exitCode}.`}
        </p>
      ) : null}
    </div>
  );
}
