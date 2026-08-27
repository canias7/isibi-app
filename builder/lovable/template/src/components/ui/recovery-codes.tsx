import * as React from "react";
import { Copy, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The one-time codes that get somebody back in when their phone is gone.
 *
 * Shown ONCE. They are stored hashed, exactly like passwords — because that is
 * what they are — so nothing can print them again, and the screen has to say so
 * plainly. A person who assumes they can come back for them later has, in
 * effect, no recovery codes at all.
 *
 * There is a CONFIRMATION before it can be closed, and it is a real checkbox
 * rather than a delay or a disabled-then-enabled button. This is the last
 * moment those codes exist, and losing them costs the account.
 *
 * A used code is struck through and stays VISIBLE. Removing it silently makes
 * the remaining count the only signal, and somebody comparing their printout to
 * this list needs to see which one went.
 *
 * The count remaining is stated, because the failure is running out without
 * noticing — the point at which the account is one lost phone from gone.
 *
 * Download is a plain text file built in the browser. Nothing here should reach
 * a server twice, and no clipboard history is created by a file.
 */
export function RecoveryCodes({
  codes, used = [], onAcknowledge, filename = "recovery-codes.txt", title, className,
}: {
  codes: string[];
  used?: string[];
  onAcknowledge?: () => void;
  filename?: string;
  title?: React.ReactNode;
  className?: string;
}) {
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const left = codes.filter((c) => !used.includes(c)).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* a refused clipboard is not worth an error message; download still works */ }
  };
  const download = () => {
    const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-slot="recovery-codes" className={cn("flex flex-col gap-3 rounded-lg border border-border p-4", className)}>
      <div>
        <p className="text-sm font-semibold">{title ?? "Your recovery codes"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each one works once, if you lose your phone. Keep them somewhere other than the device you sign in on.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 rounded-md bg-muted p-3 font-mono text-sm sm:grid-cols-3">
        {codes.map((c) => {
          const spent = used.includes(c);
          return (
            <li key={c} className={cn("tabular-nums", spent && "text-muted-foreground line-through")}>
              {c}
              {spent ? <span className="sr-only"> (already used)</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs tabular-nums">
        <strong>{left}</strong> of {codes.length} still unused.
        {left <= 2 ? " Generate a new set soon." : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={download}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
          <Download aria-hidden className="size-3.5" /> Download
        </button>
        <button type="button" onClick={copy}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
          {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {onAcknowledge ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)}
              className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-foreground" />
            <span>I have saved these somewhere safe. They cannot be shown again.</span>
          </label>
          <button type="button" onClick={onAcknowledge} disabled={!saved}
            className="cursor-pointer self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
