import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * An iframe with something useful in its place when it does not load.
 *
 * A BLOCKED IFRAME LEAVES A BLANK RECTANGLE and no explanation. Corporate
 * proxies, content blockers, `X-Frame-Options` and offline all produce the same
 * empty box — and the visitor concludes the page is broken rather than that one
 * panel is unavailable.
 *
 * `onLoad` IS NOT A SUCCESS SIGNAL AND THIS IS THE WHOLE DESIGN. Measured: a
 * frame pointed at an unreachable host fires `onLoad` in Chrome, because the
 * browser's own error page loaded — so a fallback gated on it never appears,
 * which is exactly the failure this component exists to prevent. Cross-origin
 * rules mean the contents cannot be inspected either, so there is no way to
 * detect this from the outside.
 *
 * SO THE ONLY REAL SIGNAL IS A HANDSHAKE. `readyMessage` is the `type` the
 * embed posts once it has rendered; if it does not arrive in time the frame did
 * not work. Without it there is no honest automatic detection, and the
 * component says so by always showing the escape link instead of pretending.
 *
 * THE FALLBACK IS A REAL LINK TO THE SAME THING. Whatever the frame would have
 * shown exists at a URL, and opening it in a tab is a complete answer where an
 * error message is not.
 *
 * `title` IS REQUIRED, not optional. An unlabelled frame is announced as
 * "frame" and its contents are unreachable in a screen reader's landmark list.
 */
export function IframeFallback({ src, title, height = 400, readyMessage, timeoutMs = 6000, fallbackLabel = "Open it in a new tab", className }: {
  src: string;
  /** Required — this is what a screen reader announces. */
  title: string;
  height?: number;
  /** The postMessage `type` the embed sends when it has rendered. */
  readyMessage?: string;
  timeoutMs?: number;
  fallbackLabel?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ready = useRef(false);
  useEffect(() => {
    if (!readyMessage) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (data && typeof data === "object" && data.type === readyMessage) ready.current = true;
    };
    window.addEventListener("message", onMessage);
    const t = setTimeout(() => { if (!ready.current) setFailed(true); }, timeoutMs);
    return () => { window.removeEventListener("message", onMessage); clearTimeout(t); };
  }, [readyMessage, timeoutMs]);
  if (failed) {
    return (
      <div style={{ minHeight: height }}
        className={cn("flex flex-col items-start justify-center gap-1 rounded-md border border-border p-4", className)}>
        <p className="text-sm font-medium">{title} could not load here</p>
        <p className="text-xs text-muted-foreground">
          Something on this network or in your browser is blocking it. It still works on its own.
        </p>
        <a href={src} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
          {fallbackLabel}
        </a>
      </div>
    );
  }
  return (
    <div className={cn("space-y-1", className)}>
      <iframe src={src} title={title} height={height} className="w-full rounded-md border border-border" />
      {!readyMessage && (
        <p className="text-xs text-muted-foreground">
          Nothing there?{" "}
          <a href={src} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {fallbackLabel}
          </a>
        </p>
      )}
    </div>
  );
}
